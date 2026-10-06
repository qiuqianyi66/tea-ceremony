---
name: db-migration
description: 数据库迁移——Flyway 迁移 + changes 成对追踪 + upgrade/downgrade 往返测试，禁 ddl-auto。业务专项 09（必用）。
---

# DB Migration

## 触发
- 任何 Schema 变更（建表/加列/索引/数据迁移）；M0 起必用。

## 工作流
1. 改模型 → 写迁移脚本（`changes/{feat}/db-migrations.sql` up + `rollback.sql` down 成对）。
2. 命名规范：表 snake_case、索引 `ix_{table}_{col}`、唯一 `uk_`、外键 `fk_`。
3. 真实 Postgres 验证 → upgrade → 往返测试（upgrade/downgrade）。
4. 数据迁移写逻辑（不只改表结构）；大表变更评估锁表窗口。
5. 禁手改已应用迁移（追加新迁移）。

## 红线
- 迁移走 Flyway 禁 ddl-auto（#7）；迁移必须成对可回滚（#7）。

## 自检
- [ ] up/down 成对，往返测试通过
- [ ] 命名规范（ix_/uk_/fk_）
- [ ] 未改历史迁移
- [ ] 数据迁移有逻辑
