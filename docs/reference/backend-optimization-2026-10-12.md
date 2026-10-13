---
title: 后端优化报告（性能/正确性/可观测性/健壮性）
date: 2026-10-12
scope: backend（Spring Boot 3.5 + Spring Data JPA + Spring AI Alibaba）
worktree: perf/backend-opt（从 main=fdba8db 检出）
status: deprecated
owner: yanha
last_updated: 2026-10-13
---

# 后端优化报告 2026-10-12

> 范围：`backend/src/main/java/com/tea/{ai,common,garden,record,culture}`。不碰 auth/security（并行安全 agent 拥有）、前端、`.harness/`、AGENTS.md。
> 方法：四维各查一遍，只落有代码/字节码证据的优化；每项附改动 + 理由证据 + 验证。

## 一、四维结论摘要

| 维度 | 发现 | 已修 | 查过无问题 |
|---|---|---|---|
| 性能 | 2 项 | 2 项 | N+1 / 循环内查询 / 缺索引依据：无（见下） |
| 正确性 | 0 项 | — | 事务边界、并发原子性、幂等兜底均成立 |
| 可观测性 | 2 项缺口 | 2 项 | PR#43 教训（NOT NULL null 归零）已修 |
| 健壮性 | 1 项 | 1 项 | AI 超时存在（180s）；GlobalExceptionHandler 覆盖完整 |

## 二、优化项清单

### P1 perf：GardenEnergyService.summary() 全表拉行求和 → DB 侧 SUM

- **文件**：`garden/repository/GardenEnergyEventRepository.java`、`garden/repository/GardenPlantRepository.java`、`garden/service/GardenEnergyService.java`
- **改动**：新增 `sumPendingAmount(userId)` / `sumCollectedAmount(userId)`（JPQL `coalesce(sum(e.amount),0)`）与 `GardenPlantRepository.sumEnergy(userId)`；`summary()` 三个求和从「拉全量 List 到 JVM `stream().mapToInt().sum()`」改为 DB 聚合。
- **理由（证据）**：改前 `summary()` 执行 3 次列表加载——`findByUserIdAndCollectedAtIsNull` / `...IsNotNull` / `findByUserIdOrderByIdAsc`——只为求三个合计数；事件账本随品鉴次数单调增长，每次 `/garden-energy` 轮询都全量回表。
- **验证**：`GardenEnergyServiceTest` 更新桩为聚合方法，并断言 summary 路径上三个列表加载方法 `never()` 被调用；`collect()` 流程（需实体更新 collected_at，保留列表加载）不变。全量 221 测试通过。

### P2 perf：AiChatService.anchor() 重复归属校验 → 免二次查库

- **文件**：`ai/service/AiChatService.java`
- **改动**：多轮锚定历史从 `memoryService.anchorHistory(userId, sessionId)`（内部 `requireSession` + 查消息）改为 `memoryService.history(sessionId, 20)`。
- **理由（证据）**：`chat()` 入口 line 86 已在同条件（`userId != null && sessionId != null`）下做过 `requireSession`；`anchor()` 再走 `anchorHistory` → 二次 `findByIdAndUserId`。每个登录多轮聊天多一次冗余主键查询。归属校验语义不变（同一条件前置校验过）。
- **验证**：`AiChatServiceTest` 桩改 `history(3, 20)`，新增 `verify(requireSession, times(1))` 与 `verify(anchorHistory, never())` 锁定去重。

### P3 observability：ragHitRate 无观测 → Micrometer 计数

- **文件**：`culture/service/CultureSearchService.java`
- **改动**：构造注入 `MeterRegistry`（spring-boot-starter-actuator 自带 SimpleMeterRegistry，零新增依赖）；向量分支埋点：
  - `tea.culture.search.vector.attempted`（embedding 调用成功、进入向量查询）
  - `tea.culture.search.vector.rows`（向量查询返回行数）
  - `tea.culture.search.vector.degraded{reason=no_model|embed_failed|query_failed}`（降级次数）
- **理由（证据）**：任务点名 ragHitRate；改前向量分支（T05b）只在降级时打 warn，命中/降级比率完全不可见。
- **验证**：`CultureSearchVectorBranchIntegrationTest`（Testcontainers pgvector）新增断言：embedding 失败用例后 `degraded{reason=embed_failed}` 计数 > 0。

### P4 observability：旁路埋点落库失败只 warn → 加失败计数（PR#43 教训）

- **文件**：`ai/service/TraceRecorder.java`、`ai/service/AiUsageLogger.java`
- **改动**：
  - `TraceRecorder.record()` catch 分支追加 `tea.ai.trace.save.failed` 计数。
  - `AiUsageLogger.save()` 将 `usageLogRepository.save` 包 try/catch：失败计 `tea.ai.usage.save.failed` 后原样抛出（调用方 AiChatService/BaseExpertAgent 已有 try/catch 降级语义，行为不变）。
- **理由（证据）**：AGENTS.md §13 记录 PR#43 事故——旁路埋点 catch 只落 warn，NOT NULL 字段 null 导致 insert 失败，Trace 静默丢失且数月无观测。同类问题复发时应有指标告警面。
- **验证**：新增 `TraceRecorderTest` 纯单测（SimpleMeterRegistry + mock repo 抛异常）：失败不向外抛且 `tea.ai.trace.save.failed` = 1；成功路径无失败计数。

### P5 robustness：RateLimitFilter 陈旧窗口永不清理 → 有界摘除

- **文件**：`common/ratelimit/RateLimitFilter.java`
- **改动**：窗口条目加 `lastActiveAt`；修剪过期时间戳后，若队列空且距最后活跃 > 2×窗口 → `store.remove` 摘除，再 `putIfAbsent` 放全新窗口承接本次请求（两步式：先摘后占，避免把刚摘除的旧对象又放回 map）。
- **理由（证据）**：改前 `store`（ConcurrentHashMap）对 `(rule, ip)` 条目无任何清理路径——公网面 `/api/v1/ai/*` 按 IP 限流，换 IP / 匿名访问会让 map 无界增长（慢性内存泄漏）。
- **验证**：`RateLimitFilterTest` 新增 `staleWindowsAreEvictedAfterTwoWindowPeriods`（窗口 50ms，空闲 >100ms 后再访问）；测试首轮抓出实现缺陷（摘除后继续写脱离 map 的旧窗口、计数丢失），已重构为两步式并复测通过。

## 三、查过无问题（证据备查）

### 正确性维度
- **事务边界**：写方法均 `@Transactional(rollbackFor = Exception.class)`（TastingRecordService.create/delete、GardenEnergyService.collect）；只读 `readOnly = true`（summary/list/getById/history）。`recordTasting` 裸 `@Transactional`：业务异常经 `BusinessException extends RuntimeException`（已读源码确认）回滚语义成立。
- **并发**：record/plant/energy-event 三域均「查重 + 唯一索引兜底 + DataIntegrityViolationException 转幂等返回」；`AiCallQuota.tryAcquire` 用 `ConcurrentHashMap.computeIfAbsent + AtomicInteger` 计数原子；超限调用仍计数（one-shot 语义，类注释已写明，非缺陷）。
- **无状态不一致**：收集单事务原子（置 collected_at + 累加 energy + 阶段推进）；品鉴记账同事务（S1 能量记账失败整体回滚）。

### 健壮性维度
- **AI 超时**：实测字节码——`spring.ai.dashscope.read-timeout` 在 1.1.2.4-security-fix 是**死属性**（`getReadTimeout()` 在 autoconfigure jar 内零调用方）；实际生效为 `DashScopeApi$Builder` 硬编码 connect 60s / read 180s（`SimpleClientHttpRequestFactory.setConnectTimeout(60000)/setReadTimeout(180000)`）。超时存在且宽裕，不缺失；因属性不可配且改动会触碰 502 降级承重墙，未动。
- **重试**：`spring-ai-autoconfigure-retry` 已生效（测试日志见 `SpringAiRetryAutoConfiguration: Retry error. Retry count: 1`），401/网络错误自动重试 1 次。
- **GlobalExceptionHandler**：覆盖 BusinessException / 参数校验 / 报文不可读 / 类型不匹配 / 方法不支持 / 资源 404 / 兜底 500，不向前端泄堆栈。查过无缺口。
- **AI 调用 502 降级链**：`checkKey` 缺失→502、调用异常→502、空响应→502，前端 teaAI.ts 据此降级规则引擎；本次改动未触碰该路径。

### 性能维度（反查）
- **无 N+1**：五专家路由（AgentOrchestrator 纯内存关键词）、AgentSkillRouter（单条 findFirst）、PromptService（单条 findFirst）均单查询；CultureSearch 8 表 ILIKE 各一次 `LIMIT 5` + 向量一次查询（HNSW 索引），无循环内查询。
- **索引**：`garden_energy_events(user_id, collected_at)` 过滤可命中 `uk_garden_energy_events_user_client` 的 user_id 前缀；单用户事件量（品鉴次数）为数十级，未加复合索引（避免 L3 迁移换取无实测收益）。
- **trace 落库 null 归零**：`TraceRecorder.complete` 已对 tokensIn/Out/latencyMs 做 `null → 0`（V5 迁移 NOT NULL 列），PR#43 修复在位。

## 四、测试结果

- 命令：`cd backend && mvn -q -o test`（本地 Docker 可用，Testcontainers pgvector/pg16 全量跑）。
- 结果：**37 个测试类 / 221 个测试 / Failures 0 / Errors 0 / Skipped 0**。
- 新增测试：`TraceRecorderTest`（2）；更新：`GardenEnergyServiceTest`、`AiChatServiceTest`、`RateLimitFilterTest`、`CultureSearchVectorBranchIntegrationTest`。
- 依赖 live AI 的验证（DashScope）按任务要求跳过——账户欠费（HTTP 400 Arrearage / 实测 401 InvalidApiKey），相关用例走降级路径断言。

## 五、未做（边界声明）

- auth/security 修复类：发现即记录不修（并行 agent 范围）。本次未发现需要记录的越权/注入/密钥问题。
- 不加 micrometer-registry-prometheus：任务只要求 ragHitRate 观测，SimpleMeterRegistry + actuator `/actuator/metrics` 已够；引入外部导出端点属另一个变更。
- 不动 `spring.ai.dashscope.read-timeout` 死属性：不可配且触碰降级链，记入备查即可。
