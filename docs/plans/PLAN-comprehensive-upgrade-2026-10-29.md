---
name: plan-comprehensive-upgrade-2026-10-29
description: 一盏茶全面升级蓝图（2026-10-29）——把项目从「AI 深度单点」升级为「AI×产品×工程×举证」全维度：四维度现状盘点（子代理只读实测，带证据）+ 优先级取舍 + 分批实施计划 + 待拍板决策点
status: draft
owner: yanha
last_updated: 2026-10-29
---

# 一盏茶全面升级蓝图（2026-10-29）

> 定位：一盏茶不只是「AI 深度单点项目」，而是 **AI × 产品 × 工程 × 举证 四个维度都有实证支撑的全栈 LLM 应用工程**。本蓝图把四个维度合进一条实施主线，每个批次完成后必须「可运行验证 + 证据沉淀 + git 分支提交（不 push，交用户开 PR）」。
> 口径纪律（沿用）：评测数字只引 `docs/ai-eval/ITERATIONS.md` 版本表；RAG 命中率单独追踪；数字一律实测后引用，未实测标「未实测」。

## 0. 一分钟结论

- **现状（2026-10-29 四子代理只读实测）**：AI 深度最强（v8 0.95 / programOnly 1.0 / pass¹ 45/50 / RAG 0.38）；工程硬能力代码侧已厚（遥测契约+实现、安全收口、CI 14 job、测试 31+13+78+9 文件）；产品功能闭环基本齐（缺账号/成就/后台 4 类收尾）；求职举证有 **3 处口径硬伤**（见 §1.4）。
- **主线一（已拍板）**：AI 四方向落地 = Batch 1（向量 RAG / 多工具 Agent / 流式输出 / 长期记忆）。
- **主线二（新增）**：Batch 2 举证口径修复（L0、约 1 天、防面试翻车）→ Batch 3 产品功能补全 → Batch 4 工程硬能力补全 → Batch 5 长期收尾。
- **待拍板 7 个决策点**（§4，每条带推荐 + 代价 + 反转条件）。

## 1. 现状盘点（2026-10-29 实测，证据=文件路径）

### 1.1 AI 深度（最强项）

| 机制 | 现状（实测） | 证据 |
|---|---|---|
| 5 专家路由 | advisor/taster/librarian/brewer/mentor 派发表 + null/CHAT 回落透明代理 | `backend/src/main/java/com/tea/ai/service/AiChatService.java` L127-132, L337-365 |
| 隐式路由 + complexity 三档 | 显式 agent 校验；无 agent 时 18 文化关键词粗分 → LIBRARIAN；SIMPLE（≤40 字≤3 轮直答）/ COMPLEX（>200 字历史压 5 条）/ MEDIUM（20 条全锚） | `agent/AgentOrchestrator.java` L44-88；`application.yml` L85-89 |
| 检索 | 8 表 ILIKE（teas/people/regions/poems/teawares/etiquettes/relations/processes）+ B1 类目直查（teas.name+category 双列 + 乌龙茶/岩茶→青茶别名）+ 向量补缺分支 | `culture/service/CultureSearchService.java` L83-124, L150-187, L257-310 |
| 向量基础设施 | **已在位**：pgvector/pg16 镜像（内置 vector+pg_trgm）、`culture_chunks` vector(1024) + HNSW 索引 + 回填管线（ChunkBackfillService + admin backfill 端点）；三级降级（no_model / embed_failed / query_failed → 纯 ILIKE） | `V3__agent_memory.sql` L6-27；`CultureSearchService.java` L154-187 |
| 会话记忆 | ai_chat_sessions / ai_messages（登录用户专属，anchor ≤20 条，归属校验防越权） | `V3__agent_memory.sql`；`ai/service/ChatMemoryService.java` |
| MCP | `/mcp` SSE 端点存活，**仅 1 工具** CultureSearchTool；进程内 Tool Calling（culture_query）走 librarian 灰度不经 MCP | `ai/mcp/McpToolConfig.java` L16-19；`ai/tool/CultureQueryTools.java` |
| 评测 | eval-tea-ai.cjs + LLM-as-Judge；**v8 = 0.95 / programOnly 1.0 / pass¹ 45/50 / RAG 命中 0.38**（0.16→0.38 主因评测链路修复，非 B1） | `docs/ai-eval/ITERATIONS.md` L34；`docs/ai-eval/reports/2026-10-28.json` |
| 前端承重墙 | 30s AI 超时 / 5s RAG 超时 / 规则回复降级 / 429 清会话 | `src/services/teaAI.ts` L21/L26/L337-504 |

**缺口**：embedding 外部通道死（DashScope 欠费 400 Arrearage，不充值）→ **自托管 embedding 是解锁向量 RAG 的唯一路径**（仓库 0 处 onnx/bge 痕迹，空白起步）；MCP 仅 1 工具；后端 0 处 SseEmitter/Flux（实测 grep 0 命中）；无跨会话记忆（纯会话级）。

### 1.2 产品功能（闭环齐，收尾缺）

业务闭环 7 环节：入席/选茶/备器/煮水/冲泡/品鉴记录 = **已实现**；个人成长 = **半实现**（等级/XP/六境 + 5 条成就解锁逻辑在 `stores/progress.ts`，但成就无展示墙，仅解锁弹窗）。路由 21 条、页面 21 个（`src/router/index.ts`），echarts 被 3 处真实消费（非闲置）。

**缺口（实测）**：

| 缺口 | 判断依据（证据） |
|---|---|
| 无登出 UI | `stores/auth.ts:85` logout 已实现，全 src 零组件调用 |
| 无路由登录守卫 | `router/index.ts:118-125` 仅查 requiresTea，全站游客可达 |
| 服务端/本地成长数据脱节 | 服务端 level/xp（auth.ts:16-18）与本地 `progress.userXp`（TeaProfile.vue:64-97）两套不同步 |
| 成就徽章无展示墙 | progress.ts:49 成就列表仅 TasteView.vue:656 解锁弹窗；TeaProfile.vue（181 行）零引用 achievements |
| 无账号资料/改密页 | 路由无对应页；AuthController 仅 register/login |
| 4 组后端管理端点无前端消费页 | admin/experiments、admin/culture/chunks/backfill、telemetry slo+review、ai/metrics golden+quality（对应 4 个 Controller）；src/ grep admin=0 |
| 分享生成端入口未核实 | ShareView.vue 双模式完整（?r= 品鉴卡 / ?t= 名茶卡），但「哪个页面有分享按钮」未实测 |

### 1.3 工程硬能力（代码侧厚，运维侧未验证）

**已有（实测）**：遥测契约+前后端全实现（`docs/reference/telemetry-contract.md` 161 行 + `backend/src/main/java/com/tea/telemetry/` + `src/services/telemetry/`）；Prometheus/Grafana 配置齐备（`deploy/observability/`，告警规则机械化审计 verify-alert-rules.cjs）；无状态 JWT fail-closed + BCrypt；X-Admin-Token 常量时间比较（修过 %61dmin 编码绕过）；限流落地（AI 匿名 3/min+100/日、登录 30/min、遥测 30/min、单批 ≤50 条）；nginx 安全头全套 + /actuator 除 health 全 404 + /mcp 显式 404；端口收口（db 不映射宿主）；IP 证书在线（HTTPS 200 实测，cron 2 天续期）；CI **14 job**（与 AGENTS.md 一致）；测试 31 前端 spec / 13 e2e / 78 Java / 9 pytest。

**缺口（实测）**：

| 缺口 | 判断依据（证据） |
|---|---|
| 线上 LCP 5.8–6.3s 无复测 | ADR-022 L17 记录 2026-10-17 实测；PLAN-storage §7 只有 JS 降幅（121.09→89.95KB），无改后 LCP 复测值 |
| 观测栈服务器运行状态未验证 | `deploy/observability/docker-compose.observability.yml` 是「-f 叠加」可选 overlay，无服务器运行证据——**未实测，禁当结论** |
| 告警阈值未校准 | `deploy/prometheus/alerts.yml` L6-8 自述「初始值，上线后观察一周再收紧」 |
| 日志仅控制台 | `logback-spring.xml` 仅 CONSOLE appender（注释明说不引 logstash 库），无集中检索 |
| 443 /api/ 缺 X-Request-ID | `docs/plans/PLAN-ip-cert-2026-10-18.md:202` 「仍未处理」（80 块有） |
| 限流单实例内存实现 | `RateLimitFilter.java:24` 注释自认；多实例需 Redis（ADR-021 已判不引，当前接受） |
| gitleaks 不扫 git 历史 | `ci.yml:102-103` 注释自认（历史有旧遗留口令，需轮换） |
| 前端视图层单测稀薄 | 31 spec 中 views 仅 3 个 |
| 无性能/负载测试 | scripts/ 无 k6/lighthouse/benchmark |
| 无 deploy 自动化流水线 | 仅 ci.yml + deploy-pages.yml；发版=人工 SSH + compose up |
| CSP style-src unsafe-inline | `nginx/snippets/security-headers.conf:23`（Vue inline 折中，已接受） |

### 1.4 求职举证（材料全，口径有 3 处硬伤）

**已有（实测）**：README 123 行覆盖 RAG/五专家/降级/评测闭环（缺 MCP/记忆表述）；system-overview.md 面试可用（五专家路由图、离线同步序列图）；PORTFOLIO-EVIDENCE 机制清单 10 项 + 3 个真实排查案例；在线演示 **HTTPS 200 实测**（RawContentLength 3227）；远端一致（github.com/qiuqianyi66/tea-ceremony.git）；简历主版本（外部）`C:\Users\yanha\Desktop\闫航简历\闫航简历-AI.pdf`；career-os 实际在 `C:\Users\yanha\Desktop\work\career-os`。

**硬伤（实测）**：

| # | 硬伤 | 证据 | 风险 |
|---|---|---|---|
| 1 | 简历写「PostgreSQL/pgvector 承载向量检索」，内部诚实归因是 culture_chunks 0 行、embedding 欠费不可用、当前在用 B1 类目直查（ILIKE） | 简历难点一 vs PORTFOLIO-EVIDENCE §3.3 | **最高风险**：面试官追问 pgvector 检索效果即与 RAG 0.38 内部口径冲突 |
| 2 | README 评测数字停在 v3 0.81（实际 v8 0.95）；茶单 40（实测 66）；ADR 020（实测 027）；CI 13/14 并存 | README L78/L111/L74；实测 66 款茶、27 个 ADR | GitHub 门面落后 5 个评测版本 |
| 3 | ITERATIONS.md 自相矛盾：L34 已记 v8=0.95，L188/L205 仍写「最新可引用 v6 0.90」 | ITERATIONS.md L34 vs L188-205（STAR 模板整段 v6） | 简历照抄 STAR 模板会写旧数 |

另：简历无任何评测分数（v8 四数字缺失）；career-os metrics_ledger 停在 v5；面试复习稿 0.95/0.90/45-50 零命中；PORTFOLIO-EVIDENCE §5 网关 bak 文件（`D:\yg-gateway\config.json.bak-20261028`）已存在但未勾销登记。

## 2. 优先级与取舍

| 批次 | 内容 | 成本 | 价值 | 依据 |
|---|---|---|---|---|
| B1 | AI 四方向落地（已拍板） | 高（最长链=向量 RAG） | 决定性 | 用户拍板 + 求职主线 |
| B2 | 举证口径修复 | 低（L0 文档，约 1 天） | 高（防面试翻车） | §1.4 三处硬伤 |
| B3 | 产品功能补全 | 中 | 中高 | §1.2 缺口 |
| B4 | 工程硬能力补全 | 中 | 中 | §1.3 缺口 |
| B5 | 长期收尾 | 中 | 中 | 外部条件 |

**明确不做（YAGNI，每项给理由，进 out-of-scope 决策区）**：

- **社区/社交功能**：举证价值低、工作量大、非目标岗位核心信号；反转条件 = 用户要做运营型产品。
- **AI Graph 编排**：维持 ADR-018（多工具走 MCP 工具扩展，不引编排框架；业务闭环无多步有状态需求）。
- **Redis / 多实例**：维持 ADR-021（单实例限流接受）；反转条件 = 水平扩容。
- **SFT 微调**：维持 out-of-scope（等预算数字）；与 B1 自托管 embedding 不冲突。
- **admin 完整管理页**：见 D3，推荐 curl/脚本代替。

## 3. 分批实施计划

### 3.1 Batch 1：AI 四方向落地（已拍板，最高优先）

#### 3.1.1 向量 RAG：自托管 embedding 解锁（最长链，先开工）

- **现状**：基础设施全在位（pgvector/HNSW/回填管线/三级降级），缺本地 EmbeddingModel bean；注入点已解耦（CultureSearchService L63 与 ChunkBackfillService L31 均用 `ObjectProvider<EmbeddingModel>`，新增 bean 即被两处用上，不改检索/回填主逻辑）。
- **方案要点**：
  1. 拍板 D1（§4）：embedding 模型选型。
  2. 引入 `com.microsoft.onnxruntime:onnxruntime` 1.27.0（Maven Central 已确认）。
  3. 自写 EmbeddingModel 适配 bean：ONNX 图 + tokenizer + L2 归一化（余弦依赖归一化，错配毁召回；社区 ONNX 导出需自验）。
  4. 按选型做 schema 动作：512 维 → 新迁移 `ALTER COLUMN vector(512)` + 重建 HNSW + 全量重嵌；1024 维 → 免改表。
  5. 模型文件放项目外受控目录，**禁止提交仓库**。
  6. 保留 CultureSearchService 三级降级 + teaAI.ts 规则降级（承重墙回归，评测 50 条不回归）。
- **验收**：容器实测 backfill 成功；手工 case 命中（黑茶→5、乌龙茶/武夷岩茶→青茶、紫砂壶泡黑茶→teawares）；50 条评测不回归；RAG 命中率如实记录（提升或持平都如实归因，不许把链路修复算到 embedding 头上）。
- **证据沉淀**：PORTFOLIO-EVIDENCE §5 B3 节 + ITERATIONS 新版本行 + ADR（如 512 迁移）。
- **风险**：bge 社区 ONNX 导出非官方（归一化/tokenizer 自验）；Spring AI 1.1.2 无 ONNX starter，适配工作量未估。

#### 3.1.2 多工具 Agent：MCP 工具扩展（短链）

- **候选工具（按现有后端能力，每工具带证据）**：

| 候选 | 后端证据 | 服务谁 |
|---|---|---|
| 品鉴记录查询（列表/详情/均值） | `record/controller/TastingRecordController.java` L27-52 | taster 对比历史、mentor 复盘 |
| 茶品详情查询（含冲泡参数） | `tea/controller/TeaController.java` L19-34 | advisor 荐茶、brewer 校准 |
| 类目直查拆独立工具 | CultureSearchService L86 + L257-260 | librarian |
| 茶园植物/能量查询 | `garden/controller/GardenController.java` L25-48 | mentor 成长复盘 |
| 会话历史读取 | `ai/controller/AiSessionController.java` L27-55 | 跨工具上下文（**隐私敏感：带鉴权范围限定或缓**） |

- **落地模式**：照现有试点（@Tool bean + McpToolConfig 登记一行）。
- **验收**：/mcp 暴露 ≥3 工具；外部 agent 冒烟调用成功（SSE 握手 + 实际检索）；评测集不回归。
- **边界**：六境评分工具需先补后端数据（见 D6）——当前六境仅前端评分表，MentorAgent L40 只有顺序锚定。

#### 3.1.3 流式输出：SSE 文本流（中链）

- **现状**：后端 0 处 SseEmitter/Flux（实测 grep 0 命中）；前端无 getReader/EventSource；需求文档 `docs/prd/REQ-ai-sse-2026-10-11.md` 已成文（F1-F4，MVC 栈不引 WebFlux 已拍板）；out-of-scope D5（2026-10-17 暂缓）**已翻案：用户拍板重启**。
- **方案要点**：
  1. MVC 栈用 **SseEmitter**（不引 WebFlux）。
  2. 新端点 `POST /api/v1/ai/chat/stream`；AiChatService 增流式方法复用五专家 callLlm。
  3. TraceRecorder / AiUsageLogger 结算时机移到「流结束事件」（防静默丢数据重演，参考 PR #43 教训）。
  4. 前端 teaAI.ts 加 fetch + getReader 流式分支（可带 Authorization，不用 EventSource）+ AIAsk.vue 逐 token 渲染；**流失败自动回退整段路径**。
  5. 评测器继续走整段（口径不分裂，REQ §3.3 Not Doing）。
- **验收**：手工流式体验（token 渐显、中断可回退）；50 条评测整段口径不回归；降级链保留。
- **边界（已定）**：先文本流；工具流（tool_calls 流事件）后续再集成，边界写入设计文档。

#### 3.1.4 长期记忆：跨会话用户偏好（短链，L3）

- **现状**：纯会话级记忆（ai_chat_sessions / ai_messages）；需求缺口已识别（REQ-ai-project G-10/F-B2：识别什么/可查看删除/记错怎么办），无正式设计文档。
- **方案要点**：
  1. 新表 `user_preferences`（user_id / preference_type / value / source_session / created_at）+ 查看/删除接口。
  2. **ADR-028** + **Flyway V11**（实测当前迁移到 V10__ai_quality_layer.sql）+ upgrade/downgrade 往返测试。
  3. 注入点：AiChatService.anchor() 旁加偏好 prefill（与会话历史前插同模式）。
  4. 隐私红线：可查看 / 可删除 / 不存敏感信息（沿用 REQ-ai-project 影响分析）。
- **验收**：迁移往返测试通过；跨会话偏好注入实测；越权防护单测。
- **证据沉淀**：ADR-028 + 迁移脚本 + 单测 + PORTFOLIO-EVIDENCE 记忆节更新。

### 3.2 Batch 2：求职举证口径修复（L0，优先——防面试翻车）

1. **ITERATIONS.md**：统一 L188/L205「最新可引用」为 v8；STAR 模板整段从 v6 升 v8（0.95 / 1.0 / 45-50 / RAG 0.38）。
2. **README**：评测数字 v3→v8、茶单 40→66、ADR 020→027、CI 数统一（13/14 先实测再定）、补 MCP 与会话记忆简述。
3. **简历侧（外部 career-os 流程，用户决策）**：补 v8 四数字；**RAG 表述诚实化**——「向量检索通道落地中，当前在用类目直查+ILIKE」（或等 B1 落地后写真实状态，不许把预留写成在用）；测试数口径实测后统一（README 211 vs 简历 214 漂移）。
4. **career-os metrics_ledger** 升 v8；**面试复习稿**补 v8 叙事（PORTFOLIO-EVIDENCE §3 三个案例弹药进复习稿，当前 0.95/0.90/45-50 零命中）。
5. **PORTFOLIO-EVIDENCE §5**：网关 bak 文件已存在 → 勾销登记（`D:\yg-gateway\config.json.bak-20261028`）。
- **验收**：README/ITERATIONS 无旧口径残留；简历数字全部可追溯 ITERATIONS v8；grep 全库无「v6 为最新」表述。
- **证据**：每处改动一个 commit（L0，无需测试）。

### 3.3 Batch 3：产品功能补全（P1 先做）

1. **成就徽章墙**：progress.ts 数据已有，补展示页（TeaProfile 或 GrowthView 区块）——成就系统激励闭环。
2. **账号闭环**：登出 UI（logout 已实现零调用）+ 服务端/本地成长数据打通（按 D4 决策）。
3. **分享入口**：先补查生成端入口（ShareView 完整但入口未核实），缺口则补分享按钮 + 分享冒烟。
4. **账号资料/改密**：后端新增端点（L2，需测试）。
5. **admin 前端**：按 D3 决策（推荐不做完整管理页）。
- **验收**：每项 L1/L2 验证（type-check + build / 测试）+ 改前改后截图（项目 UI 改动纪律）。

### 3.4 Batch 4：工程硬能力补全

**P1（低成本）**：
1. **LCP 复测**：PLAN-storage 已降首屏 JS 25.7%（121.09→89.95KB），缺改后实测——跑一次线上/本地测速并记录（目标对齐 2500ms 或如实标注）。
2. **观测栈服务器运行验证**：Prometheus/Grafana 是否叠加运行；未启用则拍板并记明（不能停留在「配置齐备」）。
3. **告警阈值校准**：alerts.yml 初始值 → 观察期后收紧或明确豁免。
4. **443 /api/ X-Request-ID** 补上（PLAN-ip-cert L202 未处理）。
5. **日志集中化决策**（D5）。

**P2**：
6. **性能/负载测试脚本**（k6/lighthouse 冒烟，仓库当前零脚本）。
7. **deploy 流水线**（GitHub Actions deploy workflow，当前人工 SSH）。
8. **gitleaks 历史清理**（轮换口令，独立收尾项）。
9. **CSP style-src unsafe-inline 收紧评估**。

- **验收**：每项有验证记录/脚本入仓库；服务器侧项如实标注运行状态。

### 3.5 Batch 5：长期收尾

- B1 四方向落地后 PORTFOLIO-EVIDENCE 全量更新 + README/简历数字再同步（B2 可能已被覆盖，防二次漂移）。
- 外部条件跟踪：ECS 试用到期约 2027-01-13（HANDOFF-2026-10-27 记录）；SFT 等预算上限；证书续期零中断切换（PLAN §7 坑 2 未执行）。

## 4. 待用户拍板决策点

| # | 决策点 | 推荐 | 代价 / 反转条件 |
|---|---|---|---|
| D1 | embedding 模型选型 | **bge-small-zh-v1.5**（512 维，MIT，33M 参数，CPU 友好，onnxruntime 推理快）；代价 = 一次 L3 迁移（V11：ALTER vector(512) + 重建 HNSW + 全量重嵌，升级/回滚往返测试已具备机制） | 备选 bge-large-zh（1024 维免改表，模型大、CPU 推理重、社区导出待验）；反转 = 不愿动 schema |
| D2 | 流式工具流边界 | 先文本流，工具流后续集成（已定） | 反转 = 面试/演示需要工具流故事 |
| D3 | admin 管理前端 | **不做完整管理页**，curl / verify-production 代替（4 组端点内部工具性质） | 反转 = 用户要运营真实内容 |
| D4 | 账号登录守卫 | **不强制守卫**（保持游客可用），补登出 UI + 服务端/本地成长数据打通 | 反转 = 要做个人中心隔离 |
| D5 | 日志集中化 | 维持 docker logs（单机小流量），决策记录入档 | 反转 = 多实例 / 排查需求上升 |
| D6 | 多工具范围 | 4 工具先上（品鉴/茶品/类目/茶园）；会话历史工具带鉴权边界或缓；六境工具等后端数据 | 反转 = 面试要讲工具链故事需更快扩面 |
| D7 | 性能/负载测试 | P2 排期，k6 冒烟起步 | — |

## 5. 与既有决策的关系

- **out-of-scope 翻案登记**：SSE 流式输出（D5，2026-10-17 暂缓 → 2026-10-29 用户拍板重启）；`docs/plans/out-of-scope.md` 该行标 superseded + `REQ-ai-sse` 状态从 draft 更新。
- **维持**：ADR-018 Graph 编排砍（多工具走 MCP 工具扩展，不引编排）；ADR-021 不引 Redis（单实例限流接受）；SFT 等预算（out-of-scope）。
- **新增 ADR 预期**：ADR-028（长期记忆 user_preferences 表）；ADR-029（自托管 embedding 通道与维度迁移，按 D1 结果）。
- **衔接**：B1 四方向 ↔ PORTFOLIO-EVIDENCE §5 B3 待办（自托管 embedding 落地后更新 RAG 数字）；B2 ↔ career-os 事实库（外部项目，交付物在其流程内）。

## 6. 执行顺序与依赖

```
B2（L0 文档修复，约 1 天）            ← 可与 B1 并行，防面试翻车
B1.1 向量 RAG（最长链先开工）         ← 依赖 D1 拍板
B1.2 多工具（短链）                  ← 依赖 B1.1 之外的独立小链，可并行
B1.3 流式（中链）                    ← 独立
B1.4 长期记忆（L3，短链）             ← 独立
B3 / B4 P1 项                        ← B1 落地后按序排队
B5 收尾                              ← 四方向证据回填
每方向完成：测试/实测 → PORTFOLIO-EVIDENCE 对应节 → git 分支 feature/xxx 提交（勿 push，交用户开 PR）
```

## 7. 更新记录

- 2026-10-29：初稿（status: draft）。四维度盘点基于 4 个子代理只读实测（证据路径见 §1）；「未实测，禁当结论」项：观测栈服务器运行状态、优化后真实 LCP、测试实际通过率、分享生成端入口、TeaRoom/TeaBreak/TeaGraph 视图内容、bge-large ONNX 可用性。蓝图评审通过后转 active 并注册 TODO-PRIORITY 指针。
