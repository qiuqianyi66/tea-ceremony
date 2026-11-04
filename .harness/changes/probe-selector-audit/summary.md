# probe-selector-audit 变更记录

> 目录：`.harness/changes/probe-selector-audit/`，与 git 分支 `fix/probe-selector-audit` 同名。
> **无数据库迁移**（只改探针脚本 + 新增一个审计门禁 + 脚本索引），故不含 `db-migrations.sql` / `rollback.sql`。
> **ADR：本切片不涉架构决策、数据模型或接口契约**，按 L1/L2 处理，无需 ADR。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | probe-selector-audit（探针死选择器审计 + 死探针退役） |
| 分支 | `fix/probe-selector-audit`（基于 main `5a70b4f`） |
| 需求来源 | 继续上一轮的 water 探针发现：把「探针验证已删除功能」当成一类问题全仓扫一遍 |
| 类型 | fix（工具可靠性） |
| 涉及范围 | 新增 `scripts/audit-probe-selectors.cjs` + 其单测 + 3 个探针清死分支 + 退役 2 个探针 + `package.json` verify 链 + CI 1 步 + `scripts/README.md` |

## 二、需求与方案

### 现状（实测 2026-11-04）

用一次性脚本把 `scripts/*.cjs` 里出现的字面选择器拆成 token，回 `src/` 查字面命中，结果 **15 处命中 0**：

```
verify-controls.cjs     .plant-btn-3d / .tea-select-item / .dialog-btn(.confirm)
verify-field.cjs        .plant-btn-3d / .tea-select-item / .dialog-btn.confirm
verify-garden-3d-crop.cjs       同上
verify-garden-sync-e2e.cjs      .plant-btn-3d / .tea-select-item / .dialog-btn.confirm / .plant-detail / .dialog-btn.harvest
```

共性根因：T4.1 把茶园降级为纯观赏，**种植 / 浇水 / 修剪 / 采摘链路已从 `src/` 删除**（`.plant-btn-3d` 全仓 0 命中、
IndexedDB `gardenPlants` store 也已不存在），但探针仍按旧交互写，于是「跑得过、验不到」。

另有两处附带发现：
1. `verify-controls.cjs` 冷启动时直接读 `window.__teaGarden`，Vite 首次编译该路由超过 4.5s 会抛 TypeError——
   实测崩过一次（探针自己崩，会被误读成「功能坏了」）。
2. `scripts/README.md` 的 3D 茶园表登记了 3 个**不存在**的脚本（`verify-garden-3d-interact.cjs` / `-phase4.cjs` / `-phase5.cjs`），属存量索引漂移。

### 功能点

- **F1**：新增 `scripts/audit-probe-selectors.cjs`——探针里出现的 class / `[title=…]` / `[data-*]` token
  在 `src/` 字面命中 0 即红（`ERRORS: [...]` + 退出码），带 `// PROBE-ALLOW: <理由>` 豁免（理由须 ≥8 字且含 ≥6 个文字/数字）。
- **F2**：`verify-controls.cjs` / `verify-field.cjs` 清掉死交互分支（保留各自真实断言：OrbitControls 拖拽缩放 / 茶行地形实例数），
  并给 `verify-controls.cjs` 加挂载守卫（等 `window.__teaGarden` 出现再读）。
- **F3**：退役 `verify-garden-sync-e2e.cjs`（验证对象是种植→同步→采摘，功能已删且 IndexedDB `gardenPlants` store 已不存在）
  与 `verify-garden-3d-crop.cjs`（前置步骤是种茶；真因是**探针无登录态 + 种植 UI 已删，造不出「已种多株茶树」的前置状态**——
  注意 `TeaGardenSceneInner.vue:163-174` 仍为后端茶树建 `userData.plantId` hitbox，纯观赏场景没有数据时 `scan` 恒为 `null`）。
- **F4**：`npm run verify` 增加 `verify:probes`；CI `harness-consistency` job 增加 `node scripts/audit-probe-selectors.cjs` 步骤（job 数仍 14）。
- **F5**：`scripts/README.md` 修正 3D 茶园表：删掉 3 个不存在的脚本，登记新增的审计脚本与保留的两个探针。

### 不做什么

- **不恢复种植/浇灌功能**：产品按 T4.1 主动删除，恢复属新需求 + ADR，不是探针修复。
- **不要求「所有脚本都进 README」**：实测 67 个脚本里 20 个未登记，补齐是大工程，本切片只修「登记了但文件不存在」这半边。
- **不把选择器审计扩到运行时 DOM 校验**：那需要 dev server，与「CI 里能跑」冲突；运行时拼接的选择器本审计看不到（明确边界）。
- 不动其余探针的断言，不改 `verify-gardens.cjs` / `verify-pavilion.cjs`。

### 已接受的覆盖缺口（登记，不假装没有）

1. **茶园「读路径」同步无自动化覆盖**：`GardenView.vue` 仍 `Promise.all([gardenApi.list(), energyApi.summary()])` → `plants3d` → 3D 渲染，
   但唯一覆盖该链路的集成探针（`verify-garden-sync-e2e.cjs`）已退役，`e2e/garden.spec.ts` 不登录态、`src/` 无 garden 相关 spec。
   本次接受该缺口：造前置状态需要写接口 + 登录态，属新增探针工程量，列为后续候选。
2. **token 命中是「全仓」判定**：同一 class 只要在别的组件存在，本路由下已删除的用法就查不出来（例：`.empty-hint`
   仍存于 `SelectView.vue` / `TeaDragDrop.vue`，茶园页已无）。修它需要「路由 → 组件可达性」分析，超出本审计范围。
3. **运行时拼接选择器不参与判定**：`page.locator('#' + id)`、模板插值 `` `.item-${i}` `` 被跳过并打印在「未覆盖」清单里。

### 验收标准（Given-When-Then）

- **F1-a** **Given** 某个探针引用 `.plant-btn-3d`（src 无此 class），**When** 跑 `node scripts/audit-probe-selectors.cjs`，
  **Then** `ERRORS` 含该文件与该选择器，退出码 1。
- **F1-b** **Given** 探针只用 src 里存在的 class / title，**When** 跑同一命令，**Then** `ERRORS: []`、退出码 0。
- **F1-c** **Given** 探针写了 `// PROBE-ALLOW: <不合格理由>`，**When** 跑同一命令，**Then** 报「理由不合格」而不是静默通过。
- **F1-d** **Given** 属性选择器写成 `'[title="浇水"]'`（单引号内含双引号），**When** 跑同一命令，**Then** 能取到 title token（旧实现用一条 `[^'"`]+` 正则会整段漏报）。
- **F2-a** **Given** 本地 dev server 在 5173，**When** 跑 `node scripts/verify-controls.cjs`，**Then** 打印 CONTROLS/CAM_BEFORE/CAM_AFTER/ZOOM_AFTER 且 `ERRORS: []`。
- **F2-b** **Given** 同一环境，**When** 跑 `node scripts/verify-field.cjs`，**Then** 打印 `FIELD: {found:true,…}` 且 `ERRORS: []`。
- **F3-a** **Given** 当前仓库，**When** 查 `scripts/` 下 garden 相关脚本，**Then** 只剩 `verify-gardens.cjs` / `verify-garden-ambient.cjs`。
- **F4-a** **Given** CI `harness-consistency` job，**When** 探针死选择器审计失败，**Then** job 失败。
- **F5-a** **Given** README 索引，**When** 抽取其中反引号包裹的脚本名，**Then** 除退役说明中的历史提法外，全部真实存在。

### 技术方案

1. 审计脚本导出纯函数 `findDeadSelectors(scriptText, srcText)` 与 `normalizeReason(raw)`，供 `node --test` 覆盖（6 例）。
2. 选择器抽取用三条正则分别匹配单引号 / 双引号 / 模板字符串，避免「单引号里含双引号」被截断（实测漏报点）。
3. 判据用「字面命中」而非 DOM 实测：CI 无 dev server，且 Vue 模板里的 class 是字面量，误报风险低。
4. 三处死分支用行级精确切除（先断言边界行内容，不匹配就报错退出，避免切错位置）。
5. 索引漂移只在「登记了但文件不存在」方向检查，另一方向列为债务。

**双向论证**

- **选 A（机械化审计 + 进 CI）的理由**：这坑已发生两次（water 探针一轮、本次又 4 个脚本），靠人肉 grep 不可持续。
- **否 B（只修脚本不加门禁）的理由**：下次再删 UI 节点，同样的坑会第三次出现，且没人会主动去扫。
- **否 C（审计用 Playwright 实测 DOM）的理由**：要 dev server + 浏览器，进不了无依赖的 CI job，等于没门禁。
- **反转条件**：若某个合法探针必须引用不存在的节点（例如验证空态兜底），用 `// PROBE-ALLOW:` 写明理由；
  若豁免超过 3 处，说明判据过严，应改为按目录白名单而不是继续加豁免。

## 三、影响分析

- **新增门禁**：`npm run verify` 与 CI 各多一步；当前全仓命中 0，属「先清干净再上锁」。
- **删除物**：`verify-garden-sync-e2e.cjs`（8.1 KB）与 `verify-garden-3d-crop.cjs`（3.0 KB），均无 npm/CI 引用；
  改前完整 Read，且实测其断言在当前代码下已无法成立。
- **行为变化**：`verify-controls.cjs` 多了挂载守卫（等待最多 20s），冷启动不再假崩。
- **承重墙确认**：不触 `teaAI.ts` 降级链、IndexedDB `sync_status`、评分模型、3D 状态机、PWA 缓存、后端分层。
- **回滚路径**：单 commit 回退（脚本 + 索引 + 门禁一行），无数据副作用；被删脚本在 git 历史可取回。

## 四、自检清单

- [x] 需求分析先行（F1-F5 + Given-When-Then + 范围边界 + 影响分析）
- [x] 轨道判定：**Guided**（多文件、可逆、无架构/数据模型变更）
- [x] 删除文件前完整 Read + 全仓 grep 引用 + 实测其断言已无法成立
- [x] 测试按改动面：`node --test scripts/tests/`（5 文件 77 例）+ `npm run verify`（含新 `verify:probes`）+ 三个探针实跑
- [x] 无数据库迁移（本文件顶部已注明）；ADR 不适用

## 五、评审处置（Codex 子代理，2026-11-04）

独立评审 6 维结论：🔴 1 / 🟡 9（另有 1 条当场闭环）。逐条处置：

| # | 结论 | 处置 | 落点 |
|---|---|---|---|
| 🔴 PROBE-ALLOW 是文件级永久后门 | 真：豁免不过预算、不进退出码 | 加 `PROBE_ALLOW_BUDGET=3` + 同因 ≥2 处报红 + 每次打印每处理由（与红线 R2 同规） | `scripts/audit-probe-selectors.cjs` |
| 🟡 只覆盖 6 个方法、id 不在判据内 | 真 | 方法集扩到 `selectOption/isChecked/isDisabled/$/$$/getByTestId/getByText/getByRole`；新增 `#id` token 与「裸值」（getBy* 参数）判定 | 同上 + 单测 3 例 |
| 🟡 `[data-*]` 只验属性名不验值 | 真 | 属性 token 改为「名=值」整对命中（`[attr*="v"]` 取 v） | 同上 + 单测 1 例 |
| 🟡 模板插值会误报 | 真 | 含 `${}` 的选择器跳过判定并计入「未覆盖」清单打印 | 同上 + 单测 1 例 |
| 🟡 跨文件 token 串味（`.empty-hint` 漏报） | 真，属方法边界 | 登记为「已接受的覆盖缺口」第 2 条（需路由→组件可达性分析） | 本文件 §四 |
| 🟡 删 sync-e2e 后「读路径同步」零覆盖 | 真 | 登记为「已接受的覆盖缺口」第 1 条 | 本文件 §四 |
| 🟡 crop 删除理由可被代码反证 | 真（`plantId` hitbox 仍在） | 改写理由为「无登录态 + 种植 UI 已删，造不出前置状态」 | 本文件 §二 F3 |
| 🟡 挂载守卫只护了第 1 段 | 真 | 三处 `evaluate` 全部补 `if (!g) return null`（不抛 TypeError） | `scripts/verify-controls.cjs` |
| 🟡 两个探针切除后零断言 | 真 | 补最小断言：拖拽/滚轮必须改变相机（位移 > 0.01）、茶行 `bushes>0 && trunks>0`；`VERIFIED` 行与断言结论联动 | 两个探针 |
| 🟡 `shadeTrees` 恒 0、`bushes` 赋值被覆盖 | 真 | 计数改累加（实测 81 → 392，证明旧值只取到最后一批）；删除 `shadeTrees` 误导指标 | `scripts/verify-field.cjs` |
| 🟡 治理文档漂移（migration-status 指向已删脚本） | 真 | 补退役注记 | `docs/architecture/backend-migration-status.md` |
| 🟢 README 重复登记 / AGENTS §11 未提新门禁 | 真 | README 去重；AGENTS §11 原地扩写括号（不新增行，常驻预算 19458/19500） | 两处 |

**断言有牙齿的实测**（变异验证）：把 `verify-controls.cjs` 的拖拽序列整段去掉 →
`ERRORS: ["ASSERT: 拖拽未改变相机位置（OrbitControls 可能失效）","ASSERT: 滚轮未改变相机位置（缩放可能失效）"]`、`EXIT=1`；
恢复后 `VERIFIED: orbit-drag-and-zoom`、`ERRORS: []`、`EXIT=0`。

**重跑实测**

```
node --test scripts/tests/*.node-test.cjs  → 5 文件 83 例全绿
node scripts/audit-probe-selectors.cjs     → ERRORS: []（全仓 0 命中）
node scripts/verify-controls.cjs           → VERIFIED: orbit-drag-and-zoom  ERRORS: []  EXIT=0
node scripts/verify-field.cjs              → FIELD {found:true,bushes:392,trunks:401}  ERRORS: []  EXIT=0
npm run verify                             → 五段 ERRORS: []
```

**结论：🔴 0 / 🟡 0 — 清零通过**（残留边界登记在本文件 §四「已接受的覆盖缺口」）

## 六、追加发现（本切片自测时暴露，已修）

跑 `eval-harness probe-selector-audit --verify` 时「安全合规」只给 60/100，查因发现 2 处误报——两个都来自**删除行**：

1. `git diff --name-only HEAD~5` 把被删脚本里的 `.venv/Scripts/python.exe` 当成「提交禁目录」；
2. 密钥正则扫整段 diff，把被删测试夹具里的明文口令当成「引入密钥」（删掉凭据本该是好事）。

修法：路径级判定改用 `--diff-filter=AM`（只看新增/修改）；密钥判定只扫**新增行**（`^+` 且非 `+++`）。
复跑 `gate-reliability` 与 `probe-selector-audit` 两切片，安全合规均恢复 100/100。

顺带记一条写作纪律：这条修复的注释初稿里写了口令字面量，被同一个正则自伤 → 注释改为「含明文口令的测试夹具」。
**判据文本自己也受判据约束**，别再在注释里复述敏感样例。
