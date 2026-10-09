# garden-s1 变更记录

> 目录：`.harness/changes/garden-s1/`（worktree tea-garden-s1，feature/garden-s1）。
> 依据：ADR-015（能量事件账本）+ garden-product-prd（F-G1/G2/G3/G6）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | garden-s1：能量事件账本 + garden_plants 扩展（数据库部分） |
| 需求来源 | `docs/prd/garden-product-prd.md`（F-G1/2/3/6）+ ADR-015 |
| 类型 | feat（数据库迁移）+ docs |
| 涉及范围 | 数据（Flyway V4）/ 代码（后端 garden 域 + 前端 GardenView，随切片实现） |

## 二、需求与方案

### 需求描述

1. `garden_energy_events` 账本（append-only + collected_at 标记，防通胀可审计，幂等 uk user_id+client_id）。
2. `garden_plants` 扩展 `energy` 列；`status` 语义化 planted/growing/blooming/harvested（存量 'pending' 归并 'planted'）。

### 验收标准（Given-When-Then）

- **Given** 本地 pg 重建
- **When** backend 启动执行 Flyway
- **Then** V1-V4 全部 applied；`garden_energy_events` 存在且含 uk/fk；`garden_plants.energy` 列存在；存量 status 归并正确

- **Given** 往返测试临时库
- **When** 依次执行 V4（up）→ rollback（down）→ V4（up）
- **Then** down 后账本表/energy 列消失且无依赖报错；up 后恢复原状

### 技术方案

- 版本号 V4（V1-V3 已占用，V2 为文化种子、V3 为 agent memory）。
- 幂等键 uk(user_id, client_id) 复用品鉴记录 client_id；阶段推进 = 事件聚合，只升不降。
- 能量规则/阶段阈值放 application.yml（S1 不建配置表）。

## 三、影响分析

- 纯新增，无破坏性变更；品鉴落库链路加同事务记账（随后端 garden 域实现，失败回滚不污染品鉴记录）。
- 契约新增 `/api/v1/garden-plants` + `/api/v1/garden-energy`（api-contract.md 同步，移除"⚠ 未实现"标注）。
- 承重墙确认：品鉴幂等、teaAI 降级链、3D 视觉均不改动逻辑，仅新增调用。

## 四、自检清单

- [x] ADR-015 已登记（docs/ADR/）
- [x] 迁移成对：`V4__garden_energy.sql`（up）+ rollback.sql（down）
- [x] up 验证：Docker 临时 PG（5433）V1-V4 全 up，pending→planted 归并 + energy 列 + 账本表核验
- [x] down 验证：往返测试（up→down→up）通过，down 后账本表/energy 列消失、status 回滚
- [x] Testcontainers 集成测试覆盖 V4 up（后端全量 mvn test 通过，含 V4 up 无冲突、ddl-auto validate）
- [x] 无红线冲突（ddl-auto: validate / 命名 / 注释）
