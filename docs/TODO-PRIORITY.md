# 一盏茶 待办优先级清单（2026-10-07 更新）

> 全景待办梳理（基于仓库/记忆/PRD 核验），按优先级 P0/P1/P2 排序。P0=主线/承重/用户点名；P1=价值/体验；P2=工程卫生/发布。

## P0（现在就该做）

| # | 事项 | 现状 | 下一步 |
|---|---|---|---|
| P0-1a | **M5-S1 多智能体试点** | ✅ 完成（47c4a81b）：AgentType 枚举 + AgentOrchestrator 路由 + librarian 专家 + AiUsageLogger + sources | 已交付 |
| P0-1b | **M5-S2 数据库落地** | ✅ 完成（4d79c70+6634677）：ADR-013 + pgvector 镜像 + V3 迁移（culture_chunks/会话记忆表）+ 往返测试 + 8 表 RAG + CI/Testcontainers 同步 | 已交付 |
| P0-1c | **M5-S2 剩余**：混合检索查询实现（pgvector 向量路径）、embedding 回填管线、五专家注册（advisor/taster/brewer/mentor）、会话记忆读写（ai_chat_sessions/ai_messages 已建表无代码）、prompt 版本化（agent_prompts 表无数据） | 表/基建就绪，代码未写 | 混合检索+embedding 依赖 AI key（P0-3）；专家注册/会话记忆可先行 |
| P0-2 | **前端返工（企业级规范落地）** | 示范完成（colorTokens.ts 10 令牌 + TasteRadarChart/TeaKnowledgeCard 2 组件）；**518 处硬编码剩余 ~500 处未替换**；视觉会变页面需先补 DESIGN_SPEC + 截图验证（从未成功截图） | 逐文件等价替换（值=令牌直接换）→ 视觉批次过设计门禁 |
| P0-3 | **AI key 启用** | 当前 502 降级态（无 key） | 用户填 `AI_DASHSCOPE_API_KEY` 到 .env → `docker compose up -d backend` |

## P1（排期做）

| # | 事项 | 现状 | 下一步 |
|---|---|---|---|
| P1-1 | M2 ai_usage_logs 消费端 | 已拍板未做（每日统计+预算告警） | 后端定时任务 + 前端看板（可选） |
| P1-2 | 前端优化 P-O 系列 | 研究已出（docs/research-frontend-optimization-2026-10.md） | P-O4 RAG 引用展示 → P-O1 Web Vitals → P-O2/P-O3 性能 |
| P1-3 | 生产上线（HTTPS+域名） | nginx.conf HTTPS 块已留位注释 | 证书挂载 → 启用 443 → 跳转 |
| P1-4 | OPTIMIZATION_PLAN 残留核对 | 企业级优化方案部分项已随后端重写过时 | 对照新栈逐项核对（限流/熔断/gunicorn 等） |
| P1-5 | 茶园 S1 切片（能量账本 + 自动产能量 + 3D 阶段映射） | PRD 已出（garden-product-prd.md） | 按 PRD 开工（独立于 AI key） |

## P2（工程卫生/发布）

| # | 事项 | 现状 | 下一步 |
|---|---|---|---|
| P2-1 | 开源曝光落地 | README/og/推广包已备 | Good First Issue 实际开、传播帖发、release、Discussions |
| P2-2 | 仓库卫生 | .git 历史 160MB、旧 jpg fallback 12.8MB | filter-repo 重写（待拍板）、删不删决策 |
| P2-3 | HANDOFF 交接文档 | 10-06 版在仓库，10-07 未更新 | 会话收尾更新 |
| P2-4 | 残留数据清理 | 冒烟测试用户 smoke102054 在本地 db；Exited postgres:16 旧容器 | 本地可清（不影响生产） |

## 执行原则

1. 按 P0 顺序推进，P0 未清不做 P1 大项（P0-3 等用户 key，可并行 P0-1c/P0-2/P1-5）。
2. 前端返工遵守：等价替换零视觉风险优先（值=令牌的直接换）；视觉变化需截图验证（设计门禁）。
3. 每次完成一件事 → 多轮迭代 review → 再报告（已沉淀偏好）。
4. 治理文档与实现同步：改 CI job 数/ADR 编号/技能数量后立即更新 AGENTS.md + 对应规则文档（2026-10-07 已修 3 处：ADR 013 索引、CONTEXT 索引、CONTEXT 待办）。
