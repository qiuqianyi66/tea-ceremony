---
title: 安全审计报告（OWASP Top 10）2026-10-12
date: 2026-10-12
scope: 前端 Vue3 / 后端 Spring Boot 3.5 / 配置与部署
branch: fix/security-hardening
---

# 安全审计报告（2026-10-12）

> 用户指定「安全为头等大事」。本报告按 OWASP Top 10 逐项实测审计，高危立即修复并配回归测试。
> 基线 commit：main = fdba8db。报告日期：2026-10-12。

## 1. 审计范围

| 层 | 范围 |
|---|---|
| 后端 | Spring Boot 3.5（`backend/src/main/java/com/tea/`）：auth / ai / culture / record / garden / tea / common 全部控制器与服务；SecurityConfig、JwtService、RateLimitFilter、GlobalExceptionHandler、application.yml、Dockerfile、docker-compose.yml |
| 前端 | Vue 3.5 + TS：全仓 grep `v-html` / `innerHTML` / `document.write`；token 存储（authStorage.ts / http.ts）；teaAI.ts 降级链 |
| 配置 | `.env.example`、nginx.conf、`.github/workflows/ci.yml`、`git ls-files` 密钥普查 |
| 依赖 | `npm --registry=https://registry.npmjs.org audit`；后端 Maven 依赖随 `mvn test` 编译验证 |

**不在范围**：旧 FastAPI 后端（仅维护，见 backend/app + main.py，已由既有 pytest/bandit 覆盖，本审计不重复）；live AI 真实调用（DashScope 欠费 HTTP 400 Arrearage，2026-10-12 实测，凡依赖真实 AI/embedding 出网的验证一律跳过并标注）。

## 2. 逐项发现（10 项清单）

### 2.1 注入（SQL / 命令 / 模板）—— ✅ 无问题

- `CultureSearchService` 的 `likeClause(fields, n)`：`fields` 全部来自硬编码常量列表（`List.of("name")` 等），用户输入只走 `?` 占位符绑定（`likeArgs`），**无拼接注入面**。
- `ChunkBackfillService`：全部 SQL 静态字符串 + `?` 参数；metadata JSON 由 DB 种子数据拼入并经 `safeJson()` 转义（`\` 和 `"`），用户不可达。
- 全后端 grep `@Query` / `nativeQuery` / `createNativeQuery` / `Statement` / `String.format(...SELECT|INSERT|UPDATE)`：**0 命中**。
- 向量分支 `?::vector` 的字面量来自 float[]（`Float.toString`），非用户文本。

### 2.2 XSS —— ✅ 无问题

- 前端全仓 grep `v-html` / `innerHTML` / `dangerouslySetInnerHTML` / `document.write`：**0 命中**。Vue 默认插值即转义。
- 用户内容（品鉴记录 notes、AI 回复）均走默认 `{{ }}` 文本插值渲染，无 `v-html` 出口。
- nginx 已下发 CSP（`default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`）作为纵深防御。

### 2.3 SSRF —— ✅ 无用户可控出口

- `ChunkBackfillService` / embedding 调用的外部端点来自 `spring.ai.dashscope.base-url`（配置注入，默认 DashScope 官方地址），**无任何接受用户 URL 的端点**。
- 全后端无 `RestTemplate` / `WebClient` 按用户输入拼 URL 的代码路径。

### 2.4 越权 / IDOR —— 🔴 发现 1 项高危（H1，已修）

- **IDOR 防护本身扎实**：`ChatMemoryService.requireSession`、`TastingRecordService.getById/delete`、`GardenPlantService` 全部走 `findByIdAndUserId`，非本人 → 404。`AiChatService.chat()` 带 sessionId 时先 `requireSession` 再调 LLM。
- 🔴 **H1：管理端点缺管理员授权**。`AdminCultureController`（`/api/v1/admin/culture/chunks/backfill`）原仅要求「任意登录」。注册公开开放（`/api/v1/auth/register` 无鉴权），任意人注册 → 登录 → 即可触发：
  1. `embed=true` 时调用 DashScope **付费 embedding API**（成本滥用）；
  2. 写 `culture_chunks` 表（写库）。
  修复见 §3.1。
- `SecurityConfig` 放行面逐一核对：`/api/v1/auth/**`、`/api/v1/ai/chat`（游客降级链承重墙）、`/api/v1/culture/**`（只读知识检索）、`GET /api/v1/teas/**`（游客浏览）、`/mcp*`（只读 MCP 工具，契约已注明未来敏感工具须收紧）、`/actuator/health`。其余 `anyRequest().authenticated()`。

### 2.5 认证授权 —— 🔴 发现 1 项高危（H2，已修）

- JWT：HMAC-SHA256，`JwtService` 构造期校验密钥 ≥32 字节；过期/篡改 token 有单测锁定（`JwtServiceTest`）。
- 密码：BCrypt（`BCryptPasswordEncoder`）；登录失败统一「用户名或密码错误」，不泄露账号存在性。
- 🔴 **H2：JWT 密钥公开硬编码兜底**。`application.yml` 原写 `secret: ${JWT_SECRET:tea-dev-secret-key-please-change-in-production-0123456789}`——此默认值已随仓库公开。docker-compose 虽用 `${JWT_SECRET:?}` 强制注入，但裸 `java -jar` / Windows 原生部署（DEPLOY.md 载有该路径）未注入环境变量时会以**公开已知密钥**启动，任何人可伪造任意用户的合法 JWT。修复见 §3.2。

### 2.6 敏感信息 —— ✅ 无密钥入库

- `git ls-files` 普查 `.env*` / `*.pem` / `*.key` / `secrets/` / `credentials.json` / `*.p12` / `*.pfx`：**仅 `.env.example`**（占位符）。
- 配置中密钥均为 `${ENV:default}` 占位或 `disabled`；无真值入库。
- 全后端 grep 日志输出含 `password|secret|token|api-key|Authorization`：**0 命中**。JWT 过滤器失败仅记 `invalid jwt: <message>`（jjwt 异常消息不含签名材料）。

### 2.7 依赖漏洞与限流 —— 🔴 发现 2 项（H3/H4，已修）

- `npm audit`（官方 registry）：**0 vulnerabilities**。
- 🔴 **H3：限流可被 `X-Forwarded-For` 首值伪造绕过**。`RateLimitFilter.clientIp` 原取 XFF 第一段；客户端每请求自带 `X-Forwarded-For: 任意值` 即可轮换计数键，登录/AI 限流形同虚设。修复见 §3.3。
- 🔴 **H4：公开文化搜索触发付费 embedding 且无限流**。`/api/v1/culture/search` 公开，`CultureSearchService.vectorHits` 会调 `EmbeddingModel.embed(q)`（DashScope 付费）；原 `RateLimitFilter` 只匹配 `/api/v1/ai/` 与登录路径，文化搜索完全裸奔。修复见 §3.4。
- 登录防爆破已覆盖：10 次/5 分钟/IP；AI 10 次/分钟/IP。

### 2.8 日志泄露 —— ✅ 无问题

- 无日志打印请求体/密码/token/AI key（见 2.6）。dev profile `com.tea: DEBUG` 仅本地。

### 2.9 错误信息泄露 —— ✅ 无问题

- `GlobalExceptionHandler`：未知异常统一 `SYSTEM_ERROR` 500（堆栈只进日志，不进响应体）；业务异常透传安全 message；参数校验错误回显字段名。响应无堆栈/内部 SQL/类名泄露。

### 2.10 CORS / 其他 —— 中低危清单见 §4

## 3. 已修复项（每条带验证证据）

### 3.1 H1：管理端点独立令牌收口

- **位置**：新增 `backend/src/main/java/com/tea/auth/security/AdminTokenFilter.java`；`SecurityConfig` 注册（执行序 rateLimit → adminToken → jwt）；`application.yml` 新增 `tea.admin.token: ${ADMIN_API_TOKEN:}`。
- **修复**：`/api/v1/admin/**` 不再接受用户 JWT，仅认独立令牌头 `X-Admin-Token: <ADMIN_API_TOKEN>`。fail-closed（未配置令牌时全部 401）；`MessageDigest.isEqual` 常量时间比较防计时侧信道。
- **验证证据**：
  - `AdminTokenFilterTest`（新增 5 例）：未配置令牌全拒 / 错令牌拒 / 缺头拒 / 对令牌放行 / 非管理路径不拦截 —— 全过。
  - `AdminCultureBackfillIntegrationTest`（Testcontainers 真实 Postgres）新增 `backfillRejectsNormalUserJwtWithoutAdminToken`：普通注册用户持 JWT 调用 → 401；错令牌 → 401。**修复前此场景返回 200**（旧测试 `backfillFillsAllEightTypesWithoutKey` 即以普通用户 JWT 调通）。
  - 全量 `mvn test`：**Tests run: 227, Failures: 0, Errors: 0，BUILD SUCCESS**。

### 3.2 H2：JWT 密钥 fail-closed

- **位置**：`application.yml`（`secret: ${JWT_SECRET:}`，无公开兜底）；`application-dev.yml`（dev profile 本地兜底）；`.github/workflows/ci.yml`（backend-springboot job 显式注入 `JWT_SECRET: ci-test-secret-...`）；`.env.example` 补说明。
- **修复**：主配置不再带公开已知默认密钥。未注入 `JWT_SECRET` 时 `JwtService` 构造期（<32 字节）抛异常，**启动即失败**，杜绝误用公开密钥启动。docker-compose `:?` 强制注入逻辑不变。
- **验证证据**：
  - CI backend-springboot job 已补 env（本地实测同值跑通全量 227 测试）。
  - dev profile 兜底在 `application-dev.yml`，本地开发体验不变。

### 3.3 H3：XFF 末段取真实 IP

- **位置**：`RateLimitFilter.clientIp` 改为取 XFF **末段**（nginx `$proxy_add_x_forwarded_for` 把真实 remote_addr 追加在末尾）。
- **修复**：客户端轮换首段伪造值不再能换计数键。
- **验证证据**：`RateLimitFilterTest` 新增 `spoofedXffFirstValueCannotBypassLimit`（同真实末 IP、轮换首段 → 第 3 请求 429；修复前取首段会全部放行）与 `differentLastXffValueIsIndependent`（不同末段互不影响）—— 全过。

### 3.4 H4：文化搜索纳入限流

- **位置**：`RateLimitFilter.match` 增加 `/api/v1/culture/` 前缀，复用 AI 档（10 次/分钟/IP）。
- **修复**：堵住公开触发付费 embedding 的成本滥用面。
- **验证证据**：`RateLimitFilterTest` 新增 `cultureSearchPathIsLimitedLikeAi`（第 3 请求 429）—— 全过；`unrelatedPathIsNeverLimited` 改用 `/api/v1/teas`（避免落入新限流面自相矛盾）。

### 3.5 契约登记

- `.harness/wiki/api-contract.md` 补登记 `/api/v1/admin/culture/chunks/backfill`（消除 audit-wiki-drift 的「代码端点未登记」告警）。

## 4. 未修复项（中低危清单，位置 / 影响 / 建议）

| # | 级别 | 位置 | 影响 | 建议 |
|---|---|---|---|---|
| L1 | 中 | `/mcp`、`/mcp/messages` 完全公开 | 任何人可经 MCP 协议调 culture-search（只读，但可叠加 H4 限流后仍可被用于探测/资源消耗） | 接 API key 或纳入网关鉴权；当前只读知识检索，风险可接受 |
| L2 | 中 | 注册密码最小 6 位（`RegisterRequest`） | 弱密码爆破面（已有登录限流 10/5min 兜底） | 提至 8 位 + 常见弱密码黑名单；下轮迭代处理 |
| L3 | 中 | 限流为进程内存单实例（`RateLimitFilter` 注释已载明） | 多实例部署时限流计数分散，防护衰减 | 上 Redis 计票（ADR-012 方向）；单用户部署无影响 |
| L4 | 低 | JWT 1440 分钟有效期、无吊销机制 | 泄露 token 在 24h 内可用 | 引入 refresh token 短窗口 + 吊销列表；当前单体低敏应用可接受 |
| L5 | 低 | JWT 存 localStorage（`authStorage.ts`） | XSS 窃取面（当前 0 XSS 出口，风险极低） | 迁移 HttpOnly cookie；随前端会话方案重构一并处理 |
| L6 | 低 | `X-XSS-Protection` 头（nginx） | 已被现代浏览器弃用，无实际防护 | 可保留不影响安全；CSP 才是主防线 |
| L7 | 低 | 管理令牌未轮换机制 | 长期不轮换 | 运维侧定期 rotate `ADMIN_API_TOKEN`；写入 DEPLOY.md 运行手册 |

## 5. 剩余风险

1. **live AI 出网验证未做**：DashScope 欠费（HTTP 400 Arrearage，2026-10-12 实测），所有依赖真实 embedding/LLM 出网的端到端验证（含 culture-search 向量分支、backfill 嵌入成功路径）**未验证（欠费阻塞）**。降级路径（嵌入失败 → pending）已由 mock 测试覆盖。
2. **旧 FastAPI 后端**：本审计未深审（仅维护态）；其安全 posture 以既有 pytest/bandit/ruff 门禁为准。
3. **H4 限流仅 IP 维度**：未登录游客共享出口 IP（NAT/代理）时可能互相挤占配额——这是公开端点的固有取舍，非缺陷。
4. **前端零改动**：本次未发现需修复的前端安全问题（无 v-html/innerHTML 出口），teaAI.ts 降级链承重墙未触碰。

## 6. 门禁结果

| 命令 | 结果 |
|---|---|
| `node scripts/audit-redlines.cjs` | `ERRORS: []` |
| `node scripts/audit-wiki-drift.cjs` | `ERRORS: []`（补登记后无告警） |
| `node scripts/verify-harness.cjs` | `ERRORS: []` |
| `npm audit`（官方 registry） | `found 0 vulnerabilities` |
| `mvn test`（后端全量） | `Tests run: 227, Failures: 0, Errors: 0`，BUILD SUCCESS |
