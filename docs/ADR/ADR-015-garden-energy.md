---
last_updated: 2026-10-09
status: active
owner: yanha
---

# ADR-015：茶园能量事件账本（append-only + 收集聚合）

- **Status**: Accepted
- **Date**: 2026-10-09
- **Supersedes**: 无（新增决策）

## Context

茶园 S1 需要"品鉴产能量 → 收集 → 阶段推进"闭环。存储设计有三个问题：

1. **审计与防通胀**：直接改 `garden_plants.energy` 列，无审计、防通胀靠代码自觉，出错无法追溯。
2. **幂等产能量**：品鉴落库自动产能量必须幂等——同一品鉴记录重复提交（客户端重试/并发）不能重复产能量。
3. **阶段推进可配置**：阶段阈值需要可调（重启生效即可），且"只升不降"。

## Decision

**事件账本（append-only）+ 收集时聚合**：

1. **账本**：`garden_energy_events` 每条品鉴记录 = 一条能量事件（`amount = 5 + floor(len(notes)/100) * 10`，`source=tasting`）。append-only 不 UPDATE 金额；收集状态用 `collected_at` 标记（NULL=未收）。
2. **幂等**：事件唯一键 `uk(user_id, client_id)`，`client_id` 复用品鉴记录 `client_id`；品鉴幂等返回已有时（findByUserIdAndClientId 查重 + DataIntegrityViolation 兜底）不写第二条事件。
3. **阶段推进 = 事件聚合**：收集时把该用户未收事件金额累加到 `plants.energy`，按 `application.yml` 阈值（planted 0 / growing 100 / blooming 300 / harvested 600）升级 `status`，只升不降，不直接改事件。
4. **配置化**：能量规则与阶段阈值放 `application.yml`（S1 不建配置表，S2/S3 再上）。
5. **触发点**：`TastingRecordService.create` 落库成功后同事务调用 `GardenEnergyService.recordTasting(userId, clientId, notes)`（Service 层横向调用，Controller→Service→Repository 单向链不受影响，ArchUnit 分层测试确认）。

## Consequences

- 新表 + `garden_plants` 扩展列（Flyway V4），up/down 成对（`.harness/changes/garden-s1/`）。
- 品鉴落库链路加同事务记账：能量记账失败整体回滚，不污染品鉴记录。
- 收集 = 单事务原子：置 `collected_at` + 累加 `energy` + 推进 `status`。
- 无植物时能量先挂账（事件已记），收集后仍可推进阶段。
- 契约新增 `/api/v1/garden-plants`（幂等 upsert）+ `/api/v1/garden-energy`（摘要/收集）。

## Rejected

- **直接改 `plants.energy` 列**：无审计、难防通胀 → 否。
- **拆 tasting/brew 双事件**：幂等键唯一约束下同品鉴拆两条会冲突 → 合并单事件（最小实现）。
- **能量配置表 / JSONB 配置**：S1 过重 → S2/S3 起。
