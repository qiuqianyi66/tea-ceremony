---
last_updated: 2026-10-10
status: active
owner: yanha
---

# task-control-spec 变更记录

> 目录：`.harness/changes/task-control-spec/`。本切片无数据库迁移，故无 db-migrations.sql / rollback.sql（按 m1-ai 惯例在顶部注明）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | task-control-spec（把任务控制四项固化进最高规范） |
| 分支 | `docs/task-control-spec`（基于 main `2bcf882`） |
| 需求来源 | 用户口头指令（"遇到问题去拆解问题，做需求分析，需要长问题去 plan-control，最后客观去做这些事情，这个规范你写进最高的规范文档里面去"） |
| 类型 | docs |
| 涉及范围 | 治理文档（AGENTS.md §0/§4 + 三份 docs 消歧），无代码、无前端、无部署、无数据 |

## 二、需求与方案

### 需求描述

1. **F1 分诊**：收到任务先判定轨道（Fast / Guided / Controlled），再决定流程深度。
2. **F2 拆解**：复杂问题先拆成子问题（现状 → 根因 → 子问题清单 → 待验证项）再动手。
3. **F3 需求分析**：新功能 / 变更先过 `request-analysis`（F 编号 + Given-When-Then + 范围边界）。
4. **F4 长任务先出方案**：跨模块 / 架构 / 不可逆任务先过 `plan-control`（风险评分 + 取舍 + 回滚 + Not Doing）。
5. **F5 客观执行**：结论以实测为准；无法实测的必须标注「未复核断言」，禁止当事实转抄。

### 验收标准（Given-When-Then）

- **Given** 任一开发任务，**When** 开工，**Then** 已判定轨道且按对应流程走（§4.1）。
- **Given** 模糊/多文件/高风险问题，**When** 动手前，**Then** 已产出四段式拆解。
- **Given** 新功能或行为变更，**When** 进入编码前，**Then** 已过 request-analysis。
- **Given** 架构/迁移/不可逆任务，**When** 动手前，**Then** 已出 plan-control 方案。
- **Given** 任意状态断言，**When** 转抄或汇报，**Then** 已实测；否则标注为未复核断言。

### 技术方案

落点：`AGENTS.md` §0 增第 6/7 条（客观执行 / 先拆解再动手）；§4 工序改为 0-7 步（新增分诊+拆解、需求分析、方案设计），并新增 §4.1 三轨道表。

**接线不抄正文**（关键约束）：
- 技能正文留在 `.agents/skills/plan-control/SKILL.md`（280 行）与 `.harness/skills/main-dev/request-analysis/SKILL.md`（69 行）。
- 十阶段对照与小改动判据已在 `.harness/rules/开发流程规范.md` §一，本切片只引用不复制。
- 依据：AGENTS.md §2「规则=全量常驻、技能=按需加载，禁止把技能内容抄回规则文件」+ plan-control §18「禁制造与 AGENTS.md 平行的新规则体系」。

### 附带修复（实测发现，非用户直接要求但属同一治理目标）

1. **P0-3 编号撞车**：`P0-3` 在三份文档指三个事项（前端返工 / AI key / PWA prompt）。在 `docs/PLAN-harness-research-2026-10.md`、`docs/TODO-PRIORITY.md` 就地加消歧警示；不重编号（会毁历史引用）。
2. **TODO-PRIORITY 纠错**：记录三份交接的 6 处硬错（详见 summary 三节来源），纠正「后端重写已完成」（假）与测试数 201（实为 211）。

## 三、影响分析

- **影响面**：所有后续 AI 会话的开工行为（AGENTS.md 是最高约束）。不改任何代码路径，零运行时影响。
- **兼容性**：与既有 `.harness/rules/开发流程规范.md` 十阶段互补，无冲突；AGENTS.md §5 Modification Level 仍为入口。
- **回滚路径**：`git revert` 单 commit 即可（纯文档）。
- **契约变化**：无 API / 数据模型变化，`wiki/api-contract.md` 无需同步。
- **承重墙确认**：未触及降级链 / 3D 状态机 / 同步逻辑。
- **行数合规**：AGENTS.md 维护规则要求 200-350 行，本切片后 250 行。

## 四、自检清单

- [x] 十阶段 Gate：L0 文档，轻量路径（无代码验证需求）
- [x] 编码规范红线 15 条零违反（`audit-redlines.cjs` ERRORS: []）
- [x] review 通过无 🔴、🟡 清零（见 review.md）
- [x] 测试：`verify-harness.cjs` ERRORS: []；`audit-wiki-drift.cjs` ERRORS: []
- [x] 数据库迁移：无（本切片不涉库，已在顶部注明）
- [x] 观测期：纯文档，不适用
