---
last_updated: 2026-10-06
status: active
owner: yanha
---

# db-migration — 人读审查页

> 面向人的审查页。模型执行规则见 `.agents/skills/db-migration/SKILL.md`。

## 它管什么

**过渡期旧 FastAPI 后端**（SQLAlchemy 2.0 + Alembic）的数据库迁移规范：改表结构、加字段、数据迁移必须走迁移流程。

**定义性约束**：改库必须迁移，迁移必须成对（upgrade / downgrade），数据迁移要写迁移逻辑——禁止直接手动 DDL。

## 何时该用 / 何时不该用

**该用**：修改数据库表结构、新增字段、执行数据迁移（旧后端栈）。

**不该用**：新 Spring Boot 栈的库改动——那是另一条轨，走 `.harness/skills/biz-dev/09-db-migration`（Flyway），**不要混用**（AGENTS.md §8：新栈优先）。

## 审查要点（人过一遍时核对）

- [ ] 无直接手动 DDL（`alembic` 之外的建表/改表操作）
- [ ] 改模型后生成了迁移脚本，且**人工审核过** autogenerate（误删、字段类型、默认值、约束）
- [ ] upgrade / downgrade 成对存在，downgrade 写了反向逻辑
- [ ] 数据迁移写了迁移逻辑（不只是 schema 变更），如旧字段 → 新字段的数据搬运
- [ ] 在真实 Postgres 上跑过 `alembic upgrade head`，且往返（downgrade → upgrade）验证过
- [ ] 涉及的表结构变更同步更新了 `DATABASE_ER.md`
- [ ] 新栈（Spring Boot）库改动没有误用本技能

## 怎么知道它在生效

- 每次 schema 变更都有对应的迁移文件，且能 `alembic downgrade -1` 回滚
- 迁移后后端启动无数据库报错，数据正确

## 对应文件

- `.agents/skills/db-migration/SKILL.md`
- 新栈替代：`.harness/skills/biz-dev/09-db-migration/SKILL.md`（Flyway，后端重写后启用）
