---
last_updated: 2026-10-07
status: active
owner: tea-harness
---

# 全局错误码表（Spring Boot 新栈）

> 285 Harness「docs/reference/error-codes.md」的 tea 对应物。唯一权威：`backend/src/main/java/com/tea/common/errorcode/ErrorCode.java`。
> 改码表先改枚举，再同步本表。旧 FastAPI 错误格式见 `docs/api/endpoints.md`（过渡期）。

## 错误码

| 错误码 | HTTP | 默认文案 | 触发场景 |
|---|---|---|---|
| `SYSTEM_ERROR` | 500 | 系统繁忙，请稍后重试 | 未捕获技术异常（DB/IO/JSON）兜底 |
| `PARAM_INVALID` | 400 | 参数校验失败 | 请求体/参数校验不通过 |
| `UNAUTHORIZED` | 401 | 未登录或登录已过期 | 缺 Token 或 Token 失效 |
| `FORBIDDEN` | 403 | 无权限访问 | 已登录但无对应权限 |
| `NOT_FOUND` | 404 | 资源不存在 | 资源不存在或无权查看（防枚举） |
| `CONFLICT` | 409 | 资源状态冲突 | 唯一约束/状态冲突（如重复用户名） |
| `METHOD_NOT_ALLOWED` | 405 | 请求方法不支持 | HTTP 方法不支持 |
| `BAD_GATEWAY` | 502 | AI 服务暂不可用 | AI 服务未配置/上游失败（前端 teaAI.ts 据此降级） |

## 使用约定

1. Service 抛 `BusinessException` 子类，`GlobalExceptionHandler` 统一转 `ApiResponse<T>`。
2. `BAD_GATEWAY` 是前端降级承重墙的触发信号，不得改写文案。
3. 响应体结构：`{code, message, data}`，`code` 用本表枚举值。
