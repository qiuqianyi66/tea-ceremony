# 第四阶段规格：AI 后端代理与生产安全（Prod Hardening Spec）

> 状态：已批准执行
> 分支：`feature/prod-hardening`（Git Worktree 隔离开发）
> 对应计划：第四阶段「从能跑走向像真实项目」

## 1. 目标

把「一盏茶」从「能跑」提升到「像真实项目」的生产质量基线：

- 浏览器不再直连第三方 AI 服务（Pollinations），改走后端代理
- API 具备限流、统一错误格式、服务端日志与异常追踪
- 登录错误处理、CORS 生产配置、健康检查页面、数据库备份说明补齐

## 2. 范围（做 / 不做）

### 做

| 编号 | 内容 | 关键约束 |
|---|---|---|
| T1 | 后端 AI 代理路由 `/api/ai/recommend|note|chat`，httpx 调 Pollinations，超时 8s，失败 502 | 同步 def + httpx.Client，与现有路由风格一致 |
| T2 | 前端 `teaAI.ts` 改走后端代理，保留规则引擎降级 | 后端不可用 / 502 时仍能降级回复 |
| T3 | 限流中间件：IP + 路径滑动窗口，超限 429 | `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW` 可配，默认 300 次/分钟/IP；跳过 /health |
| T4 | 统一错误格式：HTTPException / 校验错误 / 500 统一 `{detail, code, status}` | 保留 FastAPI detail 语义；500 记录异常堆栈 |
| T5 | 登录错误处理加强：失败记日志，统一错误格式 | 不泄露用户存在性（保持 401 通用文案） |
| T6 | 前端健康检查页面 `/health`：调后端 `/health` 显示 DB 状态 | 无后端时显示不可用态，不报错 |
| T7 | CORS 生产配置强化：生产模式禁 `*`，文档说明 | `CORS_ORIGINS` 环境变量驱动 |
| T8 | 数据库备份说明：pg_dump 命令 + 恢复命令 | 写入 DEPLOY.md |
| T9 | 服务端日志：logging 配置 + 请求日志中间件 + 500 异常追踪 | 结构化日志（时间/级别/消息） |
| T10 | 测试：后端 AI 代理 mock / 限流 / 错误格式；前端 teaAI 降级单测；E2E 适配 | 现有 12 后端用例 + 34 前端用例不回归 |

### 不做

- 不引入 Redis / 外部限流存储（内存限流，生产可后续换）
- 不引入消息队列 / 任务调度
- 不把 Pollinations 密钥管理复杂化（免费 API 无密钥，代理为安全边界与 CORS/CSP 治理）
- 不改数据库模型（无迁移）
- 不在本批做 Sentry 等外部追踪服务

## 3. 技术方案

### 错误格式

```json
{ "detail": "用户或密码错误", "code": "UNAUTHORIZED", "status": 401 }
```

- `HTTPException`：detail 保留，code 由状态码映射（400→BAD_REQUEST 等），无映射则 `HTTP_{status}`
- 校验错误（RequestValidationError）：detail 汇总为可读信息，code=`VALIDATION_ERROR`，status 422
- 未捕获异常：记录日志，code=`INTERNAL_ERROR`，status 500

### 限流

内存滑动窗口：key = `client_ip + path`，窗口 60s。超限返回 429。`X-Forwarded-For` 信任由部署层配置，默认取 request.client.host。

### AI 代理

- 后端 `httpx.Client(timeout=8)` POST `https://text.pollinations.ai/openai`，model=deepseek
- 三个端点统一透传 messages，返回 `{content: str}`
- Pollinations 失败 / 超时 / 非 200 → HTTPException 502 `AI_SERVICE_UNAVAILABLE`

### 前端降级链

`后端代理 → 规则引擎`（原 `直连 Pollinations → 规则引擎`）。RAG 仍走后端 `/api/culture/search`。

## 4. 验收门禁

- [ ] `cd backend && pytest`：新增 AI 代理 / 限流 / 错误格式用例，原有 12 用例不回归
- [ ] 前端单测全过（新增 teaAI 降级用例）
- [ ] `npm run type-check` / `npm run build` 通过
- [ ] E2E 完整流程 + 分享页不回归（适配 AI 请求拦截）
- [ ] 本地起后端（SQLite 测试）验证：限流 429、统一 404/422 格式、AI 代理 502（无外网时）
- [ ] README / DEPLOY.md 补 CORS、备份、健康检查说明

## 5. 环境变量新增

| 变量 | 默认 | 说明 |
|---|---|---|
| `RATE_LIMIT_MAX` | 300 | 每 IP 每窗口最大请求数 |
| `RATE_LIMIT_WINDOW` | 60 | 窗口秒数 |
| `CORS_ORIGINS` | 已有 | 逗号分隔来源列表 |
