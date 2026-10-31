---
title: Tea AI 工程深度证据（作品集/面试用）
last_updated: 2026-10-30
status: active
owner: yanha
scope: 简历与面试举证专用——数字只取 ITERATIONS.md 已记录版本，不编
---

# Tea AI 工程深度证据

> 用途：AI 应用工程师 / LLM 应用开发实习生投递举证。本文件回答「这个项目 AI 到底深在哪」，全部结论有代码与评测报告可追溯。
> 口径纪律：评测数字一律引自 `docs/ai-eval/ITERATIONS.md` 版本表 + `docs/ai-eval/reports/`；RAG 命中率单独标注（与 overall 不同口径）。

## 0. 一句话定位

Tea 不是「调 API 的聊天机器人」，而是一个**带可验证评测体系的 Agent 系统**：5 专家路由 + LLM-as-Judge 自评 + RAG 检索 + 记忆 + 熔断降级，且每一层都有数字与测试支撑。

## 1. 核心机制清单（面试可展开项）

| 机制 | 实现位置 | 证据 |
|---|---|---|
| 5 专家 Agent（advisor/taster/librarian/brewer/mentor） | 后端 AiChatService + AgentOrchestrator 隐式路由 | 文化关键词→LIBRARIAN，其余透明代理；complexity 三档路由 |
| LLM-as-Judge 评测 | `scripts/eval-tea-ai.cjs` + `scripts/calibrate-judge.cjs` | 50 条评测集 / 98 考点 / judgeCoverage=1 全量判分 |
| pass^k 判定 | 评测器（--iterations k） | v7 men 子集 8 条 pass³ 6/8 |
| RAG 检索（当前 ILIKE + 类目直查） | `CultureSearchService` | teas/people/regions/poems/teawares/etiquettes/processes 七表；B1 加 category 直查 + 类目别名 |
| 对话记忆 | `ChatMemoryService`（会话级上下文注入） | chat 请求带 history |
| 跨会话长期记忆（F-B2 / ADR-028） | `UserMemoryService` + `UserMemoryExtractor` + V12 `user_memory` 表 | 单表 key-value（preference/restriction/habit 三类摘要），新会话开场注入 system prompt，旧会话结束 best-effort LLM 抽取合并写回；隐私红线：不存敏感信息、可查看可删除、越权归属校验 |
| 熔断 + 降级 | 后端 CircuitBreaker/降级链 + 前端 `teaAI.ts` | 30s AI 超时 / 5s RAG 超时 / 规则回复兜底 |
| SSE 文本流式（B1.3） | `POST /api/v1/ai/chat/stream`（SseEmitter，MVC 栈不引 WebFlux）+ 前端 fetch+getReader | 逐 chunk `{"d":...}` 增量渲染；末帧 `{"meta":{sessionId}}` + `[DONE]`；预流失败回退整段；服务层 6 测试（FrameSink seam） |
| AB 实验 | 后端分流 | /api/v1/ai/chat 分流记录 |
| MCP Server | `ai/mcp/McpToolConfig`（SSE /mcp 端点） | 3 个工具：cultureSearch（P1-1）+ brew_params / brew_advice（P2.2）；`McpServerIntegrationTest.p22ExposesAtLeastThreeTools` 锁定 |
| 多工具 Agent（进程内 function calling） | `ai/tool/` 4 工具 + `MultiToolAgent` 门面挂透明代理 | userId 服务端绑定防越权；工具失败回落无工具直答，502 降级链不变（见 §3.4） |
| 管理 backfill 管道（含安全审计） | /api/v1/admin/** + X-Admin-Token | Fail-closed，未配 token 全部 401 |
| 网关通道与人设链路排查 | 前端→yg-gateway→上游 LLM | 见 §3 案例 |

## 2. 评测数字（口径：50 条全量 full-judge，deepseek 通道）

| 版本 | 日期 | overall | programOnly | pass^1 | RAG 命中率 | 备注 |
|---|---|---|---|---|---|---|
| v6 | 2026-10-18 | 0.90 | 0.95 | 41/50 | 0.16 | 全量 judge 复跑基线 |
| v8-preB1 | 2026-10-28 | 0.95 | 1.00 | 45/50 | 0.38 | 干净基线（网关通道修复后；与并发实例重叠 8 分钟，参考） |
| v8-postB1 | 2026-10-28 | 0.95 | 1.00 | 45/50 | 0.38 | B1 类目直查后（干净单实例） |

> **B1 诚实结论**：B1（类目直查）在评测集上未提升 RAG 命中率（0.38 持平）——评测集类目词 case 未成规模；但运行时手工验证命中真实生效（"黑茶怎么泡"→5 黑茶、"乌龙茶和武夷岩茶"→青茶、"紫砂壶泡黑茶"→teawares 2）。RAG 0.16→0.38 的主因是评测链路修复（认证档 30/min 无 429 + 端口对齐实测网关），不是 B1。
> 注：2026-10-28 另修复欠费下每次检索白调 DashScope embedding 的问题（gateway profile 排除 `DashScopeEmbeddingAutoConfiguration`，容器日志实测 400 Arrearage 消失）。

## 3. 面试叙事案例（真实排查，可深挖）

### 3.1 网关删人设排查（跨系统链路问题）
- 现象：chat 回复不像茶灵。
- 排查链：前端 teaAI.ts 带 system prompt → 后端原样转发（AiChatService 无篡改）→ **yg-gateway handler.go:1000-1005 custom 模式删除客户端 system 换成网关 persona** → passthrough 恢复后仍偶发漏人设 → 定位为上游 CodeBuddy 账号池**服务端会话上下文**（账号级 persona 压过客户端 system）。
- 结论：客户端 system 在账号池会话模型下不可压服，属上游行为；Tea 侧代码无缺陷。
- 举证价值：能讲清「你的 prompt 到模型前经过的每一跳」——多层代理、透传、会话上下文优先级。

### 3.2 评测数字的口径陷阱（谁信谁被坑）
- v1/v2 的 0.82/0.96 是 `judge off` 的 program-only 口径（未跑 judge 考点中性计 1）→ 2026-10-09 修正为「未回填计 0」后同批 dry-run overall=0.19，programOnly=1。
- 教训：**judgeCoverage=1 的数字才能跨版本比**；v7 的 1.00 只在 8 条 men 子集成立，不可写进简历。
- 举证价值：展示对评估方法论的理解（覆盖口径、假阳性、子集误用），比「我分数高」更可信。

### 3.3 RAG 从 0.16 → 0.38（B1 未改评测集数字，运行时命中真实生效）
- 根因：culture_chunks 表 0 行（从未 backfill）+ 评测环境显式禁用 embedding（占位 key 401）+ DashScope 账户欠费（实测 400 Arrearage，embedding 通道不可用）。
- 对策分层：A 向量 RAG（被欠费阻塞，未硬上）→ **B1 纯文本类目直查**（零成本立即可用：teas 查询加 category 匹配 + 类目别名乌龙茶/岩茶→青茶 + 别名展开上限约束）→ B3 自托管 embedding（bge-m3 ONNX + pgvector，预留）。
- 诚实归因：评测集上 RAG 0.38 前后持平（B1 影响的类目词 case 未成规模），0.16→0.38 提升来自评测链路修复（认证档 30/min 无 429 污染 + 端口对齐 7863）；B1 价值经运行时验证（黑茶/乌龙/紫砂手工命中，此前必 miss）。
- 举证价值：展示**先实测根因、不硬套方案、欠费就换零成本通道、数字如实归因**的工程取舍。

### 3.4 多工具 Agent：工具挂哪、不挂哪（边界纪律，B1.2 / P2.2，2026-10-30）
- 机制：4 个 Spring AI `@Tool` 工具——culture_query（试点已有）+ brew_params（茶库参数/类目基准/投茶量估算）+ my_tasting_records（本人记录+均分）+ brew_advice（参数+历史+文化备注组合）；`MultiToolAgent` 门面每请求按 userId 绑定后挂到透明代理 ChatClient，AiChatService 只依赖门面一个 bean。
- 安全：userId 从不由模型参数传入——`boundTo` 在请求发起时服务端绑定，模型无法伪造越权读他人记录；未绑定的记录工具直接回「未登录」文案。
- 降级：工具路径 BadGateway → 回落无工具直答（与 LibrarianAgent 工具灰度同纪律）；工具内部异常吞掉转错误文案，绝不让整轮对话 500。
- MCP 边界：/mcp 只暴露无会话状态的 3 个工具（cultureSearch / brew_params / brew_advice）；my_tasting_records 不对外（外部 MCP 无登录态，单例永远回「未登录」= 死工具）。
- 证据：`mvn test` 536 全绿（含 McpServerIntegrationTest 断言 /mcp ≥3 工具 + SSE 匿名握手；AiChatService 熔断/降级 8+5+27 用例全过）；评测集新增 CHA-010/011/012 三条工具考点，**仅 dry-run 管道验证（12 条解析无崩）**——真实 LLM 工具调用命中率未实测（需 live 容器 + 有效 key，欠费环境不硬跑）。

### 3.5 SSE 文本流式（B1.3）：结算时机与「流失败回退整段」承重墙
- **端点**：新增 `POST /api/v1/ai/chat/stream`，返回 `SseEmitter`——刻意留在 MVC 栈（不引 WebFlux 依赖），用 `streamExecutor`（虚拟线程池，R8 合规）跑 LLM 生成。帧协议极简：`{"d":"<增量>"}` 文本 delta → 结束帧 `{"meta":{"sessionId":n}}` → `[DONE]`；中途错误帧 `{"error":"BAD_GATEWAY"}`。
- **结算时机（PR #43 教训重演）**：用量（AiUsageLogger）/ Trace（TraceRecorder.complete|fail）/ 熔断计数**全部移到流结束事件**才结算——建立 emitter 时或首 chunk 就结算会在客户端断连/上游中途失败时静默丢数据。成功路径在 `blockLast()` 后统一结算，异常路径在 catch 里 `onFailure + trace.fail`。
- **预流 vs 流中失败分治**：越权 404 / 配额 429 / 无 key / 熔断未命中兜底——在建立 emitter **之前**以普通 HTTP 状态抛出，前端据状态回退整段；熔断命中本地规则库则作为单 chunk 下发。这样「回退整段」只在真失败时发生，正常用户拿到逐字流。
- **前端承重墙**：`teaAI.ts` 用 `fetch + ReadableStream.getReader()`（不用 EventSource——要 POST body + Authorization 头），30s **空闲**超时（每个 chunk 重置）；**预流非 2xx / 网络 / 超时 / 无内容自动回退整段 `/v1/ai/chat`**（与评测器同口径，评测器继续走整段，口径不分裂）；停止按钮 `AbortController` 中止后保留已出内容、不回退重发。
- **测试 seam**：包级可见 `streamExecutor`（测试换成 `Runnable::run` 同步跑）+ `testFrames`（帧收集进 List，免起 MVC handler）；6 个用例覆盖逐 chunk 顺序 / 空 chunk 跳过 / 空正文 502 / 上游异常 error 帧 / key 缺失 / 熔断命中规则单 chunk。
- **诚实归因**：本期只打通**文本流**；五专家 SYSTEM_PROMPT + RAG 人设注入与 tool_calls 流事件留待后续（流式端到端管道先通）。ArchUnit「controller 必返 ApiResponse」规则为 SseEmitter 加了唯一显式例外。服务端 `chat/stream` 第一版曾留下未定义方法 + 不可达重复块（编译不过），本次收尾修复并补齐测试。
- 举证价值：能讲清流式 ≠ 把整段拆两半——关键在**结算时机（防静默丢数据）、预流/流中失败分治、与既有整段链路的平滑回退**，而不是简单换个 API。

### 3.6 跨会话长期记忆（user_memory 单表 key-value）
- **问题**：会话级记忆（ai_chat_messages）只在单会话内生效——用户在会话 A 说「我忌绿茶」，会话 B 开场茶灵不记得。F-B2 要求跨会话记住稳定偏好，且守隐私红线（可查看/可删除/不存敏感信息）。
- **方案**：`user_memory(user_id, key, value, source_session_id)` 单表，`key ∈ {preference, restriction, habit}`，`uk(user_id, key)` 每用户每类恒一行。LLM 把「旧摘要 + 本会话新内容」合并成一句新摘要 UPDATE 回去，不追加行（摘要不膨胀）。
- **写入时机**：用户开新会话（无 sessionId）时，对最近一个旧会话做一次 best-effort LLM 抽取；失败仅 warn，不阻塞聊天承重墙（与 persist/计量旁路同语义）。
- **注入面**：新会话开场把三类摘要拼成一段 system prompt 前插，**不回灌原始对话消息**——原始消息含闲聊碎片与可能的敏感自述，摘要由 LLM 按「不记录姓名/账号」指令压缩，注入面最小。
- **隐私红线**：抽取 prompt 明令不记录姓名/电话/账号；`source_session_id` 不建 FK（会话删除后画像保留直到用户显式删除）；`UserMemoryService.list/delete` 一律带 userId 归属校验。
- **L3 三件套**：ADR-028（选型+回滚）+ Flyway V12 迁移 + `UserMemoryMigrationRoundTripTest`（Testcontainers 真 PG：upgrade→rollback DROP→reapply V12→功能可用+CHECK 约束拒绝非法 key）。
- **测试证据**：`AiChatServiceTest` 新增 4 个用例——新会话注入 system 摘要 / 空画像不注入 / 已有会话不重复注入 / 新会话触发 best-effort 抽取；全量 540 tests 0 failures。
- **诚实归因**：v1 不做查看/删除端点（ADR-028 明确「留待前端接入切片」），服务层 list/delete 已备但无 controller 暴露；抽取依赖 LLM 质量，记错的修正路径是用户显式删除该类。

## 4. 一句话可复述的「深度证明」

「Tea 的 AI 层不是堆 prompt：它有一个 50 条评测集 + LLM 独立评委 + 覆盖口径纪律（judgeCoverage=1）的自评系统，把整体分从 0.81 推到 0.95、program 正确率推到 1.0，并用 RAG 命中率单独追踪检索短板；每个机制（专家路由/记忆/熔断/MCP/多工具/backfill 审计）都有代码、测试和真实排查案例。」

## 5. 待补充

- [x] v8-postB1 数字回填（§2 表格，0.95 / 持平 0.38）
- [x] ITERATIONS.md 追加 v8 版本行
- [ ] 网关排查案例补 yg-gateway 配置还原证据（D:\yg-gateway\config.json.bak-20261028）
- [ ] B3 自托管 embedding（bge-m3 ONNX + pgvector）落地后更新 RAG 数字——欠费下向量通道恢复的唯一路径
- [ ] P2.2 多工具 live 评测：容器 + 有效 key 就位后跑 CHA-010/011/012，实测工具调用命中率（当前仅 dry-run 管道验证）
