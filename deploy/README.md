# 部署与运维手册（一盏茶）

本文件同时是**告警规则里 `runbook` 字段的落点**——每条告警的处置步骤都在下文同名小节里。
改标题会断链，改之前先 `grep -rn "runbook:" deploy/prometheus/alerts.yml` 核对锚点。

---

## 一、观测栈

### 启动

```bash
# 主栈（站点本体）
docker compose up -d --build

# 观测栈（可选 overlay，不并入主 compose）
GRAFANA_ADMIN_PASSWORD='强密码' \
  docker compose -f docker-compose.yml -f deploy/observability/docker-compose.observability.yml up -d
```

**为什么是 overlay**：站点能否运行不依赖监控容器。放进默认服务会把「监控挂了」变成「站点起不来」。

### 访问

| 服务 | 地址 | 说明 |
|---|---|---|
| Grafana | `http://127.0.0.1:3000` | 看板「一盏茶 · 生产运行看板」，只读（`allowUiUpdates: false`） |
| Prometheus | `http://127.0.0.1:9090` | 目标 `/targets`，规则 `/rules` |

两者都只绑 `127.0.0.1`，公网不可达。

### 指标端点的安全边界

`/actuator/prometheus` **无鉴权**。它的安全靠三件事同时成立：

1. `docker-compose.yml` 里 backend 端口是 `127.0.0.1:18080:8080`（不是 `18080:8080`）；
2. nginx 路由只放行 `= /actuator/health`，其余 `/actuator/*` 一律 404；
3. Prometheus 从宿主机回环抓取（`host.docker.internal:18080`）。

任一条被改动，指标就会暴露到公网。改部署前跑一次 `node scripts/verify-production.cjs`。

### 部署后验收（必跑）

```bash
node scripts/verify-production.cjs --base https://42.121.125.4 --since 2026-10-19
```

14 项检查：证书受信、安全头齐全、构建新鲜度、HTTP/2、80→443 跳转、ACME 不被跳走、
robots/sitemap 是真实文件、`/.env` 404、manifest/sw 的 MIME、actuator 健康、
指标不被公网暴露。**全部 PASS 才算部署成功**——2026-10-19 曾出现「443 通了但前端镜像
还是 5 天前」的半成品状态，这份脚本就是为它写的。

> service worker 会缓存旧资源：部署后老用户可能仍看到旧版本，直到下次访问触发更新。
> 排查「部署了但页面没变」时先排除这一层（DevTools → Application → Service Workers → Update）。

---

## 二、告警处置

> 阈值分两类：延迟类取自 SLO 常量与 20s 硬超时（有依据）；错误率/兜底率是**初始值**，
> 需真实流量观察一周后校准。看到频繁但无实害的告警，先调阈值，不要让真故障淹没在噪音里。

### AI 上游失败率

`sum(rate(tea_ai_call_attempts_total{outcome=~"failure|timeout"}[5m])) / sum(rate(...)) > 5%`

1. 看 `/rules` 与 `tea_ai_call_attempts_total` 的 `lane` 分布——是全线还是单条链路。
2. 单条链路 → 看该专家的上游（DashScope 或 yg-gateway）。
3. 全线 → 上游整体不可用或 key 失效。此时熔断应已打开，用户走兜底。
4. 确认 key：`docker compose logs backend | grep -i "key\|401"`。

### AI 熔断

`increase(tea_ai_call_attempts_total{outcome="circuit_open"}[2m]) > 0`

- 熔断窗口内请求快速失败并走本地规则兜底，**用户仍有回答**（`degraded=true`）。
- 先查上游是否恢复；恢复后熔断器会在窗口过期后自动半开试探，不需要手动重启。
- 若某个 lane 长期半开失败，考虑调 `tea.circuit-breaker.failure-threshold` 或临时下线该专家。

### AI 延迟

`histogram_quantile(0.99, ...uri=~"/api/v1/ai/.*") > 20`

P99 触到 20s 硬超时上限，说明上游在挂起而不是快速失败。

1. 区分「慢」和「挂」：看同窗口 `outcome="timeout"` 计数。大量 timeout 就是挂起。
2. 挂起时用户体感是转圈到超时，体验比 502 更差。考虑临时下调 `tea.ai.resilience.timeout-ms`。
3. 若与 `JvmHeapPressure` 同时出现，优先查 GC。

### AI 执行深度

`increase(tea_ai_call_depth_exceeded_total[10m]) > 0`

正常请求不应触达（上限 3）。出现即说明某条路径在自我递归，会烧配额。

1. 看 `lane` 标签定位是哪个专家。
2. 检查该专家是否在错误处理里又发起了同类调用。
3. 这是代码缺陷信号，不是配置问题。

### 兜底命中率

`sum(rate(tea_ai_fallback_hit_total[10m])) / sum(rate(tea_ai_call_attempts_total[10m])) > 10%`

兜底在替上游干活——可用性没崩，但用户拿到的是规则答案而非模型答案。

1. 与「AI 上游失败率」对照：上游在坏。
2. 查 `tea_ai_fallback_hit_total{rule=...}` 分布，确认规则库覆盖的是真实问题分布。
3. 长期 > 30% 说明兜底已成主路径，必须修上游或降级产品口径。

### 实验自动回滚

`increase(tea_ab_auto_rollback_total[15m]) > 0`

守门判定实验组指标越阈值，已自动停止。**这是好消息也是坏消息**：机制生效了，但实验失败。

1. `GET /api/v1/admin/experiments`（带 `X-Admin-Token`）看该实验的 `stopReason` 与两组指标。
2. 若 `errorRate` 差值超标 → 实验本身有害，保持停止，排查变体。
3. 若 `p99` 比值超标 → 变体更慢（常见于 Tool Calling 叠加超时），考虑缩小流量重试。
4. 确认不是上游整体在抖：对照 `tea_ai_call_attempts_total` 全 lane 错误率。

### Tool Calling

`increase(tea_ai_toolcalling_fallback_total[10m]) > 5`

实验组在回落使用直接检索。**此时 A/B 结论会被污染**——两组的实际执行路径趋同。

1. 看 backend 日志里的回落原因（模型不支持工具调用 / 参数解析失败 / 上游 502）。
2. 回落率超过实验组流量的一半 → 停止实验（`POST /api/v1/admin/experiments/ai.librarian.tool-calling/stop`）。
3. 注意已知代价：上游超时/502 也会触发回落，最坏延迟约 2× 超时预算。

### Trace 落库失败

`increase(tea_ai_trace_save_failed_total[5m]) > 0`

**最危险的一条**：trace 是黄金指标与实验判据的唯一数据源。写失败意味着调用照常但看板数字停在过去——**看板在骗人却显示绿色**。

1. `docker compose logs backend | grep "save eval trace failed"` 看根因（DB 连接/约束/磁盘）。
2. 同时确认 `Database migration tests` 里 V5/V10 是否已执行。
3. 在此期间**不要相信任何 A/B 结论**。

### 用量日志

`increase(tea_ai_usage_save_failed_total[5m]) > 0`

token 用量丢失会让成本核算偏低，月底对账才对得上。按 trace 同样的路子查 DB。

### 向量检索降级

`increase(tea_culture_search_vector_degraded_total[15m]) > 20`

向量通道失败会退回关键词检索——不报错，但召回质量下降，属静默质量损失。

1. 看 `reason`：`no_model`（embedding 未配置）/ `embed_failed` / `query_failed`。
2. `no_model` 通常是 key 或模型名配置问题，不影响主流程但检索变弱。
3. 配合 `GET /api/v1/ai/metrics/quality` 的 `groundedness` 一起看——检索变弱会先在质量分上体现。

### 5xx

`sum(rate(http_server_requests_seconds_count{status=~"5.."}[5m])) / total > 1%`

先按 `uri` 分：AI 链路看上面几条；业务接口看后端日志的 `RequestIdFilter` 追踪号。

### 连接池

`hikaricp_connections_pending > 5`

连接不够用。常见原因是慢查询，或**事务里做了远程调用**（项目红线）。

1. `docker compose exec db psql -U tea_user -c "select pid,state,query_start,query from pg_stat_activity where state<>'idle'"`
2. 长事务立即用 `pg_terminate_backend` 处理，再查代码。

### 堆压力

`sum(jvm_memory_used_bytes{area="heap"}) / sum(jvm_memory_max_bytes{area="heap"}) > 0.9`

GC 会开始拖慢 P99。若同时 `AiP99LatencyHigh`，先查是不是大对象在 trace 序列化里
（`input_layer` 存了整段对话）。

---

## 三、A/B 灰度运维

### 数据模型
- 分桶：`sha256(expKey:subjectId)` 前 8 字节 mod 100 `< trafficPercent` → treatment。
  **无状态**：同一主体永远同组，不建 assignment 表。
- `subjectId` 优先 userId，其次 sessionId；都没有 → control（安全默认）。
- `assignActive()` 区分「没配实验」与「明确 control」——调用方用 `empty` 表示「保持现状」。
  **不要用 `assign()`**，它把「没配实验」也返回 control，会误关已有能力。

### 建实验（SQL，管理员执行）

```sql
INSERT INTO ab_experiments (exp_key, name, status, traffic_percent, variants, guardrail)
VALUES (
  'ai.librarian.tool-calling',
  'Librarian 工具调用灰度',
  'draft',            -- draft → 人工 start 才生效
  10,                 -- 先 10%
  '{"control":{"toolCalling":false},"treatment":{"toolCalling":true}}',
  '{"maxErrorRateDelta":0.05,"maxP99Ratio":1.5,"minSampleSize":30}'
);
```

### 启停（需 `X-Admin-Token`，与 `ADMIN_API_TOKEN` 一致）

```bash
curl -X POST -H "X-Admin-Token: $ADMIN_API_TOKEN" \
  https://<host>/api/v1/admin/experiments/ai.librarian.tool-calling/start

curl -X POST -H "X-Admin-Token: $ADMIN_API_TOKEN" -H 'Content-Type: application/json' \
  -d '{"reason":"人工止血：上游抖动"}' \
  https://<host>/api/v1/admin/experiments/ai.librarian.tool-calling/stop
```

启停会 evict 分桶缓存，**生效延迟 ≤30 秒**（不是毫秒级；毫秒级要网关层路由）。

### 看结果

```bash
curl -H "Authorization: Bearer <JWT>" \
  'https://<host>/api/v1/ai/metrics/golden?windowMinutes=60'    # 成功率/错误率/P50-P95-P99
curl -H "Authorization: Bearer <JWT>" \
  'https://<host>/api/v1/ai/metrics/quality?windowMinutes=1440' # 相关性/有据性/可操作性/语气
```

Trace 的 `plan_layer` 里有 `experiment` 与 `variant`，按 (experiment, variant) 分组即得两组对比。

### 判定与收尾
1. 样本 < 30 时**不下结论**（守门也是这么设计的）。
2. 结论看三项同时成立：错误率无显著上升、P99 比值 < 1.5、质量分不下降。
3. 通过 → 停止实验并**把 treatment 设为默认**（改代码默认值，不是留着实验行）。
4. 不通过 → 停止实验并记录原因；`stop_reason` 是给下一个人看的。

### 常见问题

| 现象 | 原因 |
|---|---|
| 实验开了但没生效 | 状态不是 `running`；或 `traffic_percent=0`；或主体为 null（游客无 sessionId） |
| 指标全 0 | trace 没写 `plan_layer.experiment`；或该窗口内无样本 |
| 两组数据几乎一样 | treatment 频繁回落到 control 路径（看 `tea_ai_toolcalling_fallback_total`） |
| 自动回滚了但看不出原因 | 看 `stop_reason` 字段，形如 `auto_rollback: error_rate_delta=0.08` |
