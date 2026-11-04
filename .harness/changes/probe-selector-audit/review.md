# probe-selector-audit 评审记录（6 维）

> 评审对象：`fix/probe-selector-audit` 未提交改动（基线 main `5a70b4f`）。
> 评审日期：2026-11-04。评审方式：读全量 diff + 实跑（审计脚本、单测、两个探针、verify-harness、context-budget）+ 对抗用例。

## 结论

🔴 1 🟡 9

## 一、正确性

**🔴 1（gate integrity）`// PROBE-ALLOW` 是文件级全量豁免，等于永久后门。**
`audit-probe-selectors.cjs:34` 用 `ALLOW_RE` 取文件内**第一条**豁免行，`main()` 第 93–103 行把该文件**所有**死选择器整体转入 `exempted`（只 printf 一行 ⚠，不进 `ERRORS`、不改退出码）。一条注释即可静默某个探针的全部判据，且无预算、无同因去重、无到期。
项目自身对豁免的既定判据相反：`audit-redlines.cjs:50` 写明「豁免是预算不是通道」，第 65–76 行落地 `R2_ALLOW_BUDGET = 3` + 同一理由 ≥3 处报错。
FIX：镜像 R2 —— `PROBE_ALLOW_BUDGET = 3`；同一理由出现 ≥2 处报错；豁免条数写进 `ERRORS`（或 CI 额外断言「豁免 0 处」）。
See：`.harness/rules/编码规范.md` §五 R2、`scripts/audit-redlines.cjs:48-78`。

**🟡 2 判据只覆盖 6 个方法，id 选择器完全不在判据内。**
`SEL_RE_LIST`（第 29–33 行）只匹配 `locator/click/isVisible/waitForSelector/fill/hover/dblclick`。实测（导出纯函数直调）以下全部静默通过：`page.locator('#dead-panel')`、`page.selectOption('.dead-select')`、`page.$('.dead-el')`、`page.getByTestId('x')`、`page.isChecked('.dead-box')`。src 现有 9 处 `id="…"` 模板属性，id 选择器无任何判据。
FIX：token 增加 `#id`（回 src 查 `id="x"`）；方法集扩 `selectOption/check/uncheck/isChecked/textContent/boundingBox/$/$$/waitFor/dispatchEvent`。

**🟡 3 字面命中是「整份 src 文本包含」，跨文件串味造成真漏报。**
对 main 版 `verify-controls.cjs` 跑新审计，只报 `.plant-btn-3d` / `.tea-select-item` / `.dialog-btn(.confirm)`（4 条），`.empty-hint` **静默通过** —— 因为它在 `SelectView.vue:164`、`TeaDragDrop.vue:341` 存在，而茶园页没有。这正是本切片要治的「跑得过验不到」。
FIX：判据加定位约束（命中须落在目标路由的组件树内），或至少按文件切分 src 文本并排除 `__tests__` / `*.spec.ts`。

**🟡 4 `[data-*]` 只验属性名不验值；`[title*=]` 等变体不抽取。**
`[data-role="deleted-value"]` 在 src 只有 `data-role="ok"` 时静默通过（实测）；`[title*="雨"]` 完全不进 token（实测静默）。`[title="…"]` 精确值有校验 ✔。
FIX：`[attr="value"]` 连值一起校验；`[title*=`/`^=`/`$=` 至少降级为 warning，不静默丢。

**🟡 5 模板字符串插值会误报。**
实测 `` page.locator(`.item-${i}`) `` → 报「选择器 .item-${i} 在 src/ 命中 0 次（item-）」。当前 0 处使用，属潜在假阳性；动态下标探针一写就红。
FIX：选择器含 `${` 时跳过，并计入「未覆盖」清单打印，不判红。

**🟢 6** 三条引号正则本身正确：单引号内含双引号（`'[title="浇水"]'`）能取到 ✔；双引号内含单引号、模板字符串均覆盖 ✔（单测 6 例全绿，`node --test` pass 6/0）。

## 二、覆盖缺口（删除两个探针）

**🟡 7 前端↔后端茶园同步：读路径仍活着，覆盖降到 0。**
`GardenView.vue:101` 仍 `Promise.all([gardenApi.list(), energyApi.summary()])` → `plants3d` → `TeaGardenSceneInner` 渲染。但：`src` 无 garden 相关 spec；`e2e/garden.spec.ts` 不登录（list 走到 mock/401）；唯一集成探针 `verify-garden-sync-e2e.cjs` 本次删除。写路径 `gardenApi.create` 已无调用方（只剩导出）。
FIX：要么在 summary 明确登记「茶园同步读路径无自动化覆盖」为已接受缺口，要么补一个只验 list→渲染的最小探针（登录 + 固定数据）。

**🟡 8 summary 的删除理由可被代码反证。**
`summary.md:45` 称「`plantId` hitbox 在纯观赏场景下为 `null`，脚本恒输出空结果」。实际 `TeaGardenSceneInner.vue:163-174` 仍为每株后端茶树建 `userData.plantId` hitbox。真因是探针无登录态 + 种植 UI 已删，造不出前置状态。
FIX：理由改为「前置状态不可再造」，不写「恒为 null」。

**🟢 9** 3D 茶树视觉无实质缺口：`verify-gardens.cjs`（四园晴雨截图）、`verify-field.cjs`（茶行实例数）、`e2e/garden.spec.ts`（canvas / 天气按钮 / 亭子引文）在。丢失的只是「已登录且有多株茶树时的单株近景裁切」，登记即可。

## 三、切除精确性（verify-controls / verify-field）

**🟡 10 挂载守卫只护了第 1 段，其余 evaluate 仍会在未挂载时抛。**
守卫在 `verify-controls.cjs:18-20`，但第 46–51、64–69、76–81 的 `page.evaluate` 没有 `if (!g) return null`。守卫超时后 `g.activeCamera()` 抛 TypeError → unhandled rejection → 进程退出 1 **且不打 `ERRORS:` 行**；而第 20 行文案说「后续断言可能为空」，与真实行为（崩）不符。
FIX：三处 evaluate 统一 `const g = window.__teaGarden; if (!g) return null;`，随后 `null` 时 push 一条 ERR 并正常走 `ERRORS:` 契约。

**🟡 11 切除后两个探针只剩日志，没有断言 —— 「跑得过验不到」没治到根。**
实跑 `node scripts/verify-controls.cjs`（dev server 5173）：`CONTROLS: {"found":true,"domElement":false,"hasListeners":null}` —— `enableRotate/enablePan/enableZoom/enabled` 全 undefined（`controls()` 返回 TresJS 组件 ref，不是 three 控制器）；`CAM_BEFORE≠CAM_AFTER` 不判失败；`ERRORS: []`、退出 0。
实跑 `node scripts/verify-field.cjs`：`FIELD: {"found":true,"bushes":81,"trunks":90,"shadeTrees":0}` —— `shadeTrees` 恒 0，因为遮阴树走 InstancedMesh（`tea-tree.ts:201/232`），探针只在「非 instanced Mesh」分支计数；`bushes/trunks` 用 `=` 赋值会被后续 InstancedMesh 覆盖，数字含义与 README 新写的「茶行实例数」不符；退出 0。
FIX：加最小断言（`camBefore` 与 `camAfter` 不同、`bushes>0 && trunks>0`）；shadeTrees 改为按 geometry 分类累加或从输出删掉；README 只写实测能验的项。

**🟢 12** 两个文件切除后自身干净：无残留未用变量、无孤立 import、无悬空注释；三个被删截图的文件名（`verify_3d_controls_water.png` / `verify_field_planted.png` / `verify_3d_tea_crop.png`）全仓 0 引用。

## 四、接线（package.json / ci.yml）

**✔ 结论：接线正确。**
- `verify` = static → redlines → harness → context → probes。五步全只读、无共享状态，顺序无副作用；`&&` 短路符合既有约定。
- CI 新步骤落在 `harness-consistency` job，该 job 无 `npm ci`，但审计只用 `fs`/`path`（与相邻 `node --test`、`audit-redlines` 同族），不会因缺依赖失败。
- job 数仍 14（`verify-harness.cjs` 实测：`ci.yml 14 […] vs AGENTS.md 声明 14`）。
- 无 npm/CI 残留引用已删两个探针（`package.json`、`ci.yml` grep 0 命中）。
- vitest `include: ['src/**/*.spec.ts']`，不会与 `node --test scripts/tests/*.node-test.cjs` 重复跑。

**✔ 13（已闭环）** 评审前分支 `npm run verify` 是红的：`.harness/changes/probe-selector-audit/review.md` 缺失（`verify-harness.cjs:387`，实测 `ERRORS: [1]`）。本文件落盘后 `npm run verify` 五步全绿（实测 `VERIFY_EXIT=0`）。

## 五、一致性

**🟡 14 治理文档漂移**：`docs/architecture/backend-migration-status.md:104` 仍以 `scripts/verify-garden-sync-e2e.cjs:31` 为已修证据，文件已删、行号锚点失效。
FIX：该条补「（脚本已于 2026-11-04 退休，证据见 `.harness/changes/probe-selector-audit/`）」。

**🟢 15** `scripts/README.md` 把 `verify-controls.cjs` / `verify-field.cjs` 同时登记在 39 行与 48 行（同表重复），建议二选一。

**🟢 16** `AGENTS.md` §11 未登记新门禁。常驻层预算实测 19455/19500（剩 45 token），**不建议新增行**；建议把第 155 行括号改为「含 redlines/harness/预算/探针选择器」。

## 六、安全 / 性能 / 架构合规

- **安全（✔）**：审计只读本地 `src/`，无网络、无子进程、不打印任何凭证；删除 `verify-garden-sync-e2e.cjs` 顺带移除了 `TEA_PG` 口令管道与临时 `backend/_pgq.py` 落盘写法（正向）。
- **性能（✔）**：一次 `join` 全 src 文本 + 每 token 一次 `includes`，量级为 MB 级字符串，可忽略。
- **架构合规（✔）**：不触 `src/`、不动分层与数据流（R12）、不引新依赖、无 R1/R3/R7/R9/R10/R11/R14 触面；新增门禁仍守 `ERRORS: [...] + 退出码` 同族契约。

## 已接受 / 不阻塞

- 🔵 `summary.md:34-36`「实测崩过一次（>4.5s）」为历史断言，本轮未复核（dev server 冷启动后探针直接跑绿）。
- 🔵 `gardenApi.create` 为存量无调用导出（死代码），不在本切片范围。
- 🔵 审计只扫 `scripts/` 顶层 `.cjs`：`e2e/*.spec.ts`（含 `.plant-card` `toHaveCount(0)` 这类「结构消失」断言）与 `scripts/tests/` 不在范围，同族风险留待后续。

## 处置结果（2026-11-04，评审后逐条修复）

🔴 与 🟡 全部处置，明细见 `summary.md` §五（含落点文件与实测）。要点：

- 🔴 `PROBE-ALLOW` 升级为「预算不是通道」：`PROBE_ALLOW_BUDGET=3`、同因 ≥2 处报红、每处理由逐条打印。
- 🟡 判据补齐 `#id`、`[attr="值"]`（名=值整对命中）、方法集扩到 `selectOption/isChecked/isDisabled/$/$$/getBy*`、插值选择器进「未覆盖」清单。
- 🟡 两个探针补最小断言并验证有牙齿（去掉拖拽 → 2 条 ASSERT、`EXIT=1`）；`bushes` 改累加（81→392 证明旧值只取最后一批）；删除恒 0 的 `shadeTrees`。
- 🟡 文档：crop 删除理由改写；「读路径同步零覆盖」与「token 全仓串味」登记为已接受缺口；`backend-migration-status.md` 补退役注记；README 去重；AGENTS §11 原地扩写。

**重跑实测**

```
node --test scripts/tests/*.node-test.cjs  → 5 文件 83 例全绿
node scripts/audit-probe-selectors.cjs     → ERRORS: []  EXIT=0
node scripts/verify-controls.cjs           → VERIFIED: orbit-drag-and-zoom  ERRORS: []  EXIT=0
node scripts/verify-field.cjs              → FIELD {found:true,bushes:392,trunks:401}  ERRORS: []  EXIT=0
npm run verify                             → 五段 ERRORS: []
```

**结论：🔴 0 / 🟡 0 — 清零通过**
