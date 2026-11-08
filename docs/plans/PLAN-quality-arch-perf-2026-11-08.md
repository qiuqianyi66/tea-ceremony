---
last_updated: 2026-11-08
status: active
owner: yanha
---

# 质量 / 架构 / 性能改进计划（2026-11-08）

> 依据：2026-11-08 在 `fb4cbce` 上的实测基线。原则是**先测量再动手**，每条问题都带 file:line 与复现命令；没有测量依据的一律标「未验证」，不列为改进项。
> 本文只记录已确认问题与批准的分批方案；执行证据逐批追加到 §5。

## 1. 基线（实测）

| 项 | 实测值 | 命令 |
|---|---|---|
| 分层门禁 | ArchUnit `LayerDependencyTest` 1/1 通过，BUILD SUCCESS | `cd backend && mvn -Dtest=LayerDependencyTest test` |
| Lint | 227 文件，0 error，3 info | `npm run lint` |
| 类型检查 | exit 0 | `npm run type-check` |
| 前端单测 | 44 文件 / 381 用例；**全量跑 2–5 红，单文件跑全绿** | `npx vitest run` |
| 构建 | 4.25 s；dist 30.17 MB；最大 chunk 834 KB（gzip 227.7 KB） | `npm run build` |
| PWA 预缓存 | **137 条 / 4.57 MB**（解析 `dist/sw.js`）；最大单条 834 KB | 解析 sw.js 的 `precacheAndRoute` 清单 |
| 代码量 | 前端 214 文件/29.8k 行；后端 main 180/11.1k；后端测试 82/9.1k；脚本 79/8.4k | 文件计数 |
| 后端结构 | 30 个端点映射 +13 个类级 `@RequestMapping`；Flyway 11 迁移；HNSW + gin_trgm 索引齐全；43 处 `@Transactional`，23 带 `readOnly` | 统计 |
| 测试铺开 | 前端 44 spec / 214 源文件；后端 80 测试类 / 180 主类；E2E 14 spec；无覆盖率采集 | 计数 |

### 已有复用设施（不重复造）

- `src/utils/`：array / debounce / format / math / storage / string / throttle / type-guards / url（各带测试）。
- `src/composables/`：audio 四件套 + brew 四件（phase machine / pour gesture / atmosphere / presentation）。
- `src/services/api/types.ts`：统一 `ApiResponse<T>`。历史上「4 处重复定义」已修，**本轮不再成立**。
- 后端 `CultureSearchService`：embedding 进程内 LRU（`CultureSearchService.java:48-55`）+ 检索降级指标，属深模块。

## 2. 已验证问题

### P0-1 性能用例结构性必红

- 位置：`src/services/__tests__/tracking.perf.spec.ts:17,29`
- 事实：断言阈值 10 s / 1 s，但 vitest 默认 `testTimeout` 5 s。实测全量跑报 `Error: Test timed out in 5000ms`（`tracking.perf.spec.ts:17:3`），同一文件单跑 1.9 s 通过。
- 影响：5–10 s 区间**必然失败**，与机器快慢无关；CI 只是恰好够快才绿，属假绿风险。

### P0-2 埋点静默丢事件且不可观测

- 位置：`src/services/tracking.ts:26-54`（`catch {}` 全吞）
- 事实：全量跑时断言报 `expected 853 to be 1000`——2000 条写入丢了约 15%，无计数、无日志、无暴露接口。
- 影响：生产上 IndexedDB 写入失败（配额、并发升级、浏览器回收）会静默丢埋点，无法诊断。

### P1-3 离线兜底对象重复 6 处

- 位置：`src/services/api/auth.ts:45,65`、`garden.ts:52,72`、`records.ts:114`、`teas.ts:76`
- 事实：各自手写 `{ code: 'OK', message: 'ok', data: … }`，协议改动需改 4 个文件。

### P1-4 localStorage 直调 25 处 / 10 文件

- 事实：`src/utils/storage.ts` 已存在，但 `stores/theme.ts`、`services/authStorage.ts`、`services/aiSession.ts`、`services/telemetry/identity.ts` 等各自直调 `localStorage`。
- 未决：各处 key 语义、容错策略（是否加密 / 是否允许抛）可能不同，**先出清单再改**，不整批收敛。

### P1-5 无覆盖率采集

- 位置：`vitest.config.ts`（无 `coverage` 字段，无 `test:coverage` 脚本）
- 影响：测试充分性无法度量，也无法发现"测试很多但关键模块零覆盖"。

### P2-6 PWA 全量预缓存 + 隐性 2 MB 上限

- 位置：`vite.config.ts` 的 `VitePWA.workbox.globPatterns`（含 `jpg/png/json`）
- 事实：实际预缓存 137 条 / 4.57 MB；2K 贴图（2.5–3.7 MB）未入缓存，靠 workbox 默认 `maximumFileSizeToCacheInBytes` 挡下。
- 风险：配置一改（或插件默认变动）就会把大图塞进首装；当前行为是"隐性依赖"，不是显式设计。

### P2-7 大文件不构成架构违规（明确不做）

- `TeaBrewSceneInner.vue` 890 行、`TeaGardenSceneInner.vue` 785 行、`TasteView.vue` 709 行。
- 实测 3D 组件只读 `props.phase`（`TeaBrewSceneInner.vue:356,381,387`），未写状态机，符合 AGENTS §3「3D 只做视觉层」。大但职责单一，拆分属"为拆而拆"，不做。

## 3. 已拍板决策（2026-11-08）

1. **性能基准留在 `npm test`**，给用例显式 `testTimeout`（30 s）并与断言阈值对齐；不拆独立 bench（拆出去等于放弃长期门禁）。
2. **覆盖率只采集不设阈值**：先跑两周拿基线数字，再决定门槛，避免拍脑袋卡线造成假红。
3. PWA 缓存分级（B5）**暂缓**：先做「显式化当前默认上限」，是否把大资源改 runtimeCaching 需另一次拍板（影响离线首访完整度）。

## 4. 分批方案

| 批次 | 目标 | 改动面 | 验收命令 | 回滚 |
|---|---|---|---|---|
| **B1** | 修 P0-1 + P0-2：显式 timeout 对齐；`track()` 增丢弃/拒绝计数 + 单测 | `tracking.perf.spec.ts`、`tracking.ts`、新增 1 个 spec | `npm run test` 连跑 3 次全绿；单跑耗时不变；新单测覆盖计数 | 单 commit `git revert` |
| **B2** | 收敛 P1-3：`types.ts` 增 `offlineOk<T>()`，替换 6 处 | `types.ts` + 4 个 api 文件 | `npm run type-check && npm run test`（api.spec 逐字段不变） | 单 commit `git revert` |
| **B3** | 采集 P1-5：开 v8 coverage，增 `test:coverage`，**不设阈值** | `vitest.config.ts`、`package.json` | `npm run test:coverage` 出报告 | 移除配置项 |
| **B4** | 调查 P1-4：出「语义相同 / 不同」清单，只改相同项 | 待清单 | 每项改动附前后行为对比 | 按项回滚 |
| **B5**（暂缓） | P2-6：显式化 `maximumFileSizeToCacheInBytes`，再评估 runtimeCaching | `vite.config.ts` | `dist/sw.js` 条目与字节无意外变化 | 单 commit |

## 5. 执行记录

### B1 测试稳定性 + 埋点可观测（PR #244，已合）

- 改动：`vitest.config.ts` 全局 `testTimeout: 15_000`；两个 2000 次串行 IndexedDB 写入用例显式 `30_000`；`tracking.ts` 增 `rejected`/`dropped`/`lastError` 计数与 `trackingHealth()` / `resetTrackingHealth()`；新增 `tracking.health.spec.ts` 三条路径（非法 category、超长 event、存储异常）。
- 根因（比预想更深一层）：不仅是「断言阈值 10 s 高于默认超时 5 s」，更在于**超时中断后写入循环仍在后台跑**，污染同文件后续用例——这解释了历史两次不同红法（`expected 853 to be 1000`、白名单用例 `expected 1 to be +0`）。
- 验收：`npm run test` 连跑 3 次全绿（384 tests / 45 files）；`npm run type-check` exit 0；CI 14/14 通过（Biome 首轮因格式化失败，已在同一分支补 `style(test)` commit）。
- 未覆盖：CI 机器快，历史上恰好未踩中 5–10 s 区间；本次修复不等于证明所有机器都稳，仍需观察。

### B2 离线兜底收敛（PR #245，已合）

- 改动：`src/services/api/types.ts` 增 `offlineOk<T>()`；替换 `auth.ts:45,65`、`garden.ts:52,72`、`records.ts:114`、`teas.ts:76` 六处手写对象，返回结构逐字段不变。
- 验收：`npm run type-check` exit 0；`vitest run src/services/api` 通过；rebase 到含 B1 的 main 后 CI 全绿。

### B3 覆盖率采集（PR #246）

- 改动：新增 devDependency `@vitest/coverage-v8`；`vitest.config.ts` 加 `coverage`（provider v8、`text-summary` + `lcov`、排除 `src/**/*.spec.ts` / `src/test/**` / `src/data/**` / `src/main.ts`）；`package.json` 加 `test:coverage`；**不设阈值**。
- 基线（首次实测）：Statements **29.84%**（2272/7612）、Branches **33.24%**（1219/3667）、Functions **33.18%**（450/1356）、Lines **30.25%**（2064/6821）。
- 读法：44 个 spec / 214 个源文件，行覆盖只有三成——说明「测试数量」与「关键路径覆盖」是两件事。两周后再决定门槛，且门槛应从实测分布推出，不从愿望推出。
- 顺带观察到（**未改**）：单次覆盖率跑创建 45 次 jsdom 环境、环境类开销 155 s，占 59%；若后续要提速可评估 `pool`/`isolate` 配置，属独立议题。

### B4 localStorage 收敛调查（结论：不做批量替换）

实测生产代码 14 处直调（不含测试），分三类语义，**没有「语义相同」的批量收敛项**：

| 位置 | 语义 | 与 `utils/storage` 的差异 |
|---|---|---|
| `stores/theme.ts:12,24` | 纯字符串标量（主题 id） | utils 只有 JSON API，无字符串 API |
| `services/aiSession.ts:10,21,29` | 纯字符串 + `Number.isInteger` 校验 | 同上，且需数值合法性判断 |
| `services/telemetry/identity.ts:39,41,72,88` | 纯字符串 + 内存降级 | utils 不保留进程内 fallback |
| `services/authStorage.ts:15,27,35` | JSON + token 形状校验 | utils 的 fallback 语义不做形状校验 |
| `services/storage/db.ts:161,176,190,202` | 一次性历史数据迁移读取 | 迁移专用，读完即弃 |

结论：为形式统一新增字符串 API 属「为抽象而抽象」，且 `utils/storage` 的静默 false 返回与各处 `null`/内存降级语义不同，替换会改变失败行为。**保持现状**，只留此清单；若将来出现第三处同语义调用再重构。

### B5 PWA 缓存分级（暂缓，待拍板）

现配置靠 workbox 默认 2 MB 上限挡下 2K 贴图（4.57 MB / 137 条预缓存）。显式化上限不改变行为、风险低；改成 runtimeCaching 会牺牲离线首访完整性，需单独决策。

## 6. 未验证 / 本轮不宣称

- 后端全量 `mvn test` 未重跑（需 Docker + Testcontainers，Docker 已停）；以 main CI 绿为旁证，不作为本地基线。
- 无 Lighthouse / APM 数据 → 不宣称渲染或 API 延迟瓶颈，只报包体与缓存事实。
- `docker-compose.yml:43-44` 仍 `build: ./backend`（旧 FastAPI），运行状态未验。

## 7. 明确不做

拆 3D 大文件；拆 `AiChatService`（承重墙，24 方法只观察）；给 `CultureSearchService` 叠 `@Cacheable`；引入新依赖或新抽象层；目录大搬迁。
