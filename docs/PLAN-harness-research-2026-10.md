---
last_updated: 2026-10-07
status: active
owner: yanha
---

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

> ⚠️ **P0-3 编号撞车（2026-10-10 实测确认）**：`P0-3` 在三份文档里指**三个不同事项**——本文 = **前端返工（硬编码色值）**；`docs/TODO-PRIORITY.md`（已 deprecated）= AI key 启用；`docs/OPTIMIZATION_PLAN.md` = PWA 更新改 prompt。
> 交接里说的「A4 解锁 **P0-3 前端返工验收**」用的是**本文含义**。读到裸 `P0-3` 必须先确认出自哪份文档，禁止按默认理解开工。新增工程单编号一律带文档前缀（如 `hrs-P0-3`），不再复用裸编号。

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
| P1-0 | **后端 ArchUnit 分层测试** | 285"约束必须自动化"；OpenAI Linter 机械化 | ✅ 已落地（2026-10-07）：backend/src/test/java/com/tea/architecture/LayerDependencyTest.java（红线 #1 四规则：Controller 禁查库/禁反向依赖/Repository 不依赖上层/禁字段注入，错误信息三要素），CI Maven test 门禁 | L2 |
| P1-1 | **MCP 工具化试点** | 技术比对查证：Spring AI Alibaba 原生支持 | ✅ 已落地（2026-10-07）：CultureSearchTool（@Tool）+ McpToolConfig（ToolCallbackProvider）+ SSE WebMVC transport（GET /mcp 握手 /mcp/messages JSON-RPC）+ Security 放行 + 测试 6（mvn 133 全绿）+ Docker 冒烟 `event:endpoint data:/mcp/messages?sessionId=`；MCP 是暴露层，承重墙零改动 | L2 |
| P1-2 | **Orchestrator 复杂度路由** | 最新动向：Model Router 成本 -64% | query 复杂度分级 → 廉价路径（文化域/回落）vs 深度路径（专家+慢模型） | L2 |
| P1-3 | **review 结构化纠错三要素** | 最新动向：纠错=什么错/为什么/该怎样+附失败原文 | ✅ 已落地（2026-10-07）：caveman-review SKILL.md + docs/skills/caveman-review.md 升级为 `L<line>: <severity> <problem>. <why>. <fix>.` + 关键项附失败原文 | L1 |
| P1-4 | **文档一致性机械化** | OpenAI linter+CI 验证知识库 | ✅ 已落地（2026-10-07）：scripts/verify-harness.cjs（ADR 连续性/CI job 数/技能数/路径引用），首跑抓出流程族 30→32 漂移已修，期望 ERRORS: [] | L2 |
| P1-5 | **审计员风险标记** | 278 审计员铁律 | LibrarianAgent 输出加"⚠ 无来源"标记（逐句对证据） | L2 |
| P1-6 | M2 ai_usage_logs 消费端 | 既有 | 每日统计+预算告警（后端定时任务） | L2 |
| P1-7 | 前端优化 P-O 系列 | 既有（研究已出） | P-O4 RAG 引用展示 → P-O1 Web Vitals → P-O2/P-O3 | L1/L2 |
| P1-8 | 茶园 S1 切片 | 既有（PRD 已出 5122ed8） | 按 PRD 开工（独立于 AI key） | L3（新表走 Flyway+ADR） |
| P1-9 | 生产上线 HTTPS+域名 | 既有 | 证书挂载 → 443 → 跳转 | L2 部署验证 |
| P1-10 | OPTIMIZATION_PLAN 残留核对 | 既有 | 对照新栈逐项核对（限流/熔断等） | L2 |

### P2 工程卫生（既有 + 研究）

| # | 事项 | 下一步 |
|---|---|---|
| P2-1 | AGENTS.md 精简评估（50-100 行地图模式） | ✅ 评估完成（2026-10-07）：204 行在维护区间 200-350，维持现状；学习记录已按维护规则限长，不外置 |
| P2-2 | doc-gardening 脚本化 | ✅ 已落地并挂 CI 合并门禁（2026-10-07）：scripts/verify-harness.cjs + harness-consistency job（CI 13 job） |
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

## 4. Harness 优化研究池（2026-10-08 并入）

> 来源：`docs/research-harness-audit-2026-10-08.md` §6 增量建议 + `docs/research-harness-domestic-2026-10.md` §5 差距项；经适配性裁剪（v2，砍 9 项）。
> 已批准执行：K1-K6（Phase 0+1）。本节约为索引；逐项依据、甄别理由、验收以 `docs/plans/PLAN-harness-optimization-2026-10-v2.md` 为准，不重复维护。

| 项 | 事项 | 优先级 | 状态 |
|---|---|---|---|
| K7 | 技能准入：可执行类技能标注验证命令 | P1 | 待批准 |
| K8 | 评审-修复闭环 ≤2 轮 | P1 | 待批准 |
| K9 | 经验链路：lesson→pattern 迁移 + 自动收根因行 | P1 | 待批准 |
| K10 | ArchUnit 扩展（@Transactional/ApiResponse 断言，L3 需 ADR） | P1 | 待批准 |
| K11 | 开工自查清单 | P2 | 待批准 |
| K12 | CI "job 进==出"看门打印 | P2 | 待批准 |
| K13 | gen-repomap.cjs（tree-sitter） | P2 | 待批准 |
| K14 | LLM mocking 确定性测试（依赖 P0-2 AI key） | P2 | 待批准 |
| K15 | 后端结构化 JSON 日志 + request_id（依赖后端重写，L3 需 ADR） | P2 | 待批准 |
| K16 | eval 补 Java/JPA 切片（依赖后端重写） | P2 | 待批准 |
| K17 | Trace→回归样本约定 | P2 | 待批准 |
| K18 | eval 历史基线自动 diff | P2 | 待批准 |
| K19 | 每周 cron（13364196800514）query 追加 verify 重跑 + eval 报告 | P2 | 待批准 |
| K20 | 结果度量（AI 提交占比，从今起带标记） | P2 | 待批准 |
| K21 | HANDOFF 分级（L3 强制写 / L0 不写） | P2 | 待批准 |
| K22 | 润化包 8 子项（G24 ①-⑧） | P2 | 待批准 |
| K23 | 截图打通（依赖 P3-4 截图环境，用户侧） | P1 | 待批准 / 依赖用户 |
