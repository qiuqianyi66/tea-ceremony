---
name: plan-control
description: Agent 控制协议（Plan Mode V4.1 Control Skill Final Edition）。Skill 只回答六个问题：什么时候规划、规划到什么程度、什么时候需要批准、什么时候可以执行、什么时候必须停止、如何证明完成。负责任务分诊、风险评分（Impact/Scope/Uncertainty/Irreversibility 各 0-3）、三档置信度（HIGH/MEDIUM/LOW+依据+条件）、Fast/Guided/Controlled 三策略、规划门禁、风险分级审批（Always/Batch/Auto）、执行边界与漂移检测、四层验证证据、七类失败恢复、完成契约与经验交接。不负责状态机、事件、调度、持久化、审计存储、可观测指标（属 Agent OS Runtime V5）。触发：用户说「/plan」「先出方案」「规划一下」「别急着做」「给个方案确认后再做」，或任务涉多文件/架构选择/高风险（删除、迁移、数据修改、生产或外部影响）/需求含糊或多种合理方案；复杂任务即使未明说也主动进入。不触发：纯问答、解释说明、文档阅读、明确步骤执行、小范围低风险修改（直接走 Fast Path）。
---

# Plan Mode V4.1 — Agent Control Protocol（Final Edition）

> 定位：Skill 是控制协议，不是运行时。状态机、事件总线、调度、持久化、审计存储、可观测指标属于 Agent OS Runtime V5，不在本 Skill 内实现。项目规则由 AGENTS.md / CONTEXT.md ADR / 学习记录承载，本 Skill 只引用不重复。

## 1. Mission

Plan Mode 是 Agent 的复杂任务控制协议：在正确理解、风险控制、范围约束、可解释决策、可验证结果、可恢复执行、可沉淀经验之间保持平衡。

- 追求：Correctness（正确性）/ Control（可控性）/ Evidence（证据性）/ Reliability（可靠性）/ Continuous Improvement（持续改进）
- 不追求：最大执行速度、最大修改范围、最大自动化

## 2. 本 Skill 回答的六个问题

| 问题 | 回答位置 |
|---|---|
| 什么时候规划？ | §3 Activation Rules |
| 规划到什么程度？ | §7 Strategy Selection |
| 什么时候需要批准？ | §9 Approval Boundary |
| 什么时候可以执行？ | §10-11 Scope & Execution |
| 什么时候必须停止？ | §10 Scope Control + §14 Failure Recovery |
| 如何证明完成？ | §13 Verification + §16 Completion Contract |

## 3. Activation Rules

**必须进入 Plan Mode：**

用户明确要求：
- /plan、先出方案、规划一下、别急着做、给个方案确认后再做

自动触发：
- **多文件任务**：多模块 / 多目录 / 多组件
- **架构任务**：技术选型、系统设计、模块拆分、数据模型设计
- **高风险任务**：删除、迁移、数据修改、生产影响、外部系统影响
- **不确定任务**：需求含糊、缺少上下文、存在多个合理方案

**Fast Path Exception（不进入完整规划）：**
- 纯问答、解释说明、文档阅读、明确步骤执行、小范围低风险修改、琐碎可逆改动

Fast Path 流程：Understand → Execute → Verify → Deliver

**用户显式指令优先于自动分诊**：用户说「直接做」就快做；用户说「必须规划」就规划。

## 4. Task Understanding

任何任务开始必须建立：

```yaml
intent:
  goal:
  expected_output:
  constraints:
  success_criteria:
  unknowns:
```

要求：
- 不猜测用户隐藏需求
- 不扩大目标范围
- 不把假设当事实
- Unknown 必须明确标记，禁止伪装成 Known

## 5. Context Boundary

执行前建立上下文：
- Existing Files / Existing Architecture / Dependencies / Constraints / Previous Decisions
- 读仓库规则：AGENTS.md（不可妥协 / 必守规则 / 边界）、CONTEXT.md（术语表 + ADR）、必读文档清单

分类：
- **Known**：已确认事实
- **Assumption**：当前假设（必须说出口）
- **Unknown**：未知信息（必须验证，禁止隐藏）

规则：历史经验不是当前事实；连续两次读取不再改变计划就停止探查，不以搜索代替行动。

## 6. Risk Assessment

```
Risk Score = Impact + Scope + Uncertainty + Irreversibility   （各 0-3）
0-3 LOW    4-7 MEDIUM    8-12 HIGH
```

| 维度 | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Impact 影响 | 单点影响 | 局部影响 | 多个模块影响 | 系统级影响 |
| Scope 范围 | 单文件 | 单模块 | 跨模块 | 跨系统 |
| Uncertainty 未知 | 完全明确 | 少量假设 | 存在关键未知 | 大量未知 |
| Irreversibility 不可逆 | 容易回滚 | 简单恢复 | 需要人工恢复 | 基本不可逆 |

风险评分必须带依据：

```
risk:
  score:
  level:        # LOW / MEDIUM / HIGH
  evidence:
    - reason:
      affected_area:
      possible_failure:
```

## 7. Confidence Assessment

禁止虚假的数字置信度。只允许三档，且必须同时给出**条件核对**与**依据**：

```
confidence:
  level: HIGH | MEDIUM | LOW
  basis:      # 目标明确 / 文件已读 / 依赖已确认 / 约束已知
  unknowns:   # 仍存在的未知
```

| 档位 | 条件 | 行为 |
|---|---|---|
| HIGH | 目标明确 + 上下文完整 + 关键依赖已确认 | 直接推进 |
| MEDIUM | 存在部分假设，风险可控 | 声明假设后再推进 |
| LOW | 关键事实缺失，方案无法可靠判断 | 调研 / 提问 / 缩小范围，禁止推进 |

## 8. Strategy Selection

策略由 Risk + Confidence + Complexity 决定。

- **Fast Track**（LOW Risk + HIGH Confidence + 简单任务）：Understand → Execute → Verify → Deliver
- **Guided Track**（MEDIUM Risk）：Mini Plan（Goal / Steps / Impact / Validation）→ Confirm → Execute → Verify
- **Controlled Track**（HIGH Risk，或架构变化 / 大规模修改 / 不可逆操作 / 重大设计选择）：Context → Full Plan → Approval → Execute → Evidence → Review

调研后发现评分不准 → 重新评分换轨道，向用户说明。

## 9. Planning Protocol

Controlled Track 生成 `PLAN.md`（任务工作目录）：

```markdown
# Goal
## Context              当前状态、相关文件、依赖
## Risk Assessment      风险评分 + 依据（§6）
## Approach             选定方案与理由（架构级决策 → 写入 CONTEXT.md ADR）
## Tasks                每个 Task 明确：Input / Action / Output / Validation
## Trade-offs           取舍与备选方案
## Rollback Strategy    恢复方式
## Open Questions       需要用户提供的信息（禁止用 TBD 掩饰）
## Not Doing            明确不做
```

Planning Rules：
- 每个 Task 必须明确：What / How / Expected Result / Validation
- 禁止：TBD、类似任务、以后处理、大概修改
- 需要机器可执行校验时，另行维护 plan.yaml schema，不进本 Skill 正文

**仓库流程接线（本 Skill 不重复，只留门禁）：**
- 新页面 / 新功能 / 大组件：先走 functional-design（13 问）再进视觉门禁链（Design Read 未产出禁止写码）
- 前端设计：按仓库「反主流 × 创新」规范与设计审计清单
- 数据库变更：先读 `.agents/skills/db-migration/SKILL.md`，模型改动必须生成迁移
- 执行阶段命中专门领域技能（文档 / 表格 / PPT / 图片 / 视频等）按该技能流程操作
- 新功能 / 修 bug 必须带测试，TDD 优先

## 10. Scope Control

执行过程中持续检查：当前行动是否符合 **Original Goal / Approved Scope / Risk Level**。

发现 Scope Drift（超出范围）→ 立即 **Pause → Explain → Request Confirmation**，禁止继续。

## 11. Execution Governance

执行协议：PLAN → ACTION → VERIFY → REPORT；动作明细记入 TASK_RECORD.md（§17）。

每个动作前检查四道：Original Goal / Approved Scope / Capability / Risk Level。

执行禁止：
- 修改未批准范围
- 隐藏失败
- 跳过验证
- 用假设替代事实
- 用「感觉更好 / 通常这样做」当唯一理由

## 12. Action Rules

每个 Action 必须明确：Input / Operation / Expected Output / Validation。

Retry Rules（按恢复成本分类）：
- **SAFE**：可以重新执行。自动重试最多 2 次 + 指数退避。
- **CONDITIONAL**：重新执行前检查状态。重试同样设上限。
- **UNSAFE**：禁止自动重复执行。

## 13. Verification Protocol

完成必须有 Evidence。四层验证：

| 层 | 验证什么 | 证据 |
|---|---|---|
| Functional | 功能正确 | Test / Output / Behavior |
| Technical | 技术实现正确 | Build / Compile / Static Check（type-check / lint） |
| Regression | 没有破坏已有能力 | Existing Tests / Comparison |
| Requirement | 满足用户目标 | Requirement Mapping / Result Confirmation |

```
verification:
  status: passed | failed
  evidence:
    tests:
    logs:
    artifacts:
```

用运行代替猜测：有测试跑测试，有 lint 跑 lint，有 type-check 跑 type-check；从真实入口回读产物，不轻信「完成」自述。

## 14. Failure Recovery

失败必须分类并按对应动作处理：

| 失败类型 | 处理 |
|---|---|
| Knowledge Failure（信息不足） | 补充上下文 / 调研 / 读文件 / 提问 |
| Design Failure（方案错误） | 重新规划，必要时回滚 |
| Implementation Failure（执行错误） | 修复，禁止失败后直接继续 |
| Environment Failure（环境问题） | 换通道（替代命令 / 工具 / 路径） |
| Permission Failure（无权限） | 走审批门 |
| Verification Failure（验证不过） | 修复或回滚 |
| Scope Failure（范围变化） | 暂停，向用户确认 |

同一动作连续失败两次 → 换命令 / 目录 / 依赖 / 实现路径；同类错误再现 → 查共同成因。确实做不到 → 明确说明未完成项、原因、影响，不静默降级后宣称完成。

## 15. Learning Integration

任务结束生成 Retrospective：Result / Problem / Solution / Reusable Insight。

Skill 不管理 Memory。只判断是否产生「Reusable + Verified + Stable」的经验：
- 是 → 交给项目知识系统：项目学习记录（AGENTS.md 学习区，格式「总是用 X 做 Y」）/ CONTEXT.md ADR / LEARNING.md
- 否 → 不写

一次成功不构成长期知识；问题消失（模型升级 / 重构 / 流程变更）就删行。

## 16. Completion Contract

禁止把「代码改完了 / 执行完成了」当作完成标准。

完成必须满足：
- [ ] Goal achieved（对照 success_criteria）
- [ ] Constraints satisfied（含仓库必守规则）
- [ ] Scope respected（无漂移，或已确认）
- [ ] Verification passed（四层验证）
- [ ] Evidence available（证据真实可回读）
- [ ] Review passed（走仓库已有机制：多角色质询 / impeccable / 四维甄别，不新造）
- [ ] Decisions recorded（架构级 → CONTEXT.md ADR；执行级 → TASK_RECORD.md）
- [ ] Risks communicated（遗留问题、假设、风险说清楚）
- [ ] Learning captured（§15 经验交接结论）

## 17. TASK_RECORD.md

每任务只维护一个记录文件（不建多日志）：

```markdown
# Task
## Intent        目标 / 约束 / 成功标准 / 未知
## Plan          轨道、方案、决策
## Decisions     执行级选择（架构级去 ADR）
## Actions       PLAN → ACTION → VERIFY → REPORT
## Verification  四层证据
## Issues        失败、恢复、漂移
## Learning      经验交接结论（去留）
```

## 18. 禁止清单

- 假装完成、隐藏失败、用历史经验替代当前事实
- 未验证写入 Memory、未批准扩大范围
- 文件级审批、每任务多日志、百分比置信度
- 在本 Skill 内实现状态机 / 事件 / 调度 / 持久化（那是 Runtime V5）
- 制造与 AGENTS.md / ADR / CONTEXT 平行的新规则体系

## 19. Final Principle

简单任务：Fast。复杂任务：Plan。高风险任务：Control。长期任务：Learn。

最终目标：Build an Agent that becomes better after every task.
