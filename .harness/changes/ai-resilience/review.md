# ai-resilience Review

> 评审对象：AI 执行链路容错（`com.tea.ai.resilience`）+ 本地规则兜底（`com.tea.ai.fallback`）+ 三大黄金指标（`com.tea.ai.metrics`）
> 依据：`docs/plans/audit-ai-production-readiness-2026-10-18.md`（企业级 14 项标准审计）
> 评审方式：主控逐项复核子代理产出，重点验证「类存在」≠「接线生效」
> 结论：**通过（有条件）**，0 🔴 0 🟡，2026-10-18

## 一、最关键的复核：兜底是否真被调用

子代理初版交付里 `LocalFallbackService` **没有任何调用方**——编译通过、4 个单测通过，但线上永远走不到。这类「孤儿类」是本次审计要防的头号问题（截图原话：没有兜底的 Agent 系统是悬在半空的定时炸弹）。

主控处理：在 `AiChatService` 增加 `fallbackOrThrow(...)`，覆盖**两个**失败入口（入口熔断门禁 + dispatch 异常），并新增 `AiChatFallbackWiringTest` 5 例作为证明：

| 用例 | 断言 |
|---|---|
| 上游失败 + 规则命中 | 返回 `degraded=true`、`sources=["本地规则库"]`、Trace 记 fail |
| 上游失败 + 规则未命中 | 仍抛 `BadGatewayException`（502 承重墙未被削弱） |
| 熔断 OPEN + 规则命中 | 返回降级答案，且 `librarian.chat` 从未被调用（不碰上游） |
| 配额超限 | 抛 `QuotaExceededException`，`answerFor` 调用次数精确为 1（即只有第一次的兜底，配额路径零调用） |
| 登录会话降级 | `appendMessage(sessionId, "assistant", 答案, "fallback")` 被调用（历史不断裂） |

**评审过程的一条自纠**：配额用例初版断言 `verify(fallback, never())` 失败——不是代码错，是断言太粗（第一次调用合法使用了兜底）。已改为「精确 1 次」，测试不放宽而是更精确。

## 二、容错执行器

- ✅ 执行顺序与截图一致：深度门禁 → 熔断门禁 → 硬超时 → 重试（指数退避 + 抖动） → 兜底
- ✅ 硬超时用 `Executors.newVirtualThreadPerTaskExecutor()` + `Future.get(timeout)`，超时后平台线程立即归还
- ✅ 深度计数用 `ThreadLocal` 并在 `finally` 中 `remove()`（防线程池残留）
- ✅ 业务异常（`QuotaExceeded` / `Unauthorized` / `BadRequest` / `NotFound`）**不重试**——重试业务错误只会放大问题，测试断言「只调用 1 次」
- ✅ 每次尝试都报熔断器，指标 `tea.ai.call.attempts{lane,outcome}`，outcome 六值可区分
- ✅ 退避时间序列有断言（jitter 置 0 后精确 800ms、1600ms），用注入的 `Sleeper` 保证测试零等待
- ⚠️ 已知局限（子代理已注明）：`retryOnStatusCodes` 只绑定未参与分类——Spring AI 把 HTTP 失败统一包成异常，取不到稳定状态码，故按异常类型分类；集合留给网关层按真实状态码分流

## 三、熔断分桶

- ✅ `AiCircuitBreaker` 从「一个全局 `openedAt`」改为 `ConcurrentHashMap<String, Bucket>`
- ✅ lane 隔离有专门用例：A 桶打开后 B 桶仍放行
- ✅ 旧无参 API 保留并标 `@Deprecated` → `default` 桶；**旧测试文件一行未改仍通过**（兼容性由测试证明，不是声明）
- ✅ `MAX_BUCKETS=32` 上界 + 超界归 default + warn（防把用户 ID 当 lane 造成无界增长）
- ⚠️ 入口层（`AiChatService.chat`）仍用无参 API = default 桶，与执行器层按真实 lane 上报**不是同一个桶**。这是为兼容既有测试与「入口快速失败」语义的有意选择，已在字段注释写明，并提示不得删入口两处调用

## 四、本地规则兜底

- ✅ 引擎纯函数、可 new、无 Spring/IO/时钟依赖（21 例单测）
- ✅ **零硬编码茶名**：茶名/best_temp/best_time/器具全部来自 `teas` / `teawares` 表；茶类基准区间按入参聚合 min/max
- ✅ 5 类规则：水温 / 冲泡时间 / 投茶量器具 / 具体茶介绍 / 茶类介绍；「具体茶长名优先」避免「安吉白茶」被答成白茶类
- ✅ 绝不抛异常：任何异常吞掉返回 `Optional.empty()`（兜底失败只能表现为「没兜住」，不能升级成 5xx）
- ✅ 快照 TTL 5 分钟 + 刷新失败沿用旧快照（DB 抖动时不丢兜底能力）
- ⚠️ 一个非 DB 数字：投茶量用常量 `ML_PER_GRAM = 50`（茶水比 1:50）由器具容量换算——`teawares` 表无克数字段，已在 javadoc 标注为器具无关通行基准

## 五、三大黄金指标

- ✅ 定义与截图一致：Task Success Rate（成功率）/ Tool Call Error Rate（失败率）/ P99 Latency（并给 P50/P95）
- ✅ 数据源选 `ai_eval_traces` 而非 `ai_usage_logs`——后者只记成功调用，**算不出错误率**（这是子代理的正确判断）
- ✅ `percentile_cont(0.99)` 下推原生 SQL，不在 Java 里全表拉数据
- ✅ 零调用口径为 `null` 而非 0（0 会被看板读成「全线故障」），已写进 DTO javadoc
- ✅ 样本 <20 只压 P99，不压 P50/P95（20 为边界，有用例）
- ✅ Controller 落在 `com.tea.ai.controller` 而非 `metrics` 包——ArchUnit 的「Controller 返回 ApiResponse / 禁查库」规则只匹配 `..controller..`，放错包会让门禁**静默失效**
- ✅ 需 JWT（未改 SecurityConfig，由 `anyRequest().authenticated()` 覆盖）

## 六、验证证据（主控实跑）

| 命令 | 结果 |
|---|---|
| `mvn -q -DskipTests compile` | exit 0 |
| `mvn test -Dtest='com.tea.ai.**.*Test,com.tea.architecture.*Test'` | **191 run / 0 fail / 3 errors(Docker) / 1 skipped** |
| `mvn test -Dtest='AiChatFallbackWiringTest,AiChatServiceTest,AiCallQuotaTest'` | 35 run / 0 fail |
| `node scripts/audit-wiki-drift.cjs` | 47 登记 / 47 代码，`ERRORS: []` |
| `node scripts/audit-redlines.cjs` | `ERRORS: []` |
| `node scripts/verify-harness.cjs` | `ERRORS: []` |

3 个 error 的根因已逐个取证：`McpServerIntegrationTest` / `AgentSkillRouterIntegrationTest` / `TraceRecorderIntegrationTest` 均为 `IllegalStateException: Could not find a valid Docker environment`——**环境限制，非代码缺陷**，CI 有 Docker 时会执行。

## 七、遗留与待确认

1. **未部署、未观测**：所有结论来自本地测试与代码复核，没有生产流量验证。
2. **集成测试未在本机执行**（Docker），CI 补跑。
3. **灰度 / 双轨流量未实现**（审计 #13）：需网关层流量镜像与版本标记，单实例部署也无物理条件，属下一轮 L3 议题。
4. **Agent 内部 span 未做**（审计 #14）：本轮只把 lane 维度拆出来（可按链路看指标），真正的子调用 span 需要 OTel 或自建 span 表。
5. **Tool Calling 未进 chat 路径 / 无 ReAct 循环**（审计 #9/#10）：两者都会改变回答质量基线，应先有 A/B 能力与成本基线，否则改了不知道好坏。
6. **业务异常也报 `onFailure`**：极端情况下业务错误会累加该 lane 的熔断计数。当前 `RateLimitFilter` 已在上游拦住 429 风暴，风险可控；如需严格隔离，删该分支一行即可（子代理已标注位置）。
7. **`AiChatService` 构造器已 17 参**：接近不可维护阈值。本轮为避免牵连面扩大未做重构，建议下一轮抽 `AiChatDeps` 聚合参数对象。

## verdict

🔴 0 🟡 0 —— 通过（有条件）。四项缺口（重试/超时、分桶熔断、本地兜底、三大指标）全部落地并有实测证明；兜底「从孤儿类到真被调用」这一关键缺口由主控补接并加 5 例接线测试锁死。遗留 7 项均已定性，其中 3 项（灰度/span/Tool Calling）属下一轮架构议题，不改变本轮交付的正确性。
