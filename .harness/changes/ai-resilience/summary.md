# ai-resilience 变更记录

> 目录：`.harness/changes/ai-resilience/`，对应分支 `feature/ai-resilience`。
> **无数据库迁移**：本轮不新增/修改表。三大黄金指标读取既有 `ai_eval_traces`（ADR-016 已建），故无 `db-migrations.sql` / `rollback.sql`。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | ai-resilience（AI 执行链路容错 + 多级兜底 + 三大黄金指标） |
| 分支 | `feature/ai-resilience`（基于 main） |
| 需求来源 | `docs/plans/audit-ai-production-readiness-2026-10-18.md`（企业级 14 项标准审计，缺口 #6/#7/#8/#9/#17/#18/#19/#20） |
| 类型 | feat |
| 涉及范围 | 后端 AI 层（新增 `resilience` / `fallback` / `metrics` 三包）+ 配置 + 契约登记 |

## 二、需求与方案

### 需求描述

1. 上游 LLM 调用要有硬超时、指数退避重试、按链路隔离的熔断、执行深度门禁。
2. 上游不可用时后端要有本地规则库兜底，而不是只回 502 把责任推给前端。
3. 三大黄金指标（Task Success Rate / Tool Call Error Rate / P99 Latency）要能实时查出来。

### 验收标准（Given-When-Then）

- **Given** 上游 LLM 连续两次失败、第三次成功 / **When** 调用 chat / **Then** 返回成功结果，attempts=3，`tea.ai.call.attempts{lane,outcome}` 有计数
- **Given** 上游挂起不返回 / **When** 超过 `timeout-ms` / **Then** 本次尝试被判定超时并进入重试，Tomcat 线程不被无限占用
- **Given** librarian 链路连续失败达阈值 / **When** 再次请求 librarian / **Then** 只熔断 librarian，chat/advisor/taster/brewer/mentor 仍放行
- **Given** 上游全部失败且问题命中本地规则 / **When** 调用 chat / **Then** 返回 200 + `degraded=true` + `sources=["本地规则库"]`
- **Given** 上游全部失败且规则未命中 / **When** 调用 chat / **Then** 仍抛 502（承重墙不变，前端 teaAI.ts 走第三级降级）
- **Given** 会话配额超限 / **When** 调用 chat / **Then** 抛 429，**不**走规则库（业务错误不得被兜底掩盖）
- **Given** 近 60 分钟有调用 / **When** GET `/api/v1/ai/metrics/golden` / **Then** 返回按 agent 分组的三指标；样本 <20 时 p99 为 null 且 `insufficientData=true`

### 技术方案

```
chat() 入口
  ├─ 归属校验 → 路由 → 复杂度 → 锚定 → 配额
  ├─ 熔断门禁(入口, default 桶) ── OPEN ─┐
  ├─ dispatch(专家/透明代理)              │
  │     └─ AiCallExecutor(lane)          │
  │          深度门禁 → 熔断门禁(lane)     │
  │          → 虚拟线程硬超时             │
  │          → 指数退避重试(带抖动)       │
  └─ catch BadGatewayException ──────────┴→ fallbackOrThrow
                                               ├─ 规则命中 → 200 + degraded=true
                                               └─ 未命中   → 502（承重墙）
```

选型依据：
- **虚拟线程**而非固定线程池：Java 21 已就绪，堵在 IO 上的调用不占平台线程，超时后线程自灭，无需管理池大小。
- **ThreadLocal 深度计数**而非全局计数：深度是「调用栈」属性，跨线程共享会把并发请求误判成递归。
- **FNV/lane 字符串键**而非枚举：lane 由类名推导，新增专家无需改熔断器。
- **本地规则库独立于前端**：后端不可达时前端也跑不了规则（它拿不到后端数据），所以兜底必须在后端。

红线冲突清零：无新增依赖；Controller 只做参数与响应（`LayerDependencyTest` 通过）；写方法无事务（纯读）。

## 三、影响分析

- **契约变化**：`AiChatVo` 新增可选字段 `degraded`（null 时 json 不出现，旧客户端无感）；`POST /api/v1/ai/chat` 的 502 语义收窄为「规则库也未命中」。两处均已登记 `.harness/wiki/api-contract.md`。
- **前端零改动**：`AIAsk.vue` 已有 sources chip 渲染，兜底时自动显示「本地规则库」标记。
- **承重墙确认**：`teaAI.ts` 降级链未改动；502 仍会在规则未命中时抛给前端。
- **回滚路径**：删除 `com/tea/ai/{resilience,fallback,metrics}`、`AiMetricsController`、`GoldenMetricsReport` 与新测试目录；`git checkout --` 恢复 `AiChatService` / `AiChatVo` / `BaseExpertAgent` / `AiCircuitBreaker` / 5 个专家 / 2 个 yml / 既有测试。无数据库变更，回滚无数据风险。

## 四、自检清单

- [x] 编码规范红线零违反（`audit-redlines.cjs` ERRORS: []）
- [x] 测试全绿：AI + 架构 191 run / 0 fail / 3 Docker-blocked / 1 skipped
- [x] 无用例被削弱：既有 `AiChatServiceTest` 仅补构造参数，断言零改动；旧 `AiCircuitBreakerTest` 一行未动
- [x] 数据库迁移：无（本轮不建表）
- [x] 契约登记：wiki 47/47 端点一致
- [ ] 观测期：**未部署，未观测**
