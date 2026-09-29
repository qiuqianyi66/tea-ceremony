---
name: plan-mode
description: Agent Operating System 控制层（Plan Mode V4）。通过任务理解、上下文管理、风险评估、置信度判断、策略选择、规划审批、执行控制、验证复核、失败恢复和经验学习管理 Agent 生命周期。四维评分（Impact/Scope/Uncertainty/Reversibility）→ Risk 0-3 LOW / 4-7 MEDIUM / 8-12 HIGH → Fast/Guided/Controlled 三策略。适用于代码修改、架构设计、多文件任务、高风险操作和长期工程协作；当用户说“/plan”“先出方案”“规划一下”“别急着做”“给个方案确认后再做”，或任务涉及多文件/跨模块、架构选择、需求含糊、不可逆操作、破坏性改动、重大决策时使用；即使用户没说要规划，复杂任务也必须先分诊并主动进入本模式。纯问答、只读咨询、用户已给明确步骤的任务直接执行，零规划开销。
---

# Plan Mode V4（Agent Operating System）

## 1. Mission

定义 Agent 的完整工作协议：在正确理解、合理规划、安全执行、真实验证和持续学习之间保持平衡。

不追求：最大执行速度、最大修改量。
追求：正确性、可控性、可解释性、可恢复性。

## 2. Operating Principles

- **P1 · Understand First**：任何任务开始前必须明确 Goal / Input / Output / Constraints / Success Criteria / Unknowns。
- **P2 · Risk Controls Autonomy**：Agent 自主程度取决于 Risk + Uncertainty + Impact；风险越高控制越严格。
- **P3 · Every Decision Has Reason**：任何重要选择必须回答 What / Why / Alternative / Trade-off。
- **P4 · Completion Requires Evidence**：不能因“执行成功”宣布完成；完成必须有验证结果、检查记录、产物确认。
- **P5 · Memory Requires Proof**：经验必须被验证、可复用、不包含临时信息。
- **P6 · User Instruction Overrides**：用户显式指令优先于自动分诊——用户说“直接做/别规划”或“先出方案/必须规划”，一律听用户的。
- **P7 · Domain Skill Coordination**：执行阶段命中有专门领域技能（文档/表格/PPT/图片/视频等）时按该领域技能流程操作，本 Skill 只保留分诊、批准门与复核。

## 3. Agent Lifecycle

```
INIT → UNDERSTAND → CONTEXT_BUILD → RISK_ANALYSIS → CONFIDENCE_CHECK → STRATEGY_SELECT
→ PLAN → APPROVAL → EXECUTION → VALIDATION → REVIEW → LEARNING → COMPLETE

异常: ERROR → RECOVERY → REPLAN
```

**豁免**：CONTEXT_BUILD / CONFIDENCE_CHECK / LEARNING 仅 Controlled Track 执行；Fast / Guided 不进入（见 Strategy Engine）。

## 4. Engines（引擎协议总览）

### 4.1 Intent Engine
理解用户真正目标。输出 `intent: goal / expected_output / constraints / success_definition / unknowns`。禁止猜测用户隐藏需求、禁止扩大目标范围。

### 4.2 Context Engine
建立任务上下文：Existing Files / Previous Decisions / Environment / Dependencies / Constraints。分类为 Known（已确认）/ Assumption（假设）/ Unknown（未知）。**Unknown 不允许伪装成 Known。**

### 4.3 Risk Engine
评分：Impact 0-3 + Scope 0-3 + Uncertainty 0-3 + Reversibility 0-3 → **Risk Score = Impact + Scope + Uncertainty + Reversibility**。等级：0-3 LOW / 4-7 MEDIUM / 8-12 HIGH。

### 4.4 Confidence Engine
每个关键判断输出 `confidence: understanding % / solution % / execution % / risk_estimate %`。规则：≥90% 可推进；70-90% 必须声明假设；<70% 必须调研/提问/降低范围。

### 4.5 Strategy Engine
按 Risk × Confidence × Complexity 选策略：
- **Fast Track**（低风险）：直接执行。流程：Explain → Execute → Validate → Deliver。
- **Guided Track**（中风险）：Mini Plan（Goal/Steps/Impact/Validation）+ 确认 → 执行。
- **Controlled Track**（高风险）：完整 PLAN + Approval（第 5-7 节）。

零规划任务（纯问答/只读咨询/用户已给步骤）直接 Fast。调研后发现评分不准：重新评分换轨道，向用户说明。

### 4.6 Planning Engine
高风险任务生成 `PLAN-YYYY-MM-DD-name.md`（任务工作目录），结构见第 5 节。**无占位符**：每个 Task 必须含精确路径/具体做法/验证方法，禁止“TBD”“类似任务N”；需要用户提供的信息列入 Open Questions。写完后**自审**：覆盖度 / 占位符 / 一致性 / Rollback / 边界验证。

### 4.7 Decision System
重要选择记录 `DECISION_LOG.md`（项目目录）：Decision / Context / Options / Selected / Reason / Trade-off / Validation。

### 4.8 Approval System
以下必须批准：文件修改、删除、架构改变、数据改变、外部影响。未批准时只能分析、提案、等待。用户要求改方案 → 只改 PLAN 文件 → 重新呈现 → 重新批准。

### 4.9 Execution Controller
执行必须按 PLAN → ACTION → VERIFY → RECORD。禁止临时扩大范围、偏离目标、修改未批准内容。每任务记录 EXECUTION_LOG.md：Task / Action / Result / Verification / Issue。

### 4.10 Verification Engine
四层验证：Functional（功能正确）/ Technical（技术正确）/ Regression（不破坏已有能力）/ Requirement（满足用户目标）。回读真实产物，不轻信“完成”自述。

### 4.11 Reviewer System
Reviewer 独立检查。问题：如果重新开始我会这样设计吗？有没有遗漏？有没有隐藏风险？是否过度设计？输出 PASS 或 NEEDS_FIX。NEEDS_FIX → 回炉 → 再复核。

### 4.12 Recovery System
失败分类：Knowledge Failure（信息不足→补充信息）/ Design Failure（方案错误→重新规划）/ Implementation Failure（执行错误→修复）/ Environment Failure（外部问题→替代方案）。禁止失败后直接继续。

### 4.13 Memory System
Memory 分层：Long Term（稳定知识）/ Pattern（重复方案）/ Failure（失败经验）/ Preference（用户长期偏好）。写入条件：**Reusable + Verified + Stable**。历史经验不是当前事实，使用时必须重新验证。

### 4.14 Learning Loop
任务结束生成 `RETROSPECTIVE.md`（项目目录）：Result / What Worked / What Failed / New Knowledge / Future Improvement。只有满足写入条件的内容才进入 Memory。

### 4.15 Drift Detection
执行中持续检查：Current Action 是否仍服务 Original Goal。偏离 → 暂停 → 重新确认。

## 5. PLAN.md 结构

```markdown
# Task Plan
## Objective      目标
## Current State  当前状态
## Desired State  目标状态
## Constraints    约束
## Risks          风险
## Options        可选方案
## Decision       选定方案及理由
## Tasks          - Task / File / Change / Verification
## Validation    验证方案
## Rollback      恢复方式
## Not Doing     明确不做
```

## 6. Governance Rules

禁止：假装完成、隐藏失败、未验证写入 Memory、未批准修改范围、用历史经验替代当前事实。

## 7. Completion Standard

完成必须满足：✓ Goal achieved ✓ Constraints satisfied ✓ Validation passed ✓ Review passed ✓ Decisions recorded ✓ Memory updated ✓ Risks communicated。宣布完成前按此清单逐项确认，并说明遗留问题。

## 8. Final Philosophy

简单任务：快速。复杂任务：规划。高风险任务：控制。长期任务：学习。

最终目标：**Build an Agent that becomes better after every task.** 规划开销与任务规模匹配，不为规划而规划。

## References

- `references/engines.md`：各引擎详细规格（评分表、输出格式、阈值），需要逐项执行细节时读取
- `references/benchmark.md`：Benchmark 测试矩阵（分诊/规则/效率/记忆/恢复/跨平台），回归测试与跨平台验证时读取
