# deploy-verification

> 分支：`feature/deploy-verification`
> 起因：2026-10-19 实测线上发现「443 已开、证书受信，但前端镜像还是 5 天前、nginx 还是旧配置」——
> 一种不会报任何错、只能靠逐项探测才能暴露的半成品状态。

## 范围（四项）

| # | 项 | 交付 |
|---|---|---|
| 1 | 部署验收脚本 | `scripts/verify-production.cjs`（14 项检查，有 FAIL 即退出码 1） |
| 2 | 观测栈真跑验证 | 本机起 Prometheus + Grafana，验证抓取/规则/看板 provisioning |
| 3 | `AiChatService` 参数聚合 | `AiChatDeps` record + `AiChatConfig` 工厂，构造器 18 参 → 1 参 |
| 4 | 运维手册 | `deploy/README.md`：13 条告警处置 + A/B 灰度运维，同时是告警 `runbook:` 的落点 |

## 真跑验证时发现的两个致命问题

这两个都是「静态校验全绿、服务实际不可用」。

### 1. `/actuator/prometheus` 返回 401

`SecurityConfig` 的 permitAll 只有 `/actuator/health`，指标端点被 `anyRequest().authenticated()` 拦下。
Prometheus 抓到 `{"code":"UNAUTHORIZED"}`，指标一条都进不来，而且不报错。

修：把 `/actuator/prometheus` 加入 permitAll。安全边界仍由网络可达面保证（端口只绑 127.0.0.1 +
nginx 白名单只放行 `/actuator/health`），给抓取端发会过期的 JWT 反而更脆。

### 2. `application.yml` 顶层重复键让服务起不来

上一轮加 `tea.ai.quality` 时新起了一个顶层 `tea:`，文件里已有 `tea:` →
`DuplicateKeyException`，**应用完全无法启动**。

487 个测试全绿也没抓到：`src/test/resources/application.yml` 是另一份文件，
单测与 `@SpringBootTest` 都读测试那份，主配置的语法错误无人覆盖。

修：合并到既有 `tea.ai` 下；补 `ApplicationYamlTest`（用 Spring 的 `YamlPropertySourceLoader`
按文件路径加载主配置，不能用 `ClassPathResource`——test-classes 排在 classpath 前）。

## 实测证据

```
【部署验收脚本 对当前线上】
✓ cert-trusted        TLS 校验通过（未使用 --insecure）
✓ http2               ALPN 协商为 h2
✗ security-headers    HSTS/CSP/XCTO/XFO/Referrer/Permissions 全缺
✗ build-freshness     构建于 2026-10-13，早于要求
✗ http-redirect       期望 301，实际 200
✗ robots-text         robots.txt 返回 HTML
✗ sitemap-xml         不是 sitemap XML
✗ dotenv-404          返回 200（soft-404 仍在）
✗ manifest-mime       application/octet-stream
✗ actuator-health     status=200 body=<!DOCTYPE html>
✗ prometheus-not-public 200 但返回 HTML
合计 14 项：5 PASS / 0 WARN / 9 FAIL

【观测栈 真进程】
backend（新 jar）启动成功，Flyway 依次应用 V8 telemetry / V9 ab experiments / V10 ai quality layer
  → "Successfully applied 3 migrations, now at version v10"
/actuator/prometheus → 200，388 行，含 jvm_memory_used_bytes / hikaricp_connections_pending
Prometheus（仓库原始 prometheus.yml）：
  targets: tea-backend up（lastError 空，lastScrapeDuration 0.019s）
  rules:   5 组 13 条全部加载，health=ok
Grafana：
  datasource "Prometheus" → http://prometheus:9090（default=true，provisioned）
  dashboard "一盏茶 · 生产运行看板" → panels=10，meta.provisioned=true
  关键查询：JVM 堆使用率 / Hikari 排队 有数据；HTTP 与 AI 面板需真实流量

【重构】
mvn clean test → 487 run / 0 fail / 0 error / 0 skipped / BUILD SUCCESS
McpServerIntegrationTest 3 例通过（Spring 上下文真启动 ⇒ @Bean 工厂装配正确）

【新增门禁的负向验证】
故意在 application.yml 尾部加回顶层 tea: → ApplicationYamlTest 立刻红（DuplicateKeyException）
```

## 影响面

- `AiChatService` 构造器 18 → 1（`AiChatDeps`）；5 处测试夹具改为构造 `AiChatDeps`
- `SecurityConfig` 多放行一个只读端点，边界不变
- `application.yml` 结构修正（不是新增配置）
- `verify-alert-rules.cjs` 增加 runbook 锚点校验：13 条告警的链接必须能落到 `deploy/README.md` 的同名标题

## 回滚

删除 `AiChatDeps.java` / `AiChatConfig.java`，`AiChatService` 换回 18 参构造；
`SecurityConfig` 去掉 `/actuator/prometheus`；其余为新增文件，删除即回滚。无数据库变更。
