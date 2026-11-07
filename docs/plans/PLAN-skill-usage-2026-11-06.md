---
last_updated: 2026-11-07
status: active
owner: yanha
---

# PLAN-skill-usage-2026-11-06（v3.3 · 批 A/B/C 已落地，残项收敛待批准）

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

## 批 C 已落地（与原计划有一处刻意偏差）

| 动作 | 结果 |
|---|---|
| 分层契约 | 新建 `docs/reference/skill-layering.md`：活跃层 20 名单 + 储备层定义 + 升降判据 + 当前实测 |
| README 指针 | `.agents/skills/README.md` 与四族 README 末尾各挂一行指针（幂等，已含则跳过） |
| 偏差 | 原计划把分层规则写进 `docs/reference/skill-tooling-audit.md`，**实际不能**——该文件由 `--write` 整文件重写，手写小节下次即丢；改独立文件（已记 lesson） |
| 不逐行打标 | 四族 README 与 `.agents` README 保持全量列出，分层只标在 layering.md，避免两份清单漂移 |
| 全库 25 条超长描述 | 只登记不压缩（全在 `.agents` 导入包，属储备层，不进元数据面板） |

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

---

## v3.3 残项收敛（门 1：需求分析，待批准）

> 2026-11-07 复跑实测。上表 v3.2 的「批 C 待批准」已完成并合并（PR #220 `484ddc3`），孤儿归位已合并（PR #221 `a56119c`）。本节只列**还剩下什么**，不预设做法。

### 现状实测

| 指标 | 值 | 命令 |
|---|---|---|
| 技能总数 | 109（自写 43 / 导入 66） | `node scripts/audit-skill-tooling.cjs` |
| 可执行 / 半可执行 / 纯文档 | **17 / 10 / 82** | 同上 |
| 孤儿脚本 | **16 / 63**（10 门禁已接未点名 + 6 `@oneshot` + **0 真孤儿**） | 同上 |
| 正文引用异常 | 0 | 同上 |
| 技能调用留痕 | 38 切片 / **0 条技能记录** | `npm run audit:skill-usage` |
| 常驻层 | 19480 / 19500 | `node scripts/audit-context-budget.cjs` |

### 残项清单（F 编号 · 判定 · 依据）

| 编号 | 事项 | 判定 | 依据 |
|---|---|---|---|
| **F1** | 10 个「门禁已接但技能正文未点名」 | **做** | 缺口只在文档侧：命令天天在 CI 跑，技能却不知道可以调 |
| **F2** | 6 个 `@oneshot` 脚本处置 | **做（需你选删/留）** | 已确认使命完结，留着只是目录噪音 |
| **F3** | 调用留痕 0，升降判据空转 | **做（缓）** | 「升层靠使用」没有数据 = 永远不会触发 |
| **F4** | `description` 必须含「何时用」门禁 | **缓做·先只报不阻断** | 导入包 38 条无触发句，全库强制会大面积假红 |
| **F5** | 10 个半可执行技能下沉成脚本 | **不做** | shadcn 走 `npx`、评审/需求分析是判断类、其余已是标准 CLI；包壳不增确定性 |
| **F6** | 82 个纯文档补入口 | **不做** | 56 个导入包 + 26 个自写无可对应脚本，硬接即编造 |
| **F7** | `plan-control` 无 `type`/`verification`；`09-db-migration` 无 `type` | **不做** | §4f 只对 `type: executable` 强制；不声明 = 不承诺可执行验证，语义诚实。给 Flyway 未启用的技能写 alembic 命令就是造假命令 |
| **F8** | 25 条 >250 字符 description | **不做** | 全在 `.agents` 导入包（储备层，不进元数据面板），v3.2 已定只登记 |
| **F9** | `lessons.md` 与 `scripts/eval-*.cjs` 归位统一目录 | **不做** | 重组会打断 AGENTS.md §11、技能入口、CI 三处引用，收益只是目录整齐 |

### 批次划分（每批 ≤40%，批批验证）

**批 D（F1 + F2，约 80 min）**

| 步 | 动作 | 文件 |
|---|---|---|
| D1 | 10 个脚本按归属点名：6 个 `audit-*` + 2 个 nginx → `quality-audit` / `deploy-verify`；`eval-core` + `skill-usage-parse` → `agent-eval` | 3 个 SKILL.md |
| D2 | 6 个 `@oneshot` 按你的选择处置（删 / 保留） | 6 个脚本 |
| D3 | 重跑审计 + `--write`，确认「门禁已接未点名」节为空 | `docs/reference/skill-tooling-audit.md` |

**批 E（F3，约 40 min，可单独放）**

| 步 | 动作 | 文件 |
|---|---|---|
| E1 | `audit-skill-usage` 加「新增切片必须有『调用技能』行」校验：按切片目录创建时间设阈值，阈值后才 error，之前只 warning | `scripts/audit-skill-usage.cjs` |
| E2 | 补 1 条回归测试锁住「阈值前只 warning / 阈值后 exit 1」 | `scripts/tests/` |

### 验收（F1/F2，GWT）

| F | Given | When | Then |
|---|---|---|---|
| F1 | 打开 `quality-audit` / `deploy-verify` / `agent-eval` 的技能正文 | 重跑 `audit-skill-tooling.cjs` | 「门禁已接未点名」从 10 降为 **0**；且这 10 个脚本可被 `existsSync` 逐条核到 |
| F2 | 6 个 `@oneshot` 已确认零外部引用 | 处置后重跑审计 | 脚本数 63 → 57（删）或保持 63 且 `@oneshot` 节为 6（留）；`node --test` 121 pass、`verify-harness ERRORS: []` 不变 |
| 整体 | 批 D 完成 | `npm run verify` | exit 0；常驻层 19480 不变（技能正文不进常驻） |

### 风险（动手前）

1. **F2 删文件不可逆**——git 历史可恢复，但当前目录确实消失；删除前逐个人工确认无手工依赖（`grep` 四层引用后再删）。
2. **F1 可能把「确定性入口」撑长**——只列命令一句话，不解释用途，否则技能正文膨胀反而降低被读概率。
3. **F3 阈值设错会让新切片假红**——阈值取「本 PLAN 批准日期」，且只对新目录生效，历史 38 切片保持 warning。

### 需要你拍板的三件事

1. F2 的 6 个 `@oneshot`：**删除**，还是保留？
2. F3 现在做，还是等有真实切片记录再做？
3. F4 是否要「存量化并阻断」——我的建议是只报不阻断。
