---
name: plan-storage-lazy-loading-2026-10-21
description: 把压首屏的 storage chunk（Dexie + 存储桶，51.77 KB gzip）移出首屏静态图——10 处消费方改动态 import 的方案、影响与验证计划。
status: draft
owner: yanha
last_updated: 2026-10-21
---

# PLAN-storage-lazy-loading-2026-10-21

## 0. 结论（TL;DR）

- **现状（实测）**：`storage` chunk（Dexie + 存储桶）149.32 KB raw / **51.77 KB gzip**，被入口 chunk 静态引用，且 `index.html` 对其发 `modulepreload`——整块压在首屏关键路径上；入口自身仅 20.50 KB gzip。
- **关键事实**：全库 10 处存储消费方**无一在模块顶层使用存储**，全部在异步函数内 `await initDB()` 之后使用 `db`/`*Storage`，且均带 try/catch 静默降级。运行时架构本就是延迟友好的，缺的只是「代码不进首屏静态图」。
- **方案**：10 处调用点把静态 import 改为函数内动态 `import()`（机械改动），storage 退出首屏静态图；`db.open()` 时序与离线优先语义不变。
- **收益**：首屏 -51.77 KB gzip / -146 KB raw（传输 + 解析 + 执行）；重复访问 PWA precache 已含该 chunk，成本≈0。
- **工作量**：约 1–1.5h；L2 验证（type-check + build + vitest 全量 + e2e）。
- **建议：做**。收益确定、风险可控，且「路由级动态 import」是仓库已在用的模式（views 全部路由懒加载），本方案只是把同一模式应用到存储层。

## 1. 现状（实测数据，2026-10-21 main `5f89f52` 构建产物）

| chunk | raw | gzip | 首屏关键路径 |
|---|---|---|---|
| `index-*.js`（入口） | 55.94 KB | 20.50 KB | 是 |
| `storage-*.js`（Dexie + 存储桶） | 149.32 KB | **51.77 KB** | **是（静态引用 + modulepreload）** |
| runtime-core / runtime-dom / rolldown-runtime 等 | — | 小 | 是 |

- 入口 chunk 内存在对 `storage-*.js` 的静态 import；`index.html` 的 `modulepreload` 链接列表含 `storage-*.js`。
- 对照：3D 资产（最大的 `tres-*.js`）已是路由级懒加载，**不在**首屏 preload 列表——存储层是首屏静态图里最后一块肥肉。

### 1.1 消费方清单（10 处，全部函数内使用）

| 文件 | 静态导入 | 使用位置 |
|---|---|---|
| `src/main.ts` | `historyStorage, initDB` | `initializeApp()` / `online` 监听 |
| `src/services/errorBuffer.ts` | `db, initDB` | `recordError/listErrors/clearErrors` |
| `src/services/vitals.ts` | `db, initDB` | `saveVital/getWebVitals/clearWebVitals` |
| `src/services/tracking.ts` | `db, initDB` | `track/getTrackingSummary/clearTracking` |
| `src/services/telemetry/index.ts` | `initDB, settingsStorage` | `initTelemetry` / 开关读写 |
| `src/services/telemetry/outbox.ts` | `db, initDB` | `enqueue/takeBatch` 等 |
| `src/stores/auth.ts` | `historyStorage` | action 内 2 处 |
| `src/stores/tea.ts` | `historyStorage` | action 内 1 处 |
| `src/stores/record.ts` | `historyStorage` | action 内 2 处 |
| `src/stores/progress.ts` | 桶多导出 | action 内 |

- `App.vue` 与 router 不碰存储。
- 所有使用点均满足：异步函数内 → `await initDB()` → 用 `db`；异常静默。**无模块级副作用，重构不触及执行时序**。

## 2. 方案（双向论证）

### A. 消费方动态 import（推荐）

- `main.ts`：删静态桶 import；`initializeApp()` 内 `const { initDB, historyStorage } = await import('@/services/storage')`；`online` 处理器同样动态化（本就是 `void` 异步）。
- 5 个 service（errorBuffer / vitals / tracking / telemetry index+outbox）：删静态 import，各函数内动态取 `db`/`initDB`/`settingsStorage`。
- 4 个 store（auth / tea / record / progress）：删静态 import，action 内动态取 `historyStorage` 等。
- `CollectionView.vue` **保持不动**：路由懒加载视图，其静态桶 import 不进首屏图（可选优化：改直引 `@/services/storage/export`，单列不计入本次）。
- 测试文件**零改动**：测试静态 import 桶不受 chunk 划分影响。

选 A 理由：改动机械可穷尽（10 处，模式统一）；语义零变化（动态 import 返回同一 ESM 模块实例，`migrationDone` 守卫与 `db.open()` 幂等性不变）；模式仓库已用（路由懒加载）。

否 B（维持现状）理由：51.77 KB gzip 压首屏对一个 3D 沉浸式应用是可量化代价——首屏阻塞传输与解析 146 KB 的 Dexie，而它在首屏渲染中零参与（首次 `db.open()` 本就发生在 mount 之后）。

否 C（换存储层，Dexie→idb 直写）理由：架构级重构，触及离线优先地基与全部存储域；收益（dexie 96KB min 中可省的包装层）边际小、风险大。无需求信号支持，YAGNI。

### B/C 不做的具体边界见 §6 Not Doing。

## 3. 影响分析

- **首屏**：-51.77 KB gzip / -146 KB raw；`index.html` 的 storage `modulepreload` 消失，浏览器关键路径不再等待 Dexie。
- **首屏后**：`initializeApp()` 在 mount 后立即触发动态 import，storage chunk 并行拉取；`db.open()` 与历史加载时序不变（原流程也是 mount 后才 open）。
- **错误捕获窗口**：`installErrorBuffer()` 仍同步注册监听；`recordError` 在错误发生时才动态加载存储——首屏极早期错误会等 chunk 到达后补写（`recordError` 本身 async 且静默）。**语义不劣化**：现行实现同样是 `db.open()` 之后才写。
- **重复访问**：PWA precache 覆盖该 chunk（`dist/assets` 静态产物），缓存命中成本≈0。
- **弱网降级**：动态 import 失败时各调用点 try/catch 已静默（存储类失败本就不阻断主流程）；`initializeApp` 的 catch 已存在。

## 4. 风险与回滚

| 风险 | 触发条件 | 影响 | 缓解 |
|---|---|---|---|
| 动态 import 网络失败 | 弱网/离线首访 | 存储不可用 | 各调用点已 try/catch 静默；`initializeApp` catch 已存在；离线优先场景 PWA 已缓存 chunk |
| db 单例身份分裂 | 多处动态 import | 不会发生 | ESM 模块缓存保证同一实例；`initDB` 的 `migrationDone` 守卫不变 |
| 早期错误漏记 | chunk 到达前发生错误 | 延迟补写非丢失 | `recordError` await import 后才写，监听器不注销 |

- **回滚**：单次 `git revert`（改动全在一个提交内，无数据迁移、无 schema 变更）。

## 5. 验证计划（L2：业务逻辑/服务改动 → test + type-check + build）

1. `npm run type-check` + `npm run build`；**构建后断言**：`index.html` 的 modulepreload 列表不再含 `storage-*.js`，入口 chunk 大小不变。
2. `npm test`（vitest 全量 30 文件 / 268 用例；**本机必须从 `/c/users/yanha/Desktop/tea` 小写路径跑**，否则盘符大小写触发 ESM 双实例，见 MEMORY.md 环境陷阱）。
3. e2e（Playwright full journey + a11y）：CI 为权威；本地跑需先清 dist（safe-delete 守卫会拦 vite emptyDir）。
4. 手动冷启动验证：首屏渲染 → `initializeApp` 打开 db → 历史加载 → 断网写入 → 恢复联网 `syncPending`。

## 6. Not Doing

- 不把 barrel 拆成更细的 async chunk（收益边际小，chunk 数上升）。
- 不替换存储层（Dexie → idb）。
- 不动 `db.ts` 的单例构造、版本迁移（V1–V8）与 `migrateFromLocalStorage`。
- 不改 `CollectionView.vue` 的静态 import（路由懒加载已使其不影响首屏；直引 `export` 模块列为可选优化，不计入本次）。
- 不给 `db` 包 getter 代理层（YAGNI：调用点全部在异步函数内，直接动态 import 即可）。
