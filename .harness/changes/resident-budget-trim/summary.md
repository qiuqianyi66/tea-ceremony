# resident-budget-trim 变更记录

> 目录：`.harness/changes/resident-budget-trim/`。
> **无数据库迁移**（只改 AGENTS.md 常驻文字），故无 `db-migrations.sql` / `rollback.sql`。
> ADR：不适用（L0 文档改动）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | resident-budget-trim（命令清单下沉到 scripts/README） |
| 分支 | 无（L0 文档改动） |
| 需求来源 | 计划 F1：常驻层 19304/19500，无下一轮编辑余量 |
| 类型 | docs |
| 涉及范围 | `AGENTS.md` §11 命令入口 |
| 调用技能 | 无 |

## 二、方案

- 现状（实测 2026-11-24）：常驻合计 19304 token；AGENTS 6849/7000。
- 改动：删除 §11 中已登记在 `scripts/README.md` 的 13 条脚本命令，保留 4 条核心入口 + 一行指向 `scripts/README.md`。语义未变，命令未改。
- 不做：不新增规则、不改变任何门禁。

## 三、影响分析

- 常驻层：18919/19500（−385 token）；AGENTS 232 行。
- 回滚：`git checkout -- AGENTS.md`。

## 四、自检

- [x] `audit-context-budget.cjs`：`ERRORS: []`，合计 18919
- [x] `verify-harness.cjs`：`ERRORS: []`
- [x] 无数据库迁移；ADR 不适用
