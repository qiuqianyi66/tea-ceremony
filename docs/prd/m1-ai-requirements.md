---
last_updated: 2026-10-06
status: active
owner: yanha
---

# m1-ai AI 切片 — 需求分析（PRD 级）

> 阶段 1 产出（需求分析先行规范）。批 C 第二片（T11）：AI 代理域 + culture/search（RAG 检索）迁移到 Spring Boot `/api/v1`，前端 teaAI.ts 切 v1（降级链承重墙保留）。
> 事实来源（均只读核实）：`src/services/teaAI.ts`（前端 AI 调用形状/降级链）、`backend/app/routers/ai.py + culture.py + culture_service.py`（旧契约/检索逻辑）、`V1__init.sql`（agent_prompts/ai_usage_logs 表）、`backend/pom.xml`（spring-ai-alibaba.version=1.1.2.0 已预置、依赖未加）、`.harness/rules/编码规范.md §9`（AI 红线）、`api-contract.md`（旧 /api/ai 段）。日期：2026-10-06。状态：**待用户确认**。

## 1. 背景与目标

前端 teaAI.ts 目前直接 fetch 旧后端 `/api/ai/chat` + `/api/culture/search`（不经 http.ts）——批 C 联调切片后这俩请求打新后端 404 → 自动降级规则引擎（AI 功能降级中）。本片实现新后端 `/api/v1/ai/chat`（LLM 代理）+ `/api/v1/culture/search`（RAG 检索），前端切 v1，AI 完整能力恢复；降级链（规则引擎兜底）作为承重墙零削弱保留。

## 2. 范围与边界

| 方向 | 内容 |
|---|---|
| 做（F11-1~5） | 后端 `ai` 域：`POST /api/v1/ai/chat`（LLM 代理 + 输入校验 + ai_usage_logs 计量 + 502 降级语义）；`culture` 域：`GET /api/v1/culture/search`（4 表 ILIKE 检索）；前端 teaAI.ts 切 `/v1`（解包 ApiResponse）+ 路径适配；api-contract 登记 v1 段；契约回归测试 |
| 不做 | Prompt 版本管理入库（agent_prompts 表已建待用——透明代理先行，见 D11-3）；culture 域其他端点（regions/people/poems 详情——前端本地数据，留 culture 切片）；`/ai/recommend`、`/ai/note` 端点（前端不用——recommendTea/note 内部走 chat）；限流（RATE_LIMITED 预留）；Spring AI 多模型/RAG 向量化 |

## 3. 现状事实（已核实）

### 3.1 前端调用形状（teaAI.ts）
- `callLLM(systemPrompt, userPrompt)`：`POST ${API_BASE}/ai/chat` body `{messages:[{role:'system'|'user', content}]}` → **`!res.ok → null` → 规则引擎降级**（承重墙）；成功 `data.content`
- `fetchRAGContext(question)`：`GET ${API_BASE}/culture/search?q=` → `!res.ok → ''`；成功解析 `CultureSearchResult{teas[], people[], regions[], poems[]}`
- 消费方：`recommendTea` / `generateTastingNote` / `askTeaMaster`（三个场景共用 callLLM + askTeaMaster 加 RAG）
- 前端 prompt（RECOMMEND/TASTING/MASTER 三套 system prompt）在前端定义——透明代理下原样经 messages 传入（见 D11-3）

### 3.2 旧契约（api-contract /api/ai）
- `POST /api/ai/chat`：`{messages:[{role, content}]}`（1-20 条、content ≤4000）→ `{content}` 200；**502 = LLM 不可用，前端据此降级（语义必须保留）**
- `GET /api/culture/search?q=`：→ `{teas:[{id,name,type:'tea'}], people:[{id,name,dynasty,type}], regions:[{id,name,province,type}], poems:[{id,title,author,type}]}`（各 ≤5，ILIKE）

### 3.3 表与规范
- `agent_prompts`（agent/version/content/status，uk_agent+version）已建 V1，**无数据**
- `ai_usage_logs`（user_id 可空/agent/model/tokens_in/out/latency/prompt_version/created_at 索引）已建 V1
- 编码规范 §9 红线：🔴 AI 请求必须走后端代理；🔴 降级链（teaAI.ts + 后端 fallback）不可删；🟢 prompt 版本管理/输出校验/超时熔断/计量（🟢 非阻断）
- pom.xml：`spring-ai-alibaba.version=1.1.2.0` 属性已预置。**2026-10-06 迭代评审核实（阿里云 Maven 镜像）**：①旧坐标 `spring-ai-alibaba-starter` 最新仅 1.0.0-M6.1（2025-03 停更，无 1.1.x）；②1.1.x 新坐标为 **`com.alibaba.cloud.ai:spring-ai-alibaba-starter-dashscope`**（版本 1.1.2.0~1.1.2.4-security-fix、2.0.0-M1.1）；③另有 `spring-ai-alibaba-agent-framework`（内置 Sequential/Parallel/Routing/Loop Agent，本片透明代理不引入，后期 agent 开发用）
- 配置：环境变量 `AI_DASHSCOPE_API_KEY`（官方示例标准）；自动装配 `ChatClient.Builder`；用法 `chatClient.prompt().messages(...).call().content()`；配置项 `spring.ai.dashscope.chat.options.*`
- token 用量：`call().chatResponse().getMetadata().getUsage()`（Spring AI 标准，可能返回 null——计量字段 null 容忍）

## 4. 功能需求（Given-When-Then）

### F11-1 `POST /api/v1/ai/chat` LLM 代理

- Given 请求体 `{messages:[{role, content}]}`（1-20 条、content ≤4000 字）、LLM 可用，Then 200 `ApiResponse{data:{content}}`（经 Spring AI Alibaba 调 LLM，messages 原样转发——透明代理）
- Given 请求体非法（空 messages / 超 20 条 / content 超 4000 / role 非 system|user），Then 400 `PARAM_INVALID`
- Given LLM 不可用（无 DASHSCOPE_API_KEY / 上游超时 / 5xx），Then **502 `BAD_GATEWAY`**（旧契约降级触发信号，语义不变）——前端 `!res.ok → null → 规则引擎` ✓ 承重墙零改动
- Given 未登录调用，Then 允许（公开，游客可用；ai_usage_logs.user_id 空，见 D11-1）
- Given 调用成功，Then ai_usage_logs 落一条计量（agent/message 判定或请求体 agent 字段/tokens/latency，见 F11-3）

### F11-2 `GET /api/v1/culture/search` RAG 检索

- Given `q` 非空，Then 200 `ApiResponse{data:{teas, people, regions, poems}}`（teas.name / people.name / regions.name / poems.content 四表 ILIKE，各 limit 5，形状与前端 CultureSearchResult 一致）
- Given `q` 空，Then 四数组全空（同旧契约）
- Given 未登录调用，Then 允许（公开）

### F11-3 ai_usage_logs 计量

- Given LLM 调用成功（含 502 前超时场景按需），Then 记录 `{user_id（有 token 时解析）, agent, model, tokens_in, tokens_out, latency, prompt_version}`；游客 user_id 空
- Given 失败/降级，Then 不落计量（仅成功计，防止脏成本数据）

### F11-4 前端 teaAI.ts 切 v1（承重墙回归）

- Given 新后端运行，Then `callLLM` 请求 `/api/v1/ai/chat` 并解包 `data.content`；`fetchRAGContext` 请求 `/api/v1/culture/search` 并解包 `data`
- Given LLM 不可用（502/404/网络），Then **仍返回 null → 规则引擎降级**（`!res.ok` 处理不变，仅路径与解包变化）
- Given 评分/品鉴流程，Then generateTastingNote 恢复 LLM 文风、失败降级规则评语（teaAI.spec 现有降级测试必须全绿）

### F11-5 契约文档登记

- Given 实现完成，Then api-contract.md 登记 `/api/v1/ai/chat` + `/api/v1/culture/search`（含 502 语义、输入校验、ApiResponse 包装）；旧 `/api/ai` 段标注"前端已切 v1"

## 5. 非功能约束

| 维度 | 约束 |
|---|---|
| 承重墙 | teaAI.ts `!res.ok → null/''` 降级链**不改逻辑只改路径+解包**；502 状态码语义不变（前端降级触发信号）；评分/品鉴流程零触碰 |
| 安全 | AI 请求走后端代理（红线）；敏感数据不入 prompt（前端已控制）；messages 输入校验防滥用 |
| 依赖 | 加 **`spring-ai-alibaba-starter-dashscope:1.1.2.4-security-fix`**（最新安全修复版，非里程碑；禁旧 `spring-ai-alibaba-starter`）；**禁浏览器直连第三方** |
| 配置 | 环境变量 `AI_DASHSCOPE_API_KEY`（application.yml 映射）；**无 key 路径显式判断**（service 读配置为空 → 直接 502，不调 LLM）；无 key 启动行为必须实测（见 §9 T11-1） |
| 验证 | 后端 mvn test（含 controller 单测 + culture search 集成）+ 前端 teaAI.spec 降级回归 + type-check/build + 联调冒烟 |

## 6. 影响分析

| 维度 | 影响 |
|---|---|
| 后端 | 新增 `ai` 域（Controller/Service/计量）+ `culture` 域 search 端点；pom 加依赖；**零迁移**（agent_prompts/ai_usage_logs 已建；RAG 查现有 4 表） |
| 前端 | teaAI.ts 两处 fetch 路径 + 解包；降级逻辑不变（承重墙回归测试锁定） |
| 契约 | v1 ai/chat + v1 culture/search 登记；502 语义保留 |
| 部署 | .env 需 DASHSCOPE_API_KEY（compose backend 环境注入）；无 key 时功能降级规则引擎（不阻塞部署） |
| 成本 | ai_usage_logs 计量落地（tokens/latency），后续成本观测/告警可用 |
| 回滚 | git 回退；前端 teaAI 路径恢复旧栈即回退（降级路径仍通） |

## 7. 决策点（按推荐执行）

| # | 决策 | 推荐 | 备选 |
|---|---|---|---|
| D11-1 | AI 鉴权 | **公开**（旧契约保持，游客可用；ai_usage_logs.user_id 可空；records 等敏感域已登录） | 需登录（计量完整但破坏游客 AI 体验） |
| D11-2 | 契约路径 | **v1 端点 + 前端改路径**（`/v1/ai/chat`、`/v1/culture/search`，版本化登记） | 后端兼容旧 `/api/ai/chat`（非版本化，污染 v1 边界） |
| D11-3 | Prompt 治理 | **透明代理**（前端 messages 原样转发，prompt 仍前端控制——最小改动 + 降级链零破坏；agent_prompts 表就位待后续治理切片） | prompt 入库（V3 种子 + 前端 prompt 迁移 + callLLM 传 agent——L3 重，本片不做） |
| D11-4 | LLM 配置 | **`spring-ai-alibaba-starter-dashscope:1.1.2.4-security-fix` + `AI_DASHSCOPE_API_KEY` 环境变量**；无 key 显式 502 → 前端降级（本地/测试友好） | 本地 mock LLM（成本高，测试已 mock） |
| D11-5 | 计量范围 | **成功调用即记**（agent 取请求体可选字段，缺省 'chat'；游客 user_id 空；失败不记） | 全部请求记（脏数据/成本噪音） |

## 8. 验收清单（阶段 1 自检）

- [x] F11-1~5 有编号 + Given-When-Then
- [x] 事实基于只读核实（teaAI.ts / 旧 culture_service / V1 表 / 编码规范 §9 / pom）
- [x] 承重墙声明：降级链逻辑零改动（仅路径+解包）、502 语义保留、评分流程零触碰
- [x] 决策点 D11-1~5 有推荐
- [x] 不做项明确（prompt 入库/限流/culture 其他端点/多模型）
- [x] 依赖坐标实测（2026-10-06 迭代核实：`spring-ai-alibaba-starter-dashscope:1.1.2.4-security-fix`，阿里云 Maven 镜像）

## 9. T11 实施顺序（迭代评审收敛）

> 顺序按"先暴露风险"原则：无 key 启动行为是最大未知，放第一步验证。

1. **T11-1 依赖与启动验证（风险前置）**：pom 加 `spring-ai-alibaba-starter-dashscope:1.1.2.4-security-fix`（更新版本属性）；无 key 启动 `mvn spring-boot:run`——若自动配置强制 key 导致启动失败，对策：application-test profile 用假 key，或调整自动配置（key 显式判断在 service 兜底）
2. **T11-2 ai 域**：AiChatRequest（校验注解）/ AiChatController（POST `/api/v1/ai/chat`，公开）/ AiChatService（key 空→BadGateway 502；调 ChatClient；异常统一 502）/ AiUsageLog entity + Repository（V1 表映射，token 字段 null 容忍）
3. **T11-3 culture search**：CultureSearchController（GET `/api/v1/culture/search`，公开）/ CultureSearchService（四表 Repository ILIKE + limit 5，形状对齐前端 CultureSearchResult）
4. **T11-4 前端切 v1**：teaAI.ts 两处路径（`/v1/ai/chat`、`/v1/culture/search`）+ ApiResponse 解包；降级逻辑零改动；teaAI.spec 更新并全绿
5. **T11-5 测试**：后端 controller 单测（校验/502/公开访问）+ culture search 集成（Testcontainers）+ 计量落库验证；前端 teaAI.spec 承重墙回归
6. **T11-6 收尾**：api-contract 登记 → agent-eval 脚本跑本片（changes/m1-ai 三件套 + eval.md）→ expert-reviewer → 英文 conventional commit → push → 合 main

## 10. Pre-mortem 关键风险（2026-10-06 迭代）

| # | 风险 | 对策 |
|---|---|---|
| R1 | 无 key 时自动配置启动失败（而非 502） | T11-1 第一步实测；test profile 假 key + service 显式判断 |
| R2 | 公开端点无鉴权无限流，有 key 时被刷成本 | 输入条数/长度已限；ai_usage_logs 观测；限流留后续（仅记录风险） |
| R3 | Usage token 为 null | 字段 null 容忍，不阻断响应 |
| R4 | 前端解包误改降级逻辑 | teaAI.spec 锁定，改完全绿才提交 |
| R5 | culture search ILIKE 无全文索引 | 数据量小（与旧栈一致），各 limit 5 |
