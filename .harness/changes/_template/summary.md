# {feat-name} 变更记录

> 目录：`.harness/changes/{feat-name}/`，与 git 分支 `feature/{feat-name}` 同名。
> 本文件是模板：花括号 `{...}` 处按实际替换后使用。
> **无数据库迁移时删除 db-migrations.sql / rollback.sql**，并在本文件顶部注明原因（参考 m1-ai 惯例）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | {feat-name}（{一句话描述}） |
| 分支 | `feature/{feat-name}`（基于 main {base-sha}） |
| 需求来源 | `docs/prd/{需求文档}`（F{编号}，D{编号}） |
| 类型 | feat / fix / refactor / test / docs / chore |
| 涉及范围 | {前端 / 后端 / 部署 / 数据}（列出改动面） |

## 二、需求与方案

### 需求描述

1. {需求点 1}
2. {需求点 2}

### 验收标准（Given-When-Then）

- **Given** {前置条件}
- **When** {触发动作}
- **Then** {可观察结果}

### 技术方案

{方案要点 + 选型依据 + 红线冲突清零说明}

## 三、影响分析

- {影响面 / 兼容性 / 回滚路径}
- {契约变化：wiki/api-contract.md 是否同步更新}
- {承重墙确认：降级链 / 3D 状态机 / 同步逻辑是否触及}

## 四、自检清单

- [ ] 十阶段 Gate 逐项满足（小改动合并场景：summary + 红线 + 冒烟不可省略）
- [ ] 编码规范红线 15 条零违反；自检清单 26 项通过
- [ ] review 通过无 🔴、🟡 清零（评审记录落盘 review.md）
- [ ] 测试全绿（按改动面跑 npm run quality / pytest / mvn test）
- [ ] 数据库迁移成对（upgrade/downgrade 往返通过）——如无迁移，删除两文件并在顶部注明
- [ ] 观测期通过（部署后 30 分钟无异常）
