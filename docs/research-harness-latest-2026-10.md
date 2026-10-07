---
last_updated: 2026-10-07
status: active
owner: yanha
---

# Harness Engineering 一手原文与 2026 最新进展（2026-10-07）

> 验证目标：语雀 285（归纳版）是否过时 → 结论：核心准确，但一手原文（Hashimoto/OpenAI）有更多落地细节；2026 下半年出现平台原生化/模型路由等新动向，285 未收录。本文 = 一手原文增量 + 最新进展 + 一盏茶方案更新。

## 1. Hashimoto 原文增量（My AI Adoption Journey，2026-02-05 全读）

六步旅程，285 只取了 Step5/6，丢了前三步关键结论：
1. **Drop the Chatbot**：必须用 agent（至少能：读文件/执行程序/发 HTTP 请求）；聊天界面对 brownfield 项目低效。
2. **Reproduce Your Own Work**：强制用 agent 复刻自己手写的 commit（做两遍），从第一性原理自证三条规则——①会话拆成清晰可执行任务（禁一个 mega session"画猫头鹰"）；②模糊需求拆成规划会话 vs 执行会话；③**给 agent 验证手段，它自己修错防回归**。负空间：知道何时不用 agent 也是效率。
3. **End-of-Day Agents**：每天最后 30 分钟起 agent（深度调研/并行试模糊想法/issue-PR triage 只出报告不回复），次日"暖启动"。
4. **Outsource the Slam Dunks**：高把握任务外包，人干别的；**关掉 agent 桌面通知**——上下文切换成本极高，人来控制打断节奏。
5. **Engineer the Harness**（285 已有）。
6. **Always Have an Agent Running**：目标 10-20% 工作日有后台 agent；不为了跑而跑。

## 2. OpenAI 原文增量（Harness engineering: leveraging Codex，全文）

- **AGENTS.md = 内容目录（~100 行地图），docs/ = 记录系统**：设计文档编目索引（含验证状态+核心理念）；架构文档提供域/包分层顶层地图并**评分、随时间追踪差距**；计划是一等工件（轻量计划/执行计划+进度决策日志，提交进仓库）；**渐进式披露**（从小而稳切入点开始，指引下一步去哪看）。
- **专职 linter + CI 验证知识库**（更新状况/交叉链接/结构正确）；doc-gardening agent 定期扫过时文档发修复 PR。
- **目标智能体可读性**：运行时上下文访问不到的 = 不存在；偏好可仓库内推理的依赖（自己实现并发 map 替代 p-limit，100% 测试覆盖）。
- **架构约束**：强制不变量而非微观管理（边界处解析数据形状，不指定具体库）；Types→Config→Repo→Service→Runtime→UI 单向层 + 横切关注点走单一 Providers 接口；**自定义 linter 错误信息在智能体情境中注入修复指令**。
- **黄金原则（品味不变式）编码进仓库**；熵管理：后台任务扫偏差/更新质量等级/发重构 PR（约 1 分钟审查自动合并）。
- **自主水平门槛**：端到端驱动新功能 = 实施修复+回应反馈+检测修复构建故障+仅判断时交人。

## 3. 2026 下半年最新动向（语雀 285 未收录）

| 动向 | 来源 | 要点 |
|---|---|---|
| **平台原生化** | dev.to 2026-10-06 | OpenAI 推 Agents API + hosted sandboxes——**把自己的 Codex harness 当托管服务卖**；护栏跟着卷 |
| **Model Router（模型路由）** | dev.to 2026-10-06 | harness 内建按任务复杂度路由 → 单线程成本砍 64% |
| **Claude Mods** | dev.to 2026-10-06 | Anthropic 可 fork 的 mod 机制 + 涌现的 inter-agent side channels |
| **Memory as Infrastructure** | dev.to 2026-10-06 | 生产环境跑持久化 agent memory 的 months-long post-mortem |
| **Google Agent Factory** | Google Cloud Blog 2026-09-25 | harness 捕获取向调工具再喂回 prompt；shifting left + 自主编码讨论 |
| **HarnessX（学术）** | arXiv 2606.14249v2 | 可组合/自适应/可演化 harness foundry；AEGIS 引擎（Digester→Planner→Evolver→Critic）由同一 meta-agent 驱动，harness 自我演化 |
| **结构化纠错** | wowhow.hashnode 2026-05 | correction prompt 三要素（什么错/为什么错/该怎样）；**最高杠杆 = 把失败测试输出/编译器错误原文放进纠错 prompt**；模糊纠错（"再试一次"）几乎无效 |
| **工具最小化** | lowtouch.ai 2026-08 | 每个工具问"最坏能做什么、什么阻止它"；从日志而非猜测 debug（每个失败点名 harness 缺什么：指令/测试/护栏） |
| **术语澄清** | agentfactory crash course 2026-09 | **Karpathy 没造 harness engineering**（他造 agentic engineering 2026-02，普及 context engineering 2025-06）；引用时别混淆 |
| 认知框架 | 业界讨论 | "模型是 CPU，harness 是操作系统，上下文工程只是 OS 内存管理子集" |

## 4. 一盏茶方案更新（对照一手原文 + 最新动向）

| 新增/强化项 | 依据 | 落地建议 | 优先级 |
|---|---|---|---|
| **模型路由（复杂度→专家/模型）** | Model Router 64% 成本案例 | M5 Orchestrator 加复杂度分级：简单 query 走廉价路径、深度请求（mentor 复盘）走专家+慢模型 | P1 |
| **结构化纠错三要素** | wowhow 结构化纠错 | review.md/caveman-review 的 finding 升级：**问题/根因（为什么）/修复指引**，并附失败测试输出原文 | P1 |
| **文档一致性机械化** | OpenAI linter+CI 验证知识库 | eval-harness 加"文档一致性"维：ADR 索引 vs docs 目录、CI job 数引用、路径引用——漂移自动抓（现手动） | P1 |
| **AGENTS.md 地图模式确认** | OpenAI 原文"~100 行地图 + docs 记录系统 + 渐进式披露" | 方向已同构；后续精简学习记录外置时以此为据（需用户拍板） | P2 |
| **架构文档评分追踪** | OpenAI"评分并追踪差距" | docs/architecture/system-overview 加"各域/层成熟度评分"节 | P2 |
| **后台垃圾回收** | OpenAI 后台清理任务 | eval-harness 挂 CI 定时/每周跑（现手动 --verify） | P3 |
| **HarnessX 自适应演化** | arXiv 2606.14249 | 远期参考：harness 自身可演化（meta-agent 四阶段） | P3 |

> 底座更新：本文件 + `research-harness-engineering-285-2026-10.md`（总纲）+ `research-harness-alibaba-2026-10.md`（阿里落地）+ `research-multiagent-278-2026-10.md`（多智能体）。
