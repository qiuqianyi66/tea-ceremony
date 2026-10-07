# 阿里 Harness AI 工程化精读与一盏茶对照（2026-10-07）

> 来源：语雀知识库「图灵AI大模型面试核心点(2026版)」→《阿里巴巴 Harness AI工程化编程实践》（杜学友，阿里云开发者，9182 字）。本文是精读笔记 + 一盏茶差距对照 + 可迁移清单。给用户后续研究用。

## 1. 核心观点

- AI Coding 瓶颈从"模型能力"转移到"流程工程"：模型够聪明但不稳定，稳定性由外部框架供给。
- **堆 prompt 是负债，做框架才是资产**：prompt 是一次性说服，harness 是结构性约束。模型供给智商，harness 供给纪律。
- 三个痛点：工序随机 / 上下文污染 / 坑反复踩 → 三种根因（压缩丢失/检索失败/指令遵循失败）。
- 关键数据：验证反馈质量决定 agent 成功率（Effective Feedback Compute R²=0.94~0.99），token 预算与工具调用只解释 R²=0.33~0.42——**"检查做得多好" > "给多少预算"**。

## 2. 五层结构（原文全文）

```
常驻入口 CLAUDE.md + CLAUDE.local.md（≤8K）
  ├─ 原子规则层 rules/(7)    每条规则 = 一次事故的墓志铭（禁 mvn -am 等）
  ├─ 角色 Agent 层 agents/   dispatcher(路由) → developer → verifier → deployer → tester
  │   + 三角色评审（业务/技术/质量互不看到初稿，对抗性合成）
  ├─ 按需上下文层 context/(10)  Pre-Mortem/证据链/TDD 模板，进入阶段才 Read
  ├─ 执行支撑层 skills/(22) + commands/(12) + evals/
  └─ 稳定性支点：G1-G8 门禁墙（确定性函数，FAIL 即退回 DEVELOPING）+ hook 运行时拦截
经验三级进化：lesson(单次) → pattern(跨项目归纳) → instinct(验证后自动注入新项目)
```

分层唯一标准：**按"何时被读取"分，不是按功能分**。常驻极小、深的按需加载。依据：LLM 注意力 U 型分布（Lost in the Middle, TACL 2024）+ RULER（32K+ 上下文仅半数可靠）。

## 3. 薄主会话三铁律

1. 主会话只听 dispatcher（禁止自己读 phases/*.md / evidence.json）
2. 职责隔离：dispatcher 只路由、orchestrator 只合成、developer 只编码、verifier 只检查；每个 agent 工具严格受限（developer 有 Edit/Bash，verifier 只有 Read/Bash）
3. 上下文 ≤8K：只加载 CLAUDE.md + 触发规则 + 最近一条 dispatcher 指令

代价：链路变长 / 跨 agent 调试难 / 通信有协调开销。警惕的不是"agent 多"而是"agent 间耦合多"——输入输出是文件/JSON 就安全。

## 4. 一盏茶对照（已有 ✓ / 差距 △）

| 它的做法 | 一盏茶现状 | 差距 |
|---|---|---|
| 常驻入口 + 坑沉淀 | AGENTS.md + §13 学习记录 | ✅ 同构 |
| 原子规则层 | .harness/rules 三件套 + 技能规范.md | ✅ |
| 三角色评审 | .claude/agents（code-reviewer / consistency-verifier / red-line-auditor） | ✅ |
| 按需上下文 | .harness/wiki 四件套 + token 按需加载 | ✅ |
| 门禁墙 | npm run quality + CI 13 job + Modification Level L0-L3 | ✅ 硬门禁已有 |
| 状态外置 | HANDOFF + .harness/changes/{feat}/ 三件套 | ✅ |
| 经验三级进化 | §13 单级"学习记录" | △ 无晋升机制 |
| 流程执行流水线（developer/verifier/deployer 分岗） | 单会话为主，无工程侧流水线 | △ 多智能体方向 |
| eval 评测平台（流程当被测对象 + A/B） | docs/agent-eval-baseline.md 有雏形 | △ 无自动化评测 |
| hook 运行时拦截 / commands 一键体检 | 无 | △ 可选 |

## 5. 可迁移清单（按优先级）

| 优先级 | 迁移项 | 落地方式 |
|---|---|---|
| P0 | 经验三级进化 | §13 学习记录升三级：lesson→pattern→instinct，晋升需人工确认（2026-10-07 已实施） |
| P1 | eval 评测自动化 | agent-eval-baseline 补确定性门禁（产物存在/编译过/单测通） |
| P2 | 流程流水线 | 工程侧"薄主会话 + 分岗"——与 M5 产品侧多智能体同构 |
| P3 | commands 体检 | /harness-audit 式一键体检（AGENTS.md 漂移自查脚本） |
| P4 | hook 拦截 | 依赖宿主能力，存记待评估 |

## 6. 边界

- 模式依赖"过程可观测"：纯创意生成无法落盘检测，此套打法失效。
- 价值随模型进化衰减：模型强到能自我保证纪律那天，harness 功成身退。那天未到。
