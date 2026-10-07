---
name: api-contract
description: tea 接口协议——现有端点、统一约定（前缀/鉴权/错误格式）、目标 Spring Boot 演进（ApiResponse + 错误码 + 版本化）。编码前后端联调前对照，禁止私自改契约。
---

# 接口协议（api-contract）

> 来源：docs/api/endpoints.md（从 backend/app/routers/ 反推，最后更新 2026-09-11）。后端重写为 Spring Boot 过程中契约逐步迁移，**公开端点的路径与语义保持兼容**。

## 1. 统一约定

- 前缀：`/api`
- 鉴权：`Authorization: Bearer <access_token>`（公开端点除外）
- 错误格式（现行 FastAPI）：`{"detail": "<中文>", "code": "<机器码>", "status": <HTTP>}`
- 目标（Spring Boot）：`ApiResponse<T>` 统一包装 `{code, message, data}`；分页 `{items, total, page, size}`

## 2. 端点清单

### 认证 `/api/auth`（公开）

| 方法 | 路径 | 请求体 | 成功响应 | 错误 |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{username, password, display_name?}` | `TokenResponse` 200 | 400 用户名已存在 `BAD_REQUEST` |
| POST | `/api/auth/login` | `{username, password}` | `TokenResponse` 200 | 401 用户名或密码错误 `UNAUTHORIZED` |

`TokenResponse`：`{access_token, token_type:"bearer", user:{id, username, display_name, level, xp, preferred_type}}`

### 认证 `/api/v1/auth`（Spring Boot 目标，T6 已实现，公开）

| 方法 | 路径 | 请求体 | 成功响应 | 错误 |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | `{username, password, displayName?}` | `ApiResponse{data:TokenVo}` 200 | 400 用户名已存在 `BAD_REQUEST` |
| POST | `/api/v1/auth/login` | `{username, password}` | `ApiResponse{data:TokenVo}` 200 | 401 用户名或密码错误 `UNAUTHORIZED` |

`TokenVo`：`{token, expiresInSeconds, user:{id, username, displayName, level, xp}}`
- **命名注意**：新后端无全局 snake_case 策略，UserVo/RegisterRequest 字段即 Java 名（`displayName` camelCase）；TeaVo/RecordVo 字段名本身是 snake_case，两套共存
- 与旧 `/api/auth` 差异：响应包 `ApiResponse.data`；`access_token` → `token`；请求体 `display_name` → `displayName`；token_type 移除（JWT 直接作 Bearer token）
- 前端适配（T10）：`src/services/api/auth.ts` 解包 `data` 并把 `user.displayName` 还原为 `display_name`（store 零改动）

### 茶叶 `/api/teas`（公开）

| 方法 | 路径 | 参数 | 成功响应 | 错误 |
|---|---|---|---|---|
| GET | `/api/teas/` | `type?`（六大茶类） | `list[TeaResponse]` | — |
| GET | `/api/teas/{tea_id}` | — | `TeaResponse` | 404 `NOT_FOUND` |

### 茶叶目录 `/api/v1/teas`（Spring Boot 目标，T7 已实现，公开）

| 方法 | 路径 | 参数 | 成功响应 | 错误 |
|---|---|---|---|---|
| GET | `/api/v1/teas` | `category?` 茶类、`origin?` 产地模糊、`page` 默认 1（1-based）、`size` 默认 20 上限 100 | `ApiResponse{data:{items:[TeaVo], total, page, size}}` 200 | 400 `PARAM_INVALID` |
| GET | `/api/v1/teas/{id}` | — | `ApiResponse{data:TeaVo}` 200 | 404 `NOT_FOUND` |

`TeaVo`（snake_case）：`id, name, category, origin, region_id, process_id, season, grade, altitude, best_temp, best_time, infusions, flavor[], story, description, historical_period, water_requirement, soup_color_min, soup_color_max, dry_tea_color`
- 鉴权：GET 公开（游客可浏览，PRD F2/F3）；列表默认按 id 排序（seeds 顺序即茶类分组）
- 与旧 `/api/teas` 差异：新契约分页 + snake_case 全字段；旧端点在过渡期保留（前端联调切片切换）

### 茶器 `/api/teawares`（公开）

| 方法 | 路径 | 成功响应 |
|---|---|---|
| GET | `/api/teawares/` | `list[TeaWareResponse]` |

### 品鉴记录 `/api/records`（需登录）

| 方法 | 路径 | 请求体 / 参数 | 成功响应 | 错误 |
|---|---|---|---|---|
| POST | `/api/records` | `RecordCreate`（含 `client_id?`） | `RecordResponse` 200 | 401 |
| GET | `/api/records` | `skip?` 默认 0、`limit?` 默认 50 上限 100 | `list[RecordResponse]` 倒序 | 401 |
| GET | `/api/records/{record_id}` | — | `RecordResponse` | 401 / 404 |
| DELETE | `/api/records/{record_id}` | — | `{message:"已删除"}` | 401 / 404 |

**幂等**：`client_id` 重复提交（同用户）返回同一条已有记录；归属校验按 `user_id`，不可访问他人记录。

### 品鉴记录 `/api/v1/records`（Spring Boot 目标，T8 已实现，需登录）

| 方法 | 路径 | 请求体 / 参数 | 成功响应 | 错误 |
|---|---|---|---|---|
| POST | `/api/v1/records` | `RecordCreateRequest`（client_id **必填**） | `ApiResponse{data:RecordVo}` 200（幂等返回已有） | 400 / 401 |
| GET | `/api/v1/records` | `page` 默认 1（1-based）、`size` 默认 20 上限 100 | `ApiResponse{data:{items:[RecordVo], total, page, size}}` 倒序 | 401 |
| GET | `/api/v1/records/{id}` | — | `ApiResponse{data:RecordVo}` | 401 / 404 |
| DELETE | `/api/v1/records/{id}` | — | `ApiResponse{data:{message:"已删除"}}` | 401 / 404 |

`RecordVo`（snake_case）：`id, client_id, tea_id, tea_name, brew_temp, brew_time, infusions, water_type, ware_id, dimensions, overall_score, process_factor, aroma_type, notes, weather, mood, created_at`
- 幂等：`user_id + client_id` 唯一（uk_tasting_records_user_client）；并发冲突由唯一索引兜底转幂等返回
- 归属：详情/删除按 `id + user_id` 过滤，跨用户访问 404（不泄露存在性）
- 评分：dimensions/overall_score/process_factor 前端计算（scoring.ts），后端透明存储不重算
- 与旧 `/api/records` 差异：分页风格 skip/limit → page/size；`client_id` 可选 → 必填（V1 表 NOT NULL）；tea_id/ware_id 非空时校验存在（400）

### 茶园 `/api/garden-plants`（需登录）

| 方法 | 路径 | 请求体 | 成功响应 | 错误 |
|---|---|---|---|---|
| POST | `/api/garden-plants/` | `GardenPlantCreate`（含 `client_id`） | `GardenPlantResponse` 200 | 401 |
| GET | `/api/garden-plants/` | — | `list[GardenPlantResponse]` | 401 |

**幂等 upsert**：同 `user_id + client_id` 已存在则更新状态返回原 id，否则新建。

### 茶文化 `/api/culture`（公开，旧 FastAPI，仅维护）

| 方法 | 路径 | 参数 | 成功响应 | 错误 |
|---|---|---|---|---|
| GET | `/api/culture/regions` | `province?` | `list[RegionResponse]` | — |
| GET | `/api/culture/regions/{region_id}` | — | `RegionResponse` | 404 |
| GET | `/api/culture/people` | `dynasty?` | `list[PersonResponse]` | — |
| GET | `/api/culture/people/{person_id}` | — | `PersonResponse` | 404 |
| GET | `/api/culture/poems` | `author?` | `list[PoemResponse]` | — |
| GET | `/api/culture/poems/{poem_id}` | — | `PoemResponse` | 404 |
| GET | `/api/culture/processes` | — | 工艺列表 | — |
| GET | `/api/culture/processes/{process_id}` | — | 工艺详情 | 404 |
| GET | `/api/culture/teas/{tea_id}/detail` | — | 茶叶详情（含产区/工艺/关联） | 404 |
| GET | `/api/culture/graph/{tea_id}` | — | 茶文化知识图谱 | 404 |
| GET | `/api/culture/search` | `q` 默认空串 | 搜索结果 | — |

### 文化搜索 `/api/v1/culture`（Spring Boot 目标，T11 已实现，公开）

| 方法 | 路径 | 参数 | 成功响应 | 错误 |
|---|---|---|---|---|
| GET | `/api/v1/culture/search` | `q` 默认空串 | `ApiResponse<CultureSearchResult>`：`{teas,people,regions,poems,teawares,etiquettes,relations,processes}` 各 ≤5（M5-S2 8 表 RAG，ADR-013） | — |

> item 字段：tea `{id,name,type}`；person `{id,name,dynasty,type}`；region `{id,name,province,type}`；poem `{id,title,author,type}`；teaware `{id,name,type}`；etiquette `{id,name,type}`；relation `{id,relation,source,target,type}`；process `{id,name,teaCategory,type}`。culture 其余详情端点留后续 culture 切片。

### 茶灵 AI `/api/ai`（公开，旧 FastAPI，仅维护；LLM 不可用时 502，前端降级规则回复）

| 方法 | 路径 | 请求体 | 成功响应 | 错误 |
|---|---|---|---|---|
| POST | `/api/ai/recommend` | `{time, weather, mood}`（各 ≤20 字） | `{content}` 200 | 502 |
| POST | `/api/ai/note` | `{tea_name, score(0-10), dimensions}` | `{content}` | 502 |
| POST | `/api/ai/chat` | `{messages:[{role, content}]}`（1-20 条，content ≤4000 字） | `{content}` | 502 |

### 茶灵 AI `/api/v1/ai`（Spring Boot 目标，T11 已实现，公开；LLM 不可用时 502，前端降级）

| 方法 | 路径 | 请求体 | 成功响应 | 错误 |
|---|---|---|---|---|
| POST | `/api/v1/ai/chat` | `{messages:[{role(system/user/assistant), content≤4000}]`（1-20 条）；`agent?` ≤50（枚举：chat/advisor/taster/librarian/brewer/mentor；S2 全量生效） | `ApiResponse<{content, sources?}>` 200（sources=知识来源数组，透明代理为 null） | 400 校验失败/未知 agent PARAM_INVALID；**502 BAD_GATEWAY**（无 key/上游失败） |

> M5-S2 编排：显式 `agent` → 对应专家（advisor 荐茶/teas+regions+processes、taster 品鉴/用户记录、librarian 文化/8 表 RAG、brewer 冲泡/工艺+茶器、mentor 成长/用户记录+常识；各专家回复附 sources）；无 agent 且文化意图关键词命中 → librarian；`agent=chat` 或无意图 → 回落透明代理（messages 原样转发）。未知 agent 值 400。仅成功调用落 `ai_usage_logs`（agent/model/tokens_in/tokens_out/latency；游客 user_id 空）。key 配置 `AI_DASHSCOPE_API_KEY`，无 key 占位 `disabled` 时 Service 显式 502。

### MCP 工具协议 `/mcp`（P1-1 已实现，公开，非 HTTP JSON 契约）

| 端点 | 传输 | 说明 |
|---|---|---|
| `GET /mcp` | SSE（`text/event-stream`） | MCP 握手：返回 `event:endpoint` + `data:/mcp/messages?sessionId=...` |
| `POST /mcp/messages?sessionId=...` | SSE + JSON-RPC 2.0 | MCP 协议消息（initialize/listTools/callTool） |

- 工具：`cultureSearch(query)`——8 表文化检索（同 `/api/v1/culture/search` 语义，返回紧凑 JSON：`{teas,people,regions,poems,teawares,etiquettes,relations,processes}` 各 name 列表）
- 鉴权：公开（与 `/api/v1/culture/**` 同风险等级：只读公开知识检索；**未来接入敏感工具必须单独收紧**，见 SecurityConfig 注释）
- 接入：外部 MCP client（Claude Code/Codex/Goose 等）配置 server 地址 `http://<host>:8080/mcp`
- 配置源：`spring.ai.mcp.server.*`（name/version/type=SYNC/capabilities.tool/sse-endpoint/sse-message-endpoint）

### 系统

| 方法 | 路径 | 成功响应 | 错误 |
|---|---|---|---|
| GET | `/` | `{message:"一盏茶 API", version}` | — |
| GET | `/health` | `{status:"ok", database:"ok", dev_mode}` | 503 数据库不可用 |

> 目标 Spring Boot：Actuator 配置 `management.endpoints.web.base-path=/`，保持 `/health`（liveness）兼容，readiness 为 `/health/readiness`。

## 3. 错误码表

| code | status | 场景 |
|---|---|---|
| `BAD_REQUEST` | 400 | 重复用户名、参数校验失败 |
| `UNAUTHORIZED` | 401 | 登录失败、token 缺失/失效 |
| `FORBIDDEN` | 403 | 预留（权限不足） |
| `NOT_FOUND` | 404 | 资源不存在或无权访问 |
| `CONFLICT` | 409 | 预留（幂等冲突类） |
| `VALIDATION_ERROR` | 422 | 请求体校验失败（`参数校验失败: <字段> <原因>`） |
| `RATE_LIMITED` | 429 | 限流（IP+路径滑动窗口） |
| `BAD_GATEWAY` | 502 | LLM 代理不可用（AI 路由，前端据此降级） |
| `SERVICE_UNAVAILABLE` | 503 | 健康检查数据库不可用 |
| `INTERNAL_ERROR` | 500 | 未捕获异常 |

## 4. 契约变更规则

- 🔴 公开端点路径与语义保持兼容；破坏性变更必须升版本（目标 `/api/v2`），禁静默改 v1 语义。
- 🔴 前后端联调以本文件为准；改契约先改本文件再改代码。
- 🟢 新增端点先在本文件登记（方法/路径/请求体/响应/错误），评审时核对。
- 🟢 错误码可查、稳定、不随文案变化；AI 路由 502 是降级链触发信号，禁改状态码语义。
