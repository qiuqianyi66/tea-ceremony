# telemetry-stability 变更记录

> 目录：`.harness/changes/telemetry-stability/`
> 依据：ADR-022（匿名遥测上报）+ `docs/reference/telemetry-contract.md`（契约唯一真源）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | telemetry-stability：遥测接收与 SLO 评估后端模块 |
| 需求来源 | ADR-022 + `docs/reference/telemetry-contract.md` §1-§10 |
| 类型 | feat（数据模型 + 后端模块） |
| 涉及范围 | 数据（Flyway V8 三表）/ 代码（`com.tea.telemetry`）/ 配置（限流与 SLO 目标）/ 安全（匿名可写端点） |

## 二、需求与方案

### 需求描述

1. 匿名遥测上报通道：`POST /api/v1/telemetry/batch`，`≤50` 条/请求，逐条校验，单条非法不中断整批。
2. 错误指纹归并 + Human-in-the-Loop 审批（pending → acknowledged/ignored → resolved）。
3. SLO 评估：五指标 P75 对目标，算达成系数与健康分；15 分钟窗口快照；raw 事件 7 天保留。

### 验收标准（Given-When-Then）

- **Given** 同一 `clientEventId` 重复上报
- **When** 第二次调用批量端点
- **Then** 响应 `duplicated=1`，`telemetry_events` 不新增行

- **Given** 一批 3 条中含 1 条 `type` 非法
- **When** 调用批量端点
- **Then** 响应 200，`accepted=2`、`rejected=1`，不整体 400

- **Given** error 事件与已有指纹相同
- **When** 再次入库
- **Then** `occurrences` +1、`last_seen_at` 更新，`review_status` 保持首次插入的 `pending`

- **Given** 窗口内 LCP 无样本
- **When** GET `/api/v1/telemetry/slo`
- **Then** 该指标 `p75=null`、`sampleCount=0`、响应标 `insufficientData=true`

### 技术方案

- 迁移 V8 三表：`telemetry_events` / `error_fingerprints` / `slo_snapshots`（字段与契约 §9/§10 对齐）。
- 幂等走 `uk_telemetry_events_client_event` + `INSERT ... ON CONFLICT DO NOTHING`（契约 §9 指定）。
- 指纹 upsert 走 `uk_error_fingerprints_fp` + `ON CONFLICT DO UPDATE`（occurrences +1）。
- P75 用 `percentile_cont(0.75) within group (order by metric_value)`，分位计算下推 DB。
- SLO 目标/权重/保留天数/单请求上限全部进 `TelemetryProperties`（`telemetry.*`），禁硬编码。

## 三、影响分析

- 新增三张表，无既有表变更，无数据回填。
- 新增匿名可写端点：已挂体积上限（50 条/请求）+ 限流（匿名 30 次/分钟）。
- 契约无变化（契约文件为先有真源，本切片按契约实现）。

## 四、自检清单

- [x] ADR-022 已覆盖本表结构（无新增 ADR）
- [x] 迁移成对：`V8__telemetry.sql`（up）+ `rollback.sql`（down）
- [x] 命名合规：`uk_` / `ix_`，全字段 `COMMENT ON`
- [x] `ddl-auto: validate` 不变，schema 只走 Flyway
- [x] 单条非法不中断整批（`rejected` 计数），单请求 >50 条整体 400
- [ ] 真实 Postgres 往返验证（由主控执行；本切片只做静态 SQL 自检 + Testcontainers 集成测试）
