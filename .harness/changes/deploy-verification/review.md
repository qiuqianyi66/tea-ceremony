# deploy-verification Review

> 本轮不是功能开发，是「把上一轮的成果真正跑起来」时暴露问题的修复。
> 结论：**通过**，0 🔴 0 🟡。两个致命问题都是"静态校验全绿、服务不可用"。

## 一、为什么会出现「以为部署了其实没部署」

线上 443 已开、证书受信，但：

- `/` 的 `Last-Modified` 是 `2026-10-13`（5 天前）
- 无 HSTS / CSP / X-Content-Type-Options / X-Frame-Options / Referrer-Policy / Permissions-Policy
- `/.env` 返回 `index.html`（soft-404）
- `/robots.txt` 返回 HTML
- 80 不跳转 443

结论：**backend 可能更新了，但 frontend 镜像与 nginx 配置都是旧的**。这种状态不报任何错。

这也是 `scripts/verify-production.cjs` 存在的理由：把"部署成功"从主观判断变成 14 项可执行断言。

顺带纠正我上一轮的一个错误结论：我说线上「ALPN 只协商 http/1.1」。那是错的——`curl` 在 Windows 上不支持 `--http2`，它只提议了 http/1.1。用 Node 的 `http2` 模块实测：**ALPN 协商为 h2**，线上 HTTP/2 是好的。

## 二、真跑才发现的两个致命问题

### 1. 指标端点 401（观测体系整个不生效）

`SecurityConfig` 的 permitAll 只列了 `/actuator/health`。加 `micrometer-registry-prometheus`
并把端点暴露出去之后，请求仍然被 `anyRequest().authenticated()` 拦成 401。

Prometheus 侧表现是 target down + `lastError` 里一串 401；**不会有人看**。也就是说前面做的
13 条告警、10 个面板、ADR-025 全部悬空。

修：加入 permitAll。安全边界不变——backend 端口只绑宿主 `127.0.0.1`，nginx 白名单只放行
`= /actuator/health`，公网拿不到它。给抓取端发 JWT 会引入会过期的凭据，反而更脆。

### 2. 顶层 YAML 重复键（服务完全起不来）

上一轮给 `tea.ai.quality` 加配置时新起了一个顶层 `tea:`，而文件里已有 `tea:`。
应用启动直接 `DuplicateKeyException: while constructing a mapping`。

**487 个测试全绿**，因为 `src/test/resources/application.yml` 是另一份文件——
单测与 `@SpringBootTest` 都读测试那份，**主配置的语法错误没有任何测试覆盖**。

修：合并进既有 `tea.ai` 下；补 `ApplicationYamlTest`。

写这个测试时我自己先错了一次：用 `ClassPathResource("application.yml")` 读到的是
**测试那份**（test-classes 在 classpath 前面），检查落空但测试是绿的——比没有更糟。
改为按文件路径读 `FileSystemResource("src/main/resources/application.yml")`，
找不到就显式失败（找不到 = 没检查，不能静默通过）。负向验证：加回重复键，用例立刻红。

## 三、观测栈真跑（不是只做静态校验）

| 环节 | 结果 |
|---|---|
| backend（新 jar）启动 | 成功，Flyway 依次应用 **V8 / V9 / V10** → `now at version v10` |
| `/actuator/prometheus` | 200，388 行，含 `jvm_memory_used_bytes`、`hikaricp_connections_pending` |
| Prometheus 抓取（仓库原始配置） | `tea-backend` target **up**，`lastError` 空，`lastScrapeDuration 0.019s` |
| 告警规则加载 | 5 组 13 条全部加载，`health=ok` |
| Grafana datasource | `Prometheus` → `http://prometheus:9090`，`default=true` |
| Grafana 看板 | 「一盏茶 · 生产运行看板」`panels=10`，`meta.provisioned=true` |
| 看板查询 | JVM 堆使用率 / Hikari 排队 有数据；HTTP 与 AI 面板需真实流量 |

**诚实标注**：`http_server_requests_*` 与 `tea_ai_call_attempts_total` 在本次查询里为空——
本机没有真实请求与 AI 调用，计数器未注册。这不代表面板坏了，但**也没有被证明有数**。

## 四、`AiChatService` 重构

18 参构造器 → `AiChatDeps` record（按 6 组分类）+ `@Bean` 工厂。行为零变化。

Spring 不能直接注入 record，所以必须有一个工厂把 18 个依赖声明一次。放在新建的
`AiChatConfig` 而不是 `AiResilienceConfig`——后者被 `AiCallWiringTest` 用
`scan("com.tea.ai.resilience")` 扫，把工厂放进去会连带要求 18 个 bean 全部存在。

`McpServerIntegrationTest`（真启动 Spring 上下文）通过，证明装配正确。

## 五、运维手册

`deploy/README.md` 同时是 **13 条告警的 `runbook:` 落点**。此前那个文件根本不存在——
所有告警的"查看怎么处理"链接都是死链，而且不会报错。

已把锚点校验并入 `verify-alert-rules.cjs`：每条告警的 `runbook` 必须能落到 README 的同名标题，
否则报错。13/13 通过。

## 六、验证证据

| 命令 | 结果 |
|---|---|
| `mvn clean test` | **487 run / 0 fail / 0 error / 0 skipped / BUILD SUCCESS** |
| `node scripts/verify-production.cjs --base https://42.121.125.4` | 5 PASS / 9 FAIL（**这是对的**：线上确实没部署） |
| `node scripts/verify-alert-rules.cjs` | 埋点 12 / 规则 13 / 面板 10 / 锚点 13，`ERRORS: []` |
| `node scripts/verify-harness.cjs` | `ERRORS: []` |
| `node scripts/audit-redlines.cjs` | `ERRORS: []` |
| `node scripts/audit-wiki-drift.cjs` | 52 / 52，`ERRORS: []` |
| `node scripts/verify-nginx-{headers,routes}.cjs` | `ERRORS: []` |
| 负向：临时加回 YAML 重复键 | `ApplicationYamlTest` 立刻红（DuplicateKeyException） |

## 七、遗留

1. **仍未部署**：没有生产机 SSH 凭据。部署后必须跑 `verify-production.cjs --since <部署日期>` 验收。
2. **告警阈值未校准**：需真实流量一周。
3. **Tool Calling 无真模型端到端验证**：本机无 DashScope key。
4. **看板的 HTTP / AI 面板未在真实流量下验证**。
5. 本地 `docker compose build backend` 在容器内 `mvn package` 失败（依赖下载），本机打 jar 后
   以容器方式运行验证通过。**CI 里能构建成功**，故判断为本地网络问题，未深究；部署时应确认
   backend 镜像能正常构建。

## verdict

🔴 0 🟡 0 —— 通过。

这轮的产出有一半是"发现"，不是"实现"：指标端点 401、YAML 重复键、runbook 死链、
线上半成品部署——四个问题都满足同一个特征：**不报错、测试全绿、但用户/运维侧不可用**。
`verify-production.cjs`、`ApplicationYamlTest`、runbook 锚点校验就是为这一类问题加的三道门。
