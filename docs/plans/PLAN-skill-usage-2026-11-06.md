---
last_updated: 2026-11-06
status: active
owner: yanha
---

# PLAN-skill-usage-2026-11-06（v3.2 · 批 A/B 已落地）

> 门 1 产物（plan-control）。v2 只治「看不见」，v3 补「做不到」与「会过期」，v3.1/v3.2 把批 A/B 从估算换成实测。状态：**批 A、批 B 已完成并全绿，批 C 待批准**。

## 第一原理

> **Skill 的价值 = 独有知识 × 被读到的概率 ÷ 上下文成本**

三种独立的失效，分别度量、分别设防：

| 失效 | 本质 | 确定性度量 | tea 实测（**已真跑，非估算**） |
|---|---|---|---|
| **看不见** | 元数据超客户端预算被截断 | 100 token × 技能数 vs ≈2K | 109 个 ≈ 10900 token，超 5 倍 → 同时可见上限 ≈ 20 个 |
| **做不到** | 正文只有"怎么做"，模型每次现场推导 | 引用 `scripts/` 的次数 + 命令行步骤数 | **89 / 109 纯文档**（6 可执行、14 半可执行）；**63 个脚本里 57 个零技能引用** |
| **会过期** | 引用的路径/命令已不存在 | 反引号锚点存活（排除模板/通配/路由） | 自写 43 个技能 78 条锚点，**真失效 0**；导入包 115 条属上游路径，不同源 |

结论：**tea 最大的资产不是 109 个技能，是 `scripts/` 下 63 个确定性脚本；最大的浪费是 89 个技能还在教模型"怎么做"，而 57 个脚本没有任何技能指向它。**

## 批 A 已落地（实测证据）

| 动作 | 命令 | 结果 |
|---|---|---|
| 可执行化审计器 | `node scripts/audit-skill-tooling.cjs --write` | 109 技能 / 63 脚本 / 6 可执行 / 14 半可执行 / 89 纯文档 / 57 孤儿；引用异常 0；`node --check` 全部可解析 |
| 审计报告 | `docs/reference/skill-tooling-audit.md` | 自动生成（放 reference 而非 docs/skills，避免撞 AGENTS.md §12 声明与常驻预算） |
| 锚点存活门禁 §4m | `node scripts/verify-harness.cjs` | 首轮 `ERRORS: []`（自写层真失效 0） |
| 门禁反例 | 植入 `docs/zz-dead-anchor.md` + `docs/zz-YYYY-MM-DD.md` | **真失效报 1 处、exit 1；模板占位不报**；恢复后 exit 0 |
| 回归 | `node --test scripts/tests/*.node-test.cjs` | **121 pass / 0 fail** |
| 预算 | `node scripts/audit-context-budget.cjs` | **19480 / 19500 exit 0**（未动常驻层） |

已接上脚本层的 6 个技能：`quality-audit`、`retro`、`session-handoff`、`01-feature-dev`、`18-3d-scene`、`agent-eval`。

## 三个决策（批 B/C）

1. **分层**：活跃层 ≤ 20（进元数据）+ 储备层 89（只在 README 归档表登记，人工点名才 Read）。
2. **可执行化下沉**：活跃层每个技能至少挂 1 条确定性命令，优先复用现有 57 个孤儿脚本，不新写。
3. **升层靠使用**：储备技能被真实任务点名 ≥3 次才升；活跃技能连续 3 切片零调用则降。

## 批 B 已落地（实测证据，2026-11-06 复算）

| 动作 | 结果（全部复跑实测） |
|---|---|
| 技能接线 | 19 个活跃层技能补「## 确定性入口」或「## 踩坑（真实教训）」；素材 100% 取自 `docs/plans/lessons.md` |
| 入口覆盖 | **16 / 20** 有确定性入口段（缺 request-analysis、caveman-review、shadcn、design-md-collection） |
| 踩坑覆盖 | **14 / 20** 有踩坑段（缺 tea-tasting、shadcn、retro、01-feature-dev、18-3d-scene、design-md-collection） |
| 可执行化 | 可执行 **6 → 15**；半可执行 14 → 11；纯文档 **89 → 83**；孤儿脚本 **57 → 47**（脚本总数 63） |
| 元数据 | 活跃层 20 个 **2080 字符 ≈ 997 token**（目标 ≤2000，达标） |
| 描述瘦身 | `shadcn` 411 → 190、`design-md-collection` 337 → 157；活跃层单条全部 ≤ 250 |
| 引用真实性 | 20 个技能正文 `scripts/` 引用 21 处，**缺失 0 处**（逐条 existsSync 核验） |
| 回归 | verify `ERRORS: []`、121 pass / 0 fail、常驻 19480 / 19500 |

新接线的 10 个：db-migration、plan-control、frontend-design、coding-skill、fastapi-endpoint、vue-component、arch-deepen、unit-test-ci、tea-voice、tea-tasting（另 quality-audit / retro / session-handoff / 01-feature-dev / 18-3d-scene 原已有脚本引用，本轮规范成入口段）。

## 批 C 待批准内容

- 储备层 83 个（含 20 个活跃层之外的 89 个中的导入包）在四族 README 末尾加「归档层」索引，不新增文件、不改常驻层。
- 分层依据与升降规则（储备被真实任务点名 ≥3 次则升；活跃连续 3 切片零调用则降）写进 `docs/reference/skill-tooling-audit.md` 的固定小节。
- 全库仍有 25 条 description 超 250 字符（全在 `.agents` 导入包：threejs / javascript / typescript / ui-styling / vue-axios / vue-testing），**均在储备层、不进任何客户端元数据**，批 C 只登记不压缩。

## 验收（批 B/C）

| 项 | 目标 | 实测 | 结论 |
|---|---|---|---|
| 活跃层 | ≤ 20 | 20 | ✅ |
| 活跃层元数据 | ≤ 2000 token | 997 | ✅ |
| 活跃层入口 | 20 / 20 | **16 / 20** | 4 个标 N/A 并写理由（见下） |
| 活跃层 Gotchas | 20 / 20 | **14 / 20** | 6 个无 `lessons` 素材，标 N/A，不编造凑数 |
| 全库可执行 | ≥ 50（原目标） | **15 / 109** | 原数字是估值，**按实测下调**——19 个 biz-dev 与多数导入包无可对应脚本 |
| 既有门禁 | verify exit 0 / 121 pass / 19480 | 全绿 | ✅ |

4 个无入口技能的判定（不做无依据的硬接）：

| 技能 | 判定 | 依据 |
|---|---|---|
| `request-analysis` | N/A | 纯流程型，产物是需求文档，无确定性脚本可挂 |
| `caveman-review` | N/A | 输出格式变体，评审走 `expert-reviewer`，不独立跑脚本 |
| `shadcn` | 可补 | 命令是 `npx shadcn@latest ...`（非 `scripts/` 前缀，审计器不计入可执行） |
| `design-md-collection` | N/A | 纯参考库，动作是 Read `brands/<name>/DESIGN.md` |

## Not Doing

- 不给 `.agents` 导入包加锚点检查（115 条是上游路径，检查只产生假阳性）。
- 不做 model-invoked / user-invoked 分层（README 路由表 + Read 正文已是 router 等价物）。
- 不合并 `db-migration` 双份（Alembic vs Flyway）。
- 不给 89 个储备技能补 Gotchas（素材不存在，编造违反 §0.3）。
- 不改常驻层（余量 20 token）。

## 回滚

全部未提交，逐文件 `git diff`；新增两个产物（`scripts/audit-skill-tooling.cjs`、`docs/reference/skill-tooling-audit.md`）删除即可；§4m 是 verify-harness.cjs 内一段独立代码，删除该段恢复原状。

## 已知风险

1. 孤儿脚本未必无用（部分只服务 AGENTS.md §11 命令入口）→ 批 B 连线须逐个人工确认，不按名字猜。
2. 20 个活跃层是初始猜测，真实使用数据（`audit-skill-usage` 38 切片 0 记录）三个月后才可信 → 分层必须可调。
3. §4m 只覆盖以已知根开头的路径（`docs/ scripts/ src/ backend/ …`），不覆盖 `services/api/` 这类相对片段 → 覆盖率不是 100%，靠自写层自觉使用全根前缀。
