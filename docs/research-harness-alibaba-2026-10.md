---
last_updated: 2026-10-07
status: active
owner: yanha
---

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

## 7. 四阶段演进教训（补读）

1. 拿来主义：抄开源 OpenSpec/社区模板 → 天花板：通用规范覆盖不了自家流程，临场补丁越来越多。
2. 重 prompt 约束：全规则写进 CLAUDE.md → **3 天崩**（选择性遵守/上下文爆炸/规则自相矛盾）。教训：**prompt 约束是说服不是强制，无法用更多字对抗概率性遗忘**。
3. 减负+分层加载：常驻压到 ≤8K，深度内容移 context/ 按需 Read。新问题：长程会话中规则被工具输出稀释到注意力衰减区。
4. Agent 调度编排：dispatcher 算"下一步谁上场"，各 agent 各管一段。**24 agent 过度拆分是坑**（单 agent 规则密度高、转交多、调试难）→ 精简合并主干 agent，只保留核心约束：dispatcher 路由 / 职责隔离 / 状态外置 / 门禁阻断。

硬规则"改完必部署"：检测到真实业务代码改动 → 自动追加部署预发 + 接口测试为必需节点。**边界诚实**：G8 生产上线不强制——生产发布出错成本 > AI 自主效率收益，人兜底。

## 8. 三种多 agent 机制对比（控制/计算/协作平面）

| 机制 | 平面 | 优点 | 硬伤 |
|---|---|---|---|
| Claude Code Workflow | 计算平面（单阶段高并行） | 确定性控制流/并行/schema 强校验 | 超时静默杀进程(null 无法区分失败/超时)、无 askUser 交互、跨 session 不可续 |
| Agent Team | 协作平面（多人独立任务） | 松散协调、并行改多模块 | 无确定性工序保证、状态散落、SendMessage 是通知非阻断 |
| **dispatcher 状态机 + 文件交接** | **控制平面（有状态工序链）** | 天然持久化(崩了文件还在)/可审计(git diff)/强一致(state-keeper 单写者 + ajv schema) | 每次切换 Read 上一步产物 2-5K token、调试跨 agent、并行受限于序列化 |

结论：三机制正交互补——dispatcher 管控制流，Workflow 加速纯计算（如三角色评审并行），Team 管多人独立任务。一盏茶 M5 产品侧已用 agent-framework + graph-core；工程侧可借鉴"状态机 + 文件交接"（.harness/changes + HANDOFF 已有雏形）。

## 9. 评测平台：把流程当被测对象（七维确定性评分）

- 定位：**评测平台是评估者不是执行者**——只检测节点产物在不在、门禁过没过，绝不代劳执行。
- 三条轨道：/eval（多版本×多 case 跑分对比）/ dev（真实需求全链路，人工门+真部署）/ query（只读排查）。
- 七维评分（100% Python 确定性、零 LLM 调用、3 次跑分 hash 一致）：

| 维度 | 权重 | 检查什么 |
|---|---|---|
| 流程完整性 | 22% | 必需节点产物文件是否存在（按 intent×risk 裁剪节点数） |
| 产物质量 | 15% | 结构检查（路径≥3/代码块/风险清单/回滚方案）+ 反注水 |
| 代码正确性 | 22% | **真跑 mvn compile+test**，不信 AI 自报；对比自报 vs 真实 = honesty gap |
| 效率 | 10% | 耗时 + 成本 USD，与基线对比 |
| 安全合规 | 8% | 扫描 transcript 违反 harness 规则（禁 Grep Java、diff 含 ALTER TABLE） |
| 迭代能力 | 5% | 检测 BUILD FAILURE → SUCCESS 恢复链 |
| 接口验收 | 18% | 真跑 ATDD + 检查接口测试证据（G7 门禁） |

- 核心原则：**宁要可复现的"粗糙分"，不要会漂移的"精准分"**——只有 3 次跑分一致才能做 A/B，LLM 评委 ±5 分波动让对比失去意义。
- 踩坑：空产物兜底 70 分（失败必须响亮不静默）；评测环境越"干净"越不真实（空隔离 Maven 仓库依赖全解析失败恒 0 分 → 换共享 ~/.m2 缓存）；headless 四连坑（MCP OAuth/CLAUDE_CONFIG_DIR/skills 继承/stdin 不 close）。

## 10. 一盏茶新启示（补读追加）

1. **我们的分层已到第三阶段**（AGENTS.md 常驻 + rules + skills + wiki 按需），未犯"重 prompt"错；需警惕长程会话规则稀释——用 checklist 外置 + HANDOFF 续跑对冲。
2. **eval 自动化可直接抄七维思路**：agent-eval-baseline 补"产物存在性 + 真编译 + 反注水 + honesty gap"，确定性脚本零 LLM。
3. **门禁升级方向**："改完必部署"式硬规则（我们已有 Docker Compose 部署链，可加检测节点）；生产上线保持人兜底（与 DEPLOY 门禁一致）。
4. **agent 数量教训**：M5 五专家够用，不贪多；规则放文件不放 agent prompt（防 24-agent 式规则密度爆炸）。
5. **状态机 + 文件交接**：.harness/changes/{feat}/ + HANDOFF 已是雏形，可补 state.json 式单一状态源。
