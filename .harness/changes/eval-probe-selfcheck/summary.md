# eval-probe-selfcheck 变更记录

> 目录：`.harness/changes/eval-probe-selfcheck/`，与 git 分支 `fix/eval-probe-selfcheck` 同名。
> **无数据库迁移**（只改评测脚本、探针脚本与脚本索引），故不含 `db-migrations.sql` / `rollback.sql`。
> **ADR：本切片不涉及架构决策、数据模型或接口契约**，按 L1/L2 处理，无需 ADR。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | eval-probe-selfcheck（评测器自查 + 失效探针退役） |
| 分支 | `fix/eval-probe-selfcheck`（基于 main `a9afd28`） |
| 需求来源 | PR #215 合并后逐项复核发现（用户指定「把这两个 + water 探针并成切片」） |
| 类型 | fix（工具自查可靠性） |
| 涉及范围 | `scripts/eval-harness.cjs` + `scripts/tests/eval-harness.node-test.cjs` + `.github/workflows/ci.yml`（1 步）+ 删除 2 个探针 + `scripts/verify-garden-ambient.cjs` + `scripts/README.md` |

## 二、需求与方案

### 现状（实测 2026-11-04）

1. **报告会被自己覆盖**：`eval-harness.cjs` 每次运行整体重写 `docs/agent-eval/<切片>-eval.md`，
   不含 docs 元信息头。PR #215 里手工补了 frontmatter 才让 `verify-harness` 转绿，但同一命令再跑一次就回退
   —— 修的是症状，不是生成器。
2. **ADR 判据假阳性**：流程维用 `/架构|ADR|迁移|数据模型/` 匹配 summary 正文，
   gate-reliability 切片因为写了「**无**数据库迁移」，被这句话里的「迁移」命中，判成 `ADR:✓`。
   该切片没有任何 `docs/ADR/` 改动。同一处还有第二个缺陷：`git log --name-only -- .harness/changes/<切片>`
   只列切片目录内的文件，`names.includes('docs/ADR/')` 永远为假——两个判据各错一边，凑出了错分。
3. **两个探针验的是已删除的功能**：`verify-water-rain.cjs` / `verify-water2.cjs` 的验证对象是
   「种茶 → 点茶树 → 浇水动画」。而 `src/views/GardenView.vue` 头注释写明：T4.1 起茶园降级为纯观赏，
   **删除种茶/浇水/修剪/采摘等养成链路**；`.plant-btn-3d` 在 `src/` 命中数 **0**。
   两个脚本因此只能打印 `VERIFIED: no-water-button（本次未验到浇水粒子）`，永久噪声。

### 功能点

- **F1**：`eval-harness.cjs` 生成报告时自带 docs 元信息头（`last_updated` / `status` / `owner`），
  使 `verify-harness` 的 doc-meta 检查在重跑后仍成立。
- **F2**：ADR 判据改为**文件证据驱动**——只看本切片各 commit 实际改动的路径：
  含 `docs/ADR/` → 适用且满足；含迁移脚本 / `db/migrations/` / `entity/` → 适用但未满足；都不含 → **不适用（n/a，不计入分母）**。
- **F3**：退役两个 water 探针（验证对象已被产品删除），抹掉 `verify-garden-ambient.cjs` 里同因的死播种分支，
  并同步 `scripts/README.md` 的脚本索引，使「探针存在」与「探针声称覆盖」一致。
- **F4**：把 `scripts/tests/*.node-test.cjs` 全量接入 CI（原来 4 个文件全部只手动跑；本切片新增的判据用例若不进 CI 等于没有牙齿）。

### 不做什么

- 不恢复浇水/种植功能，也不为它重建探针：功能是产品主动删的（T4.1），复活验证面等于让工具替产品开倒车。
  若将来要恢复养成链路，那是新需求 + ADR，不是探针修复。
- 不改其余 6 个已验证探针的判据，不改 `eval-harness` 的七维权重与阈值（改权重会破坏历史可比性）。
- 不动 `verify-garden-ambient.cjs` 的雨天/音效断言（它们仍然有效，实测绿）。
- **不改历史切片记录**：`gate-reliability` 的 `review.md` / `summary.md` 里仍提到被删的两个探针名——那是当时的实测留痕，
  不回改历史，只保证新文档与代码注释口径正确。
- **不解决 ADR 归属的批量提交串味**：一次改上百文件的批量 commit 无法把文件归给单个切片，
  实现上按「批量提交跳过并留痕」处理；`docs/agent-eval/` 下早于本切片的报告仍按旧口径产出，不回填。
- **不解决语义级数据变更的漏判**：只改 repository 内 SQL 或 service 内表语义而不动 entity/迁移文件的改动，
  路径证据看不见，仍需人工评审兜底（代码注释已写明该残留盲区）。

### 验收标准（Given-When-Then）

- **F1-a** **Given** 任意切片跑 `node scripts/eval-harness.cjs <切片>`，**When** 打开生成的报告，
  **Then** 第一行是 `---`，块内含 `last_updated` / `status: active` / `owner`。
- **F1-b（不回归）** **Given** 上述报告已落盘，**When** 再跑一次 `node scripts/verify-harness.cjs`，
  **Then** 不出现「docs/ 缺元信息头」警告，且 `ERRORS: []`。
- **F2-a** **Given** 切片只改 `scripts/` 与 `docs/`，**When** 跑评测，**Then** 流程维输出 `ADR:n/a（本切片未触数据模型/迁移）` 且分母不含 ADR。
- **F2-b** **Given** 切片改了 `db-migrations.sql` 或 `entity/` 但没写 `docs/ADR/`，**When** 跑评测，**Then** 流程维 `ADR:✗`（算未满足）。
- **F2-c** **Given** 切片含 `docs/ADR/` 改动，**When** 跑评测，**Then** 流程维 `ADR:✓`。
- **F3-a** **Given** 干净环境，**When** `Get-ChildItem scripts -Filter "*water*"`，**Then** 0 个结果。
- **F3-b** **Given** dev server 在 5173，**When** 跑 `node scripts/verify-garden-ambient.cjs`，
  **Then** 打印两张截图完成 + `ERRORS: []` + `VERIFIED:` 行明确说明「已删除的养成链路不在覆盖范围」。
- **F4-a** **Given** CI `harness-consistency` job，**When** 任一 `scripts/tests/*.node-test.cjs` 失败，
  **Then** job 失败（不再只有本地手跑才知道）。

### 技术方案

1. `eval-harness.cjs` 新增两个纯函数并导出：`metaHeader(date)`、`adrVerdict(changedFiles)`，
   报告用 `metaHeader` 打头；ADR 用「切片各 commit 的 `git show --name-only` 文件清单」判定，git 不可用时报 n/a 而不是猜。
2. 新增 7 条 node:test 用例锁上述行为（含 `metaHeader` 与 `verify-harness` 判据同构的断言）。
3. 删除 `verify-water-rain.cjs` / `verify-water2.cjs`；`verify-garden-ambient.cjs` 删死分支并在 `VERIFIED:` 行写明覆盖边界。
4. CI `harness-consistency` job 把原来的单文件 `node --test` 步骤扩成 `node --test scripts/tests/*.node-test.cjs`。

**双向论证**

- **选 A（生成器自带元信息头）的理由**：唯一能扛住「下次重跑」的修法；手补头部在运行期必然被覆盖。
- **否 B（继续手补 / 允许 eval 报告免检）的理由**：手补是不可持续的人工步骤；免检等于承认 `docs/agent-eval/` 是法外之地。
- **选 A（ADR 判据文件化）的理由**：文件路径是确定性证据，措辞不是。旧判据同时存在「正文关键词假阳性」与「git 路径永远为假」两处错。
- **否 B（删掉 ADR 这一维）的理由**：L3 切片确实需要 ADR 门槛，删掉会丢真实约束，正确做法是让它只在适用时计分。
- **选 A（退役 water 探针）的理由**：验证对象已被产品删除，保留只会产生永久「未验到」噪声，并让人误以为有覆盖。
- **否 B（改探针去验别的）的理由**：两个脚本的正交价值（雨天截图 + 无 console 错误）已被 `verify-garden-ambient.cjs` 覆盖，重复建设无收益。
- **反转条件**：若产品恢复养成链路，则按新需求重写探针（含粒子动画断言），而非复活旧脚本；若 ADR 判据对某个「只在 service 层改数据语义」的 L3 切片漏判，则把 `service` 也纳入触发表。

## 三、影响分析

- **CI**：`harness-consistency` job 多一个 `node --test` 步骤，job 数仍 14；新增被执行的测试文件 4 个（60+ 用例，本地全绿）。
- **评测口径变化**：非 L3 切片的流程维分母减少 1，历史报告分数不再与旧口径逐位可比；已重跑本切片与 gate-reliability 记录差异。
- **删除物**：2 个探针脚本（无 CI 引用、无 npm 链引用，已 grep 全仓确认仅 `scripts/README.md` 提及）。
- **承重墙确认**：不触 `teaAI.ts` 降级链、IndexedDB `sync_status`、评分模型、3D 状态机、PWA 缓存、后端分层。
- **回滚路径**：单 commit 回退即可（脚本 + 文档），无数据副作用；删除的两个探针在 git 历史里可取回。

## 四、自检清单

- [x] 需求分析先行（F1-F4 + Given-When-Then + 范围边界 + 影响分析）
- [x] 轨道判定：**Guided**（多文件、可逆、无架构/数据模型变更）
- [x] 删除文件前已完整 Read 并确认无独立价值（两个探针的正交覆盖 ⊂ garden-ambient；全仓引用核对：
      `scripts/README.md` 索引 + `gate-reliability` 切片的历史记录，后者属历史留痕不改）
- [x] 测试按改动面：`node --test scripts/tests/` + `npm run verify` + 实跑 `verify-garden-ambient.cjs`
- [x] 无数据库迁移（本文件顶部已注明）；ADR 不适用（本切片不涉架构/数据模型）
