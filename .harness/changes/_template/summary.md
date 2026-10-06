# {feat-name} 变更记录

> 目录：`.harness/changes/{feat-name}/`，与 git 分支 `feature/{feat-name}` 同名。
> 每个功能变更必须含三件套：本文件 + `db-migrations.sql`（有迁移时）+ `rollback.sql`（有迁移时）。
> 无数据库变更的纯前端/纯逻辑改动可省略后两个，但本文件不可省略。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | {feat-name} |
| 分支 | `feature/{feat-name}` |
| 需求来源 | PRD 章节 / issue / request-analysis 编号 |
| 类型 | feat / fix / refactor / test / docs / chore |
| 预计工作量 | ≤ 4h（超出需拆分） |
| 涉及范围 | 前端 / 后端 / 数据库 / 部署 |

## 二、需求与方案（阶段 1-2）

### 需求描述

{一句话说明要解决什么业务问题}

### 验收标准（Given-When-Then）

- **Given** {前置条件}
- **When** {操作}
- **Then** {预期结果}

### 技术方案

{选型与理由；红线冲突清零声明}

## 三、影响分析

| 维度 | 影响 |
|---|---|
| 数据模型 | 新增/修改表：{表名}（见 db-migrations.sql） |
| API | 新增/修改端点：{路径}（同步更新 .harness/wiki/api-contract.md） |
| 前端 | 涉及页面/组件：{路径} |
| 承重墙 | AI 降级链 / 幂等 / 评分模型是否受影响：{是/否 + 说明} |
| 回滚 | 迁移回滚脚本：rollback.sql；代码回退：git checkout {commit} |

## 四、质量门禁（阶段 4-6 自检）

- [ ] 编码规范红线 15 条零违反（对照 .harness/rules/编码规范.md）
- [ ] 编译 0 error（前后端）
- [ ] 单元测试覆盖（新增逻辑）覆盖率 ≥ 80%
- [ ] 迁移 upgrade/downgrade 往返测试通过（如有）
- [ ] expert-reviewer 评审通过无 🔴、🟡 清零
- [ ] 自检清单（编码规范 §六）逐项勾完

## 五、部署与观测（阶段 8-10）

- [ ] staging 冒烟通过
- [ ] 部署记录（版本标签 / 时间）
- [ ] 30 分钟观测期无异常
