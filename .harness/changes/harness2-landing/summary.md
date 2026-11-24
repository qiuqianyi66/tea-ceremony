# harness2-landing 变更记录

> 目录：`.harness/changes/harness2-landing/`。
> **无数据库迁移**（只改技能正文与人读审查页），故不含 `db-migrations.sql` / `rollback.sql`。
> **ADR：不适用**（不涉架构决策、数据模型或接口契约，L0 处理）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | harness2-landing（retro 并入 Harness 自改对照门） |
| 分支 | 无（L0 文档改动，直接落工作区） |
| 需求来源 | 外部精读 Harness²（arXiv 2610.14224）+ 本地适用性核对结论 |
| 类型 | docs |
| 涉及范围 | `.harness/skills/main-dev/retro/SKILL.md`、`docs/skills/retro.md` |
| 调用技能 | 无 |

## 二、需求与方案

### 现状（实测 2026-11-24）

- tea 已有 lessons → patterns → instinct 三级进化、≥3 条证据晋升门槛、`audit-context-budget.cjs` 常驻预算门，经验沉淀面不缺。
- 缺的是**改治理面自身**时的验收纪律：现有门禁只回答「改完是否自洽」，不回答「改前基线是什么、增益是否可复现、停用后增益是否还在」。
- 方案：并入既有 `retro`（其职责就是「改环境不改代码」），不新建技能——新建会与 retro 重复，违反技能规范 §5「先检索是否已存在」。

### 验收标准（Given-When-Then）

- **Given** 改规则/技能/门禁，**When** 按 retro 执行，**Then** 改动前有一条基线命令与输出落盘，改动后有同命令复跑。
- **Given** 新增一条环境条目，**When** 做 leave-one-out 停用复跑，**Then** 增益消失即删除，不允许只报改后变绿。
- **Given** 本次改动，**When** 跑 `node scripts/verify-harness.cjs`，**Then** `ERRORS: []`。

### 技术方案

1. `retro/SKILL.md` 在「6 类扫描」与「流程」之间插入「Harness 自改对照门」五条（先取基线 / k=1 是抽样 / 指名时刻 / 分面编辑 + leave-one-out / 下行与上行同权）。
2. `docs/skills/retro.md` 人读页同步「它管什么」一条 + 审查要点第 6 条，防人读页与机器侧漂移。

**双向论证**

- **选 A（并入 retro）的理由**：retro 唯一职责就是改环境，对照门是其缺失的验收步骤；单一职责不拆两处。
- **否 B（新建 harness-reflect 技能）的理由**：与 retro 触发条件重叠，且要同步 4 处技能计数声明（AGENTS.md 常驻预算已 19458/19500，新增面即风险）。
- **反转条件**：若对照门内容超过 20 行或出现独立脚本，再拆独立技能。

## 三、影响分析

- **常驻层零新增**：技能按需加载，AGENTS.md 与 rules 未改，常驻预算不变。
- **技能数不变**：main-dev 仍 14，README 计数声明无需同步。
- **承重墙确认**：不触业务代码、降级链、评分模型、3D 状态机。
- **回滚路径**：`git checkout -- .harness/skills/main-dev/retro/SKILL.md docs/skills/retro.md`。

## 四、自检清单

- [x] 需求分析先行（现状实测 + 双向论证 + 反转条件）
- [x] 轨道判定：Fast/Guided 之间按 L0 文档处理，未动业务代码
- [x] 不新建平行体系（复用 lessons/patterns 与现有门禁）
- [x] 验证结果：`verify-harness.cjs` 首跑报 review.md 缺失（已补），复跑 `ERRORS: []`；`audit-context-budget.cjs` `ERRORS: []`（常驻 19304/19500 token，未因本改动增长）
- [x] 独立评审缺位已明写（见 review.md §一），未以自查替代
- [x] 无数据库迁移（本文件顶部已注明）；ADR 不适用
