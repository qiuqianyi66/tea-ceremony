# ab-experiments 变更记录

> 目录：`.harness/changes/ab-experiments/`
> 依据：企业级标准「控制爆炸半径」（双轨流量调度 + 异常指标触发器 + 毫秒级无损回滚）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | ab-experiments：A/B 实验 + 异常指标自动回滚 |
| 需求来源 | 灰度能力缺口（改 AI 路由策略只能全量上线，出问题只能整体回滚容器） |
| 类型 | feat（数据模型 + 后端模块） |
| 涉及范围 | 数据（Flyway V9 单表）/ 代码（`com.tea.ai.experiment` + 一个 Controller）/ 契约（api-contract §2 新段） |

## 二、需求与方案

### 需求描述

1. 按比例把「多级兜底是否启用」「走哪个 agent」这类策略改动灰度到一部分用户。
2. 用错误率 / P99 判据自动停止实验（= 全量回旧路径），不重启容器。
3. 分桶确定性、无状态，不建 assignment 表（避免写放大）。

### 验收标准（Given-When-Then）

- **Given** 实验 `status=running`、`traffic_percent=10`
- **When** 对 10000 个不同 subjectId 调 `assign`
- **Then** treatment 占比落在 8%~12%，且同 subjectId 反复调用结果不变

- **Given** 实验 `status=draft`（或不存在 / 占比 0）
- **When** 调 `assign`
- **Then** 返回 `control`（没配好就走旧路径）

- **Given** control 200 条 errorRate 0.02、treatment 200 条 errorRate 0.10
- **When** 守卫任务评估
- **Then** 命中 `error_rate` 判据 → `stop("auto_rollback: ...")` 并计数

- **Given** 任一组样本 < `minSampleSize`
- **When** 守卫任务评估
- **Then** 不回滚，只更新 `sample_size` / `last_evaluated_at`

- **Given** 实验已 `stopped`
- **When** 再次调 start
- **Then** 409 `CONFLICT`

### 技术方案

- 迁移 V9 单表 `ab_experiments`：`variants` / `guardrail` 用 JSONB（参数演进不加迁移），CHECK 约束兜状态与占比。
- 分桶：`SHA-256(expKey + ":" + subjectId)` 前 8 字节 → `floorMod 100`，桶号 < `trafficPercent` 进 treatment。
- `assign` 按 expKey 缓存 30 秒（`ConcurrentHashMap` + 时间戳），启停即 `evictCache`。
- 指标对比：一条原生 SQL 按 `(plan_layer->>'experiment', plan_layer->>'variant')` 分组算 calls / errorRate / P99（`percentile_cont` 下推库侧）。
- 回滚判据抽成静态纯函数 `ExperimentGuardService.shouldRollback`，`@Scheduled(fixedDelay=300_000, initialDelay=60_000)` 驱动。

## 三、影响分析

- 新增一张表，无既有表变更，无数据回填。
- 新增 4 个需 JWT 的端点；未改 SecurityConfig（`anyRequest().authenticated()` 已覆盖）。
- **trace 写入约定**：`ai_eval_traces.plan_layer` 的 `variant=control|treatment` 必需（TraceRecorder 已写）；`experiment=<exp_key>` 是多实验并行时的归属键，缺失的行只在「唯一 running 实验」时计入，多实验并行时忽略并告警（宁可少算，不算给错误的实验）。
- 自动回滚不删数据、不改流量开关：只改实验状态，`assign` 随即回落 control。
- `assignActive` 返回 `Optional<String>`（empty = 没有可用实验），供调用方区分「没配实验」与「明确走旧路径」；`assign` 是其 `orElse(control)` 形态。

## 四、自检清单

- [x] 迁移成对：`V9__ab_experiments.sql`（up）+ `rollback.sql`（down），`changes/` 内 up 副本与 V9 逐字一致
- [x] 命名合规：`uk_ab_experiments_key` / `ix_ab_experiments_status` / `ck_ab_experiments_*`，全字段 `COMMENT ON`（表 + 15 列）
- [x] `ddl-auto: validate` 不变，schema 只走 Flyway
- [x] 真实 PostgreSQL 17 一次性 schema 验证（建表 / 默认值 / CHECK / 唯一键 / jsonb 读写 / 原生 SQL / rollback / DROP SCHEMA）
- [x] 单测 34 例通过（Experiment*Test 33 + LayerDependencyTest 1）
- [ ] Testcontainers 集成测试（本切片未新增；本机 Docker 未运行）
