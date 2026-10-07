---
last_updated: 2026-10-07
status: active
owner: yanha
---

# Harness Engineering 总纲（285）精读与一盏茶对照（2026-10-07）

> 来源：语雀知识库「图灵AI大模型面试核心点(2026版)」→ 285.Harness Engineering 从入门到精通实战（14107 字，含 OpenAI/Anthropic/Stripe/HashiCorp 案例与落地路线）。本文 = 精读要点 + 一盏茶对照 + 可落地清单。

## 1. 定义与起源

- 提出者：Mitchell Hashimoto（HashiCorp 联合创始人），2026-02-05 首次提出；六天后 OpenAI 百万行实验报告采用；Martin Fowler / LangChain / Anthropic 跟进。
- 定义：围绕 AI 智能体构建约束机制、反馈回路、工作流控制和持续改进循环的系统工程。**不优化模型，优化模型运行的环境**。
- 核心哲学：**人类掌舵，智能体执行（Human Steer, Agent Execute）**。
- 第一性原理（Hashimoto）：Agent 每次犯错 = 环境设计不完善的信号。正确回应不是换更强的模型，而是重新设计运行环境。
- 数据证据：OpenAI 100 万行代码 0 行手写（3~7 人，人均 3.5 PR/日）；LangChain 只改 harness，Terminal Bench 30→5 名（52.8%→66.5%）；仅改工具格式得分 6.7%→68.3%。

## 2. 与框架的关系

- Harness 不是 SDK/脚手架/Agent 框架的替代品，是位于它们**之上**的一层。
- 模型正吸收框架约 80% 功能（智能体定义/消息路由/任务生命周期）；剩余 20%——**持久化、确定性重放、成本控制、可观测性、错误恢复**——正是驾驭层的价值。

## 3. 三次范式跃迁

| 范式 | 核心问题 | 类比 |
|---|---|---|
| 提示词工程 | 怎么把话说清楚 | 对马喊话的技巧 |
| 上下文工程 | 怎么给 AI 喂信息 | 给马看的地图 |
| 驾驭工程 | 怎么让 Agent 可靠工作 | 造高速公路：护栏、限速牌、加油站 |

## 4. Agent 失败模式（Anthropic 三坑 + 一险）

1. one-shotting：一个会话做完一切 → 上下文耗尽，留下无文档半成品。
2. 过早宣布胜利：看到部分进展就宣布完成。
3. 过早标记功能完成：无端到端测试就标 done（单测/curl 过 ≠ 功能可用）。
4. 模式复制：忠实复制并放大坏模式/架构漂移 → 快速积累技术债。

## 5. 核心组件四件套

| 组件 | 解决什么 | 代表实践 |
|---|---|---|
| 上下文工程 | Agent 不知道该看什么 | AGENTS.md 活文档、三层体系（Tier1 常驻/Tier2 按需/Tier3 知识库）、按需检索 |
| 架构约束 | Agent 复制放大坏模式 | 单向依赖（Types→Config→Repo→Service→Runtime→UI）、自定义 Linter、CI 强制阻断 |
| 反馈循环 | Agent 不知道做错了 | Agent-to-Agent Review、自动测试套件、测试过 bug 代码则判测试无效 |
| 熵管理 | 技术债和文档腐烂 | Doc-gardening Agent、持续垃圾回收（小额常还，非集中） |

关键实践细节：
- **Agent 专业化**：研究（只读）/规划（只读无写）/执行（限定读写）/审查（只读+标记）/调试（限定修复）/清理——受工具限制的专家优于全权限通用 Agent。
- **持久化记忆**：进度存文件系统非上下文窗口；**JSON 追踪 feature 优于 Markdown**（结构化数据不易被覆盖）；会话启动 5 步（pwd→git log+进度→feature 列表→起服务跑 E2E→开工）。
- **结构化执行**：理解→规划→执行→验证；人工检查点审计划远比审代码快。
- **Linter 错误信息即 prompt**：每条报错三要素——问题是什么 / 怎么修 / 去哪看文档。Agent 读到即自修复，不需人介入。
- **时间盲区**：Agent 无时间感知，会乐跑数小时测试——确定性测试子采样（单 Agent 确定性 1-10%，跨 VM 随机，集体全覆盖）。

## 6. 行业案例要点

| 案例 | 关键数据 | 最有价值的实践 |
|---|---|---|
| OpenAI 百万行 | 0 行手写/1500 PR | 五大原则：设计环境而非写代码 / 机械化架构约束 / 仓库唯一事实源 / 可观测性连 Agent / 对抗熵 |
| Anthropic C 编译器 | 16 Agent 并行、99% torture pass、$20K | 上下文污染缓解（日志文件化/grep 友好单行错误）、确定性测试子采样、CI 作为 harness |
| Anthropic 长任务 | 跨上下文窗口连续性 | init Agent（建 init.sh+进度文件+git 提交）+ 编码 Agent；四大失败模式对策 |
| Stripe Minions | 千级 PR 无人值守 | Toolshed MCP（500 工具）、隔离预热 Devbox、Agent 一等公民（与人类同上下文同工具） |
| Hashimoto Ghostty | AGENTS.md 每行=一个失败案例 | 每天最后 30 分钟起 Agent 暖启动、10-20% 工作日有后台 Agent |
| Huntley Loop | 反压（Backpressure） | 上游：确定性设置/一致性上下文；下游：测试/类型/Lint/构建/安全扫描拒绝无效工作 |

## 7. 行业共识六条

1. 瓶颈在基础设施，不在模型智能。
2. 文档必须是活的反馈循环（静态文档是坟场；doc-gardening 定期清）。
3. 思考与执行分离（Orchestrator + Worker，状态外部持久化）。
4. 上下文不是越多越好（巨大的指令文件挤掉任务空间）。
5. 约束必须自动化（护栏编码为 Linter/CI/类型系统，机器执行非人审）。
6. 工程师角色转变：从写代码 → 设计让 Agent 可靠工作的控制系统。

## 8. 落地三阶段（渐进，不一刀切）

- **阶段1 信息层**：AGENTS.md **50-100 行地图模式**（面向任务："想做什么→去哪看"，硬规则单列）；docs 加元信息；设计文档模板（意图工程化）。
- **阶段2 约束层**：ArchUnit 分层依赖测试；自定义 Linter（错误信息三要素）；CI 护栏表——方法≤50 行、文件≤300 行、禁 System.out/裸 RestTemplate、Controller 不直调 Mapper、构造器注入、行覆盖≥80%、enforcer 锁工具版本。经验法则：**Code Review 提过 3 次以上的规则 → 写成 Linter**。
- **阶段3 自动化层**：后台清理 Agent、Git Worktree 自动化、可观测性（Actuator+Prometheus+结构化日志）。
- 工具选型：Aider（个人快速）/ Cline+Superpowers（团队流程，强制 TDD）/ OpenHands（生产隔离）。

## 9. 一盏茶对照（已有 ✓ / 差距 △ / 可落地）

| 285 实践 | 一盏茶现状 | 差距 |
|---|---|---|
| AGENTS.md 50-100 行地图 | 204 行（含学习记录，维护规则定 200-350） | ✅ 评估结案（2026-10-07）：在维护区间维持现状；学习记录不外置（见 §10-4） |
| 三层上下文 | AGENTS.md(T1) + skills/rules/wiki(T2/T3) | ✅ 同构 |
| Agent 专业化六角色 | .claude/agents 三子代理（评审） | ✅ 有评审；无研究/清理角色（够用） |
| 架构约束机械化（ArchUnit/Linter 三要素） | biome+type-check+CI 13 job；后端分层规则在文档 | ✅ 已落地（2026-10-07）：`backend/src/test/.../LayerDependencyTest.java`（红线 #1 四规则，错误信息三要素），CI Maven test 门禁 |
| 反馈循环（agent 审 agent） | review.md + code-reviewer/consistency-verifier | ✅ |
| 熵管理/Doc-gardening | 手动漂移自查（治理同步纪律） | ✅ 已落地（2026-10-07）：`scripts/verify-harness.cjs`（ADR/CI job/技能数/路径），首跑抓出流程族 30→32 漂移已修；已挂 CI 合并门禁（harness-consistency job，CI 13 job） |
| 持久化记忆（文件系统） | HANDOFF + .harness/changes 三件套 | ✅ |
| JSON 追踪优于 Markdown | changes/ 是 Markdown 三件套 | △ 可选（JSON state 单一状态源） |
| 结构化执行五步 | AI Change Protocol + Modification Level | ✅ |
| docs 五层知识库（architecture/conventions/design/plans/reference + 元信息头） | architecture 合并式 / prd 代 design / .harness/rules 代 conventions；plans、reference 原缺失，无元信息头规范 | ✅ 已落地（2026-10-07）：`docs/plans/`、`docs/reference/error-codes.md` 新建；工程结构.md §六 补 plans/reference 层 + frontmatter 规范；verify-harness.cjs 检查目录惯例与元信息覆盖率 |
| 错误信息即 prompt | biome/checkstyle 自带部分 | ✅ 已落地（2026-10-07）：ArchUnit 报错三要素 + caveman-review / expert-reviewer finding 均带 FIX + 规则出处；biome 无自定义规则（消息定制受限），架构约束由 ArchUnit 承担 |
| 时间盲区/确定性子采样 | 无此场景（非长时 agent 集群） | — 不适用 |
| 每周环境审查 | 漂移当场修习惯 | ✅ 可固化为清单 |

## 10. 建议优先项（按一盏茶价值排序，2026-10-07 落地状态已更新）

1. **P1 后端 ArchUnit 分层依赖测试**：✅ **已落地（2026-10-07）**——`backend/src/test/java/com/tea/architecture/LayerDependencyTest.java` 四规则（Controller 禁查库 / 禁反向依赖 / Repository 不依赖上层 / 禁字段注入），错误信息三要素，CI Maven test 门禁。
2. **P1 Linter 三要素审计**：✅ **已落地（2026-10-07）**——ArchUnit / caveman-review / expert-reviewer 三要素化（FIX + 规则出处）；biome 无自定义规则且消息定制受限，架构约束由 ArchUnit 承担，审计闭合。
3. **P2 Doc-gardening 脚本**：✅ **已落地并挂 CI（2026-10-07）**——`scripts/verify-harness.cjs` 期望 `ERRORS: []`，首跑抓出流程族 30→32 漂移已修；新增 `harness-consistency` CI job（CI 12→13）；配套 `add-doc-meta.cjs` 批量补元信息头（docs 65/65）。
4. **P2 AGENTS.md 精简评估**：✅ **评估完成（2026-10-07）**——当前 204 行在维护区间（200-350，AGENTS.md §13 维护规则），285 的 50-100 行是轻量场景建议；学习记录外置 docs/lessons.md 收益有限（维护规则已限长），维持现状不外置。
5. **P3 JSON 状态文件**：待办（changes/ 三件套旁加 state.json，单一状态源）。
6. **每周环境审查**：✅ 已固化（2026-10-07）——`docs/plans/environment-review.md` 30 分钟清单。

> 注：285 是总纲；配合已沉淀的 `research-harness-alibaba-2026-10.md`（阿里落地细节）与 `research-multiagent-278-2026-10.md`（多智能体蓝图），三者构成完整的 harness 学习底座。
