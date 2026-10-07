# 一盏茶 工程单 PLAN — harness 研究落地（2026-10-07）

> 目的：把 5 篇研究底座（278/285/阿里/最新进展/技术比对）提炼为可执行工程单，与既有 TODO-PRIORITY 合并统一排序。每项标：现状 / 下一步 / 验证级别（AGENTS.md §5 Modification Level）/ 依赖。
> 前置原则：不造轮子（先查成熟实践）；每次完成一件事 → 多轮 review → 再报告；治理文档与实现同步。

## 1. 研究底座总结（5 篇 → 核心结论 → 提炼工程动作）

| 研究文档 | 核心结论 | 提炼出的工程动作 |
|---|---|---|
| research-harness-alibaba-2026-10.md | 五层结构/薄主会话/门禁阻断/经验三级进化/七维评测 | ✅ 已落地：eval-harness.cjs 七维评测（m5-s2 93/100）、经验三级进化（AGENTS.md §13） |
| research-multiagent-278-2026-10.md | 铁三角（指挥官/过滤器/审计员）/五流程/动态派生/记忆模块 | 审计员风险标记（无来源标 ⚠）；会话记忆落地（表已建）；规划节点；动态派生（远期） |
| research-harness-engineering-285-2026-10.md | 四组件（上下文/约束/反馈/熵）/三阶段落地/行业案例 | ArchUnit 分层测试；Linter 三要素；doc-gardening；AGENTS.md 精简（需拍板） |
| research-harness-latest-2026-10.md | 一手原文验证 + 2026-H2 新动向（模型路由 -64% 成本/结构化纠错/平台原生/HarnessX） | Orchestrator 复杂度路由；review 结构化纠错三要素；文档一致性机械化；后台垃圾回收 |
| research-harness-vs-tech-2026-10.md | 工具双雄（Claude Code/Codex）+ MCP 协议层；**Spring AI Alibaba 原生支持 MCP（查证）** | MCP 工具化试点（culture-search 暴露为 MCP tool）——本次最大技术结合点 |

## 2. 优先级工程单（合并既有 TODO-PRIORITY + 研究新出项）

### P0 主线（承重 / 用户点名 / 依赖链头部）

| # | 事项 | 现状 | 下一步 | 验证 | 依赖 |
|---|---|---|---|---|---|
| P0-1a | **M5 五专家注册**（advisor/taster/brewer/mentor） | 仅 librarian 注册 | 按 AgentType 枚举逐个注册（teaAI 降级链保留） | L2（测试+type-check+build） | 无 |
| P0-1b | **会话记忆读写**（ai_chat_sessions/ai_messages 已建表） | 表就绪无代码 | 实现 ChatMemoryService：多轮上下文锚定（278"Save Plan"） | L2 | 无 |
| P0-1c | **混合检索向量路径 + embedding 回填**（pgvector + pg_trgm RRF） | 基建就绪（ADR-013/V3/8 表 RAG ILIKE 路径已通） | CultureSearchService 加向量分支 + 回填管线 | L3（ADR 已有 + 迁移测试） | **P0-2 AI key** |
| P0-2 | **AI key 启用**（AI_DASHSCOPE_API_KEY） | 当前 502 降级态 | 用户填 .env → docker compose up -d backend | L0/L2 冒烟 | 用户操作 |
| P0-3 | **前端返工**（~500 处硬编码色值） | 示范完成（colorTokens 10 令牌 + 2 组件） | 逐文件等价替换（值=令牌）→ 视觉批次过设计门禁 | L1（type-check+build） | 截图验证（cu 环境待解） |

### P1 研究落地（本会话新增，按价值序）

| # | 事项 | 依据 | 下一步 | 验证 |
|---|---|---|---|---|
| P1-0 | **后端 ArchUnit 分层测试** | 285"约束必须自动化"；OpenAI Linter 机械化 | 编码规范.md 分层规则 → ArchUnit 测试（Controller→Service→Repository 单向/禁 Controller 查库/构造器注入）→ CI 门禁 | L2 |
| P1-1 | **MCP 工具化试点** | 技术比对查证：Spring AI Alibaba 原生支持 | 新建 MCP server 模块：culture-search 暴露为 MCP tool → ChatClient defaultTools 自动注册 | L2 |
| P1-2 | **Orchestrator 复杂度路由** | 最新动向：Model Router 成本 -64% | query 复杂度分级 → 廉价路径（文化域/回落）vs 深度路径（专家+慢模型） | L2 |
| P1-3 | **review 结构化纠错三要素** | 最新动向：纠错=什么错/为什么/该怎样+附失败原文 | review.md/caveman-review finding 格式升级（问题/根因/修复指引） | L1 |
| P1-4 | **文档一致性机械化** | OpenAI linter+CI 验证知识库 | eval-harness 加"文档一致性"维：ADR 索引/CI job 数/路径引用漂移自动抓 | L2 |
| P1-5 | **审计员风险标记** | 278 审计员铁律 | LibrarianAgent 输出加"⚠ 无来源"标记（逐句对证据） | L2 |
| P1-6 | M2 ai_usage_logs 消费端 | 既有 | 每日统计+预算告警（后端定时任务） | L2 |
| P1-7 | 前端优化 P-O 系列 | 既有（研究已出） | P-O4 RAG 引用展示 → P-O1 Web Vitals → P-O2/P-O3 | L1/L2 |
| P1-8 | 茶园 S1 切片 | 既有（PRD 已出 5122ed8） | 按 PRD 开工（独立于 AI key） | L3（新表走 Flyway+ADR） |
| P1-9 | 生产上线 HTTPS+域名 | 既有 | 证书挂载 → 443 → 跳转 | L2 部署验证 |
| P1-10 | OPTIMIZATION_PLAN 残留核对 | 既有 | 对照新栈逐项核对（限流/熔断等） | L2 |

### P2 工程卫生（既有 + 研究）

| # | 事项 | 下一步 |
|---|---|---|
| P2-1 | AGENTS.md 精简评估（50-100 行地图模式） | 学习记录外置 docs/lessons.md → 主体压向 100 行（**需用户拍板**） |
| P2-2 | doc-gardening 脚本化 | eval-harness 一致性维落地后挂 CI 定时（每周） |
| P2-3 | 架构文档成熟度评分追踪 | docs/architecture/system-overview 加"各域/层成熟度评分"节 |
| P2-4 | 开源曝光落地 | Good First Issue / 传播帖 / release / Discussions |
| P2-5 | 仓库卫生 | .git 160MB / 旧 jpg fallback（filter-repo 待拍板） |
| P2-6 | HANDOFF 交接文档更新 | 会话收尾更新（含本 PLAN） |
| P2-7 | 残留数据清理 | 冒烟用户 smoke102054 / Exited postgres:16 旧容器（本地） |

### P3 远期（观察/环境）

| # | 事项 | 说明 |
|---|---|---|
| P3-1 | 动态派生（278"撒豆成兵"） | 按 query 复杂度实时派生专家数（当前 5 专家固定够用） |
| P3-2 | HarnessX 自适应 harness（arXiv） | harness 自我演化（Digester/Planner/Evolver/Critic）——学术前沿观察 |
| P3-3 | 后台垃圾回收定时 | eval-harness 全量挂 CI 定时（每周） |
| P3-4 | 截图验证环境 | cu 虚拟桌面被占用——需用户处理占用或换通道（前端返工 P0-3 前置） |

## 3. 建议执行顺序（依赖图）

```
Phase A（P0 主线，可并行）          Phase B（P1 研究落地，A 后可并行）
P0-1a 五专家注册 ──────────────→   P1-0 ArchUnit（改造成本最低）
P0-1b 会话记忆   ──────────────→   P1-1 MCP 工具化（接 P0-1a 专家）
P0-2  AI key（用户）──→ P0-1c     P1-2 复杂度路由（接 P0-1a）
P0-3  前端返工（独立并行）         P1-3 结构化纠错（接 review 流程）
                                  P1-4 文档一致性 → P2-2 doc-gardening
P1-8 茶园 S1（独立并行）           P1-5 审计员风险标记（接 P0-1a）
```

- **推荐第一步**：P0-1a 五专家注册（无依赖、纯代码、直接推进多智能体主线——用户反复点名的重构核心目标）。
- **P1 推荐序**：P1-0 ArchUnit（成本最低门禁收益最直接）→ P1-1 MCP（最大技术结合点）→ P1-2 复杂度路由。
- **等待项**：P0-2 AI key（用户）；P3-4 截图环境（用户处理占用）。
