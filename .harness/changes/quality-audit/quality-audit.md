---
last_updated: 2026-10-09
status: active
owner: yanha
---

# 质量四性审计 — 批 3 安全性修复清单

审计时间：2026-10-09。范围：全库（批 3 安全性核对 + 修复）。

## 核对结果（批 3 五项）

| 核对项 | 结果 | 证据 |
| --- | --- | --- |
| 越权核对 | ✅ | TastingRecordService 全部 `findByIdAndUserId(id, userId)` 归属校验；写路径防横向越权 |
| 密钥核对 | ✅ | application.yml 全环境变量注入（AI_DASHSCOPE_API_KEY/JWT_SECRET/DB_PASSWORD）；`.env*` 均未 git 跟踪；前端 src/ 无 dashscope/apiKey/sk- 直连（AI 承重墙代理成立） |
| 输入校验 | ✅ | AuthService 对 null/空 password 抛业务异常（BadRequest），测试覆盖；统一 ApiResponse |
| 面收敛 | ⚠️ 已修 | CSP/安全头 nginx.conf 全套已 enforce（X-Frame DENY/X-Content-Type/nosniff/CSP 完整）；**Spring Boot 无限流**（见修复 1） |
| npm audit | ✅ | `found 0 vulnerabilities`（--registry=https://registry.npmjs.org） |

## 修复清单（高危清零）

```
SecurityConfig.java:43: 高危 AI/登录公开端点无限流. Spring Boot 重写未迁移旧栈 RateLimitMiddleware（RATE_LIMIT_* 环境变量）. 新增 RateLimitFilter（进程内存滑动窗口，IP+面维度）挂 JWT 前 + tea.ratelimit 配置化 + 429 统一 ApiResponse(RATE_LIMITED).
ErrorCode.java:20: 中危 缺 429 错误码. 错误码表未覆盖限流面. 新增 RATE_LIMITED("RATE_LIMITED", TOO_MANY_REQUESTS).
TeaApplication.java:9: 中危 @ConfigurationProperties 未扫描. 无 ConfigurationPropertiesScan 时 tea.ratelimit 不生效. 主类加 @ConfigurationPropertiesScan.
application.yml: 中危 限流阈值硬编码风险. 无配置项. 新增 tea.ratelimit.{ai-max,ai-window-ms,login-max,login-window-ms}，环境变量沿用旧栈 RATE_LIMIT_AI_MAX/RATE_LIMIT_LOGIN_MAX.
```

## 修复文件

- `backend/src/main/java/com/tea/common/ratelimit/RateLimitFilter.java`（新增）
- `backend/src/main/java/com/tea/common/ratelimit/RateLimitProperties.java`（新增）
- `backend/src/main/java/com/tea/common/errorcode/ErrorCode.java`（+RATE_LIMITED）
- `backend/src/main/java/com/tea/auth/security/SecurityConfig.java`（注册 filter，放 JWT 前）
- `backend/src/main/java/com/tea/TeaApplication.java`（+@ConfigurationPropertiesScan）
- `backend/src/main/resources/application.yml`（+tea.ratelimit）
- `backend/src/test/java/com/tea/common/ratelimit/RateLimitFilterTest.java`（新增，5 用例）

## 验证

- [x] `mvn test -Dtest=RateLimitFilterTest`：5/5 通过
- [x] `npm audit --registry=https://registry.npmjs.org`：0 vulnerabilities
- [ ] `mvn -q test` 全量（等后台结果）
- [ ] 批 1 主门禁重跑（audit-redlines + verify-harness）全绿

## 未修项（记录不修）

- MCP 端点（/mcp /mcp/messages）permitAll：culture-search 只读公开知识，注释已声明未来敏感工具须单独收紧——暂不改（P1-1 既定边界）
- 多实例限流需 Redis 计票：单实例内存实现与旧栈同级别，Redis 属 ADR-012 两级缓存方向，非本审计范围
