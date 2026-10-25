---
last_updated: 2026-10-23
status: active
owner: yanha
---

# API 端点清单

> 从 `backend/app/routers/*.py` 与 `backend/app/main.py` 反推，最后更新：2026-10-23。
> 统一前缀 `/api`；鉴权方式：`Authorization: Bearer <access_token>`（除公开端点外必须携带）。
> 统一错误格式：`{"detail": "<中文说明>", "code": "<机器码>", "status": <HTTP 状态码>}`。

## 认证 `/api/auth`（公开）

| 方法 | 路径 | 请求体 | 成功响应 | 错误 |
|------|------|--------|----------|------|
| POST | `/api/auth/register` | `{username, password, display_name?}` | `TokenResponse`（200） | 400 用户名已存在（`BAD_REQUEST`） |
| POST | `/api/auth/login` | `{username, password}` | `TokenResponse`（200） | 401 用户名或密码错误（`UNAUTHORIZED`） |

`TokenResponse`：`{access_token, token_type: "bearer", user: {id, username, display_name, level, xp, preferred_type}}`。

## 茶叶 `/api/teas`（公开）

| 方法 | 路径 | 参数 | 成功响应 | 错误 |
|------|------|------|----------|------|
| GET | `/api/teas/` | `type?`（六大茶类过滤） | `list[TeaResponse]` | — |
| GET | `/api/teas/{tea_id}` | — | `TeaResponse` | 404 茶叶不存在（`NOT_FOUND`） |

## 品鉴记录 `/api/records`（需登录）

| 方法 | 路径 | 请求体 / 参数 | 成功响应 | 错误 |
|------|------|--------------|----------|------|
| POST | `/api/records` | `RecordCreate`（含 `client_id?`） | `RecordResponse`（200） | 401 未登录 |
| GET | `/api/records` | `skip?`（默认 0）、`limit?`（默认 50，上限 100） | `list[RecordResponse]`（按创建时间倒序） | 401 |
| GET | `/api/records/{record_id}` | — | `RecordResponse` | 401 / 404 记录不存在 |
| DELETE | `/api/records/{record_id}` | — | `{message: "已删除"}` | 401 / 404 记录不存在 |

幂等：`client_id` 重复提交（同用户）返回同一条已有记录，不产生重复数据；记录归属校验按 `user_id`，不可访问他人记录。

## 茶园 `/api/garden-plants`（需登录）

| 方法 | 路径 | 请求体 | 成功响应 | 错误 |
|------|------|--------|----------|------|
| POST | `/api/garden-plants/` | `GardenPlantCreate`（含 `client_id`） | `GardenPlantResponse`（200） | 401 |
| GET | `/api/garden-plants/` | — | `list[GardenPlantResponse]` | 401 |

幂等 upsert：同 `user_id + client_id` 已存在则更新状态并返回原记录 id，否则新建。

## 茶文化 `/api/culture`（旧 FastAPI）—— 已于 2026-10-22 D9 退役

> 11 个只读端点（regions/people/poems/processes/teas-detail/graph/search）随旧栈移除：0 前端消费方，
> 文化数据改走新栈 `/api/v1/culture/search`（8 表 RAG）。退役决策与执行清单见
> `docs/architecture/backend-migration-status.md` §3。若产品将来要做文化浏览页，按新栈 culture 域重做，不从旧代码迁移。

## 茶灵 AI `/api/ai`（公开，LLM 不可用时 502，前端降级规则回复）

| 方法 | 路径 | 请求体 | 成功响应 | 错误 |
|------|------|--------|----------|------|
| POST | `/api/ai/chat` | `{messages: [{role, content}]}`（1-20 条，content ≤4000 字） | `{content}` | 502 |

> recommend/note 两端点已于 2026-10-22 D9 退役（荐茶能力由新栈 advisor 专家覆盖；茶记无消费方）。
> 旧 `/chat` 亦将随旧栈整体退役，生产调用走 `/api/v1/ai/chat`。

## 系统

| 方法 | 路径 | 成功响应 | 错误 |
|------|------|----------|------|
| GET | `/` | `{message: "一盏茶 API", version}` | — |
| GET | `/health` | `{status: "ok", database: "ok", dev_mode}` | 503 数据库连接不可用 |

## 错误码汇总

| code | status | 场景 |
|------|--------|------|
| `BAD_REQUEST` | 400 | 重复用户名、参数校验失败 |
| `UNAUTHORIZED` | 401 | 登录失败、token 缺失/失效 |
| `FORBIDDEN` | 403 | 预留（权限不足） |
| `NOT_FOUND` | 404 | 资源不存在或无权访问 |
| `CONFLICT` | 409 | 预留（幂等冲突类） |
| `VALIDATION_ERROR` | 422 | 请求体校验失败（detail 形如 `参数校验失败: <字段> <原因>`） |
| `RATE_LIMITED` | 429 | 限流（`RateLimitMiddleware`，按 IP+路径滑动窗口） |
| `BAD_GATEWAY` | 502 | LLM 代理不可用（AI 路由，前端据此降级规则回复） |
| `SERVICE_UNAVAILABLE` | 503 | 健康检查数据库不可用 |
| `INTERNAL_ERROR` | 500 | 未捕获异常（服务端兜底） |
