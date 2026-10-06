# m1-tea 变更记录

> 目录：`.harness/changes/m1-tea/`，与 git 分支 `feature/m1-tea` 同名。
> 三件套：本文件 + `db-migrations.sql`（V2 up 留档）+ `rollback.sql`（V2 down）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | m1-tea（T7 茶叶目录 + 文化 seeds 迁移，批 B 第二片） |
| 分支 | `feature/m1-tea`（基于 feature/m1-auth） |
| 需求来源 | PRD v2 F2/F3 + PLAN.md T7 细化方案（2026-10-06 确认） |
| 类型 | feat |
| 涉及范围 | 后端（tea 域）+ 迁移（V2 seeds）+ 部署配置（Security 放行） |

## 二、需求与方案

### 需求描述

茶叶目录只读接口（列表筛选分页 + 详情）+ 文化数据 seeds 迁移（src/data → Flyway V2，7 表 157 条）。

### 验收标准（Given-When-Then）

- **F7-1** Given 库中已灌 seeds，When `GET /api/v1/teas?category=绿茶&page=1&size=20`，Then 200 + 分页结构（items/total/page/size），仅含绿茶，按 id 排序
- **F7-1b** Given size=101，When 同上，Then 400 PARAM_INVALID
- **F7-2** Given id 存在，When `GET /api/v1/teas/{id}`，Then 200 + 全字段（flavor JSONB/故事/汤色）
- **F7-2b** Given id 不存在，Then 404 NOT_FOUND 统一格式
- **F7-3** V2 往返：upgrade 7 表计数 = src/data 条数（157）；downgrade 清零；re-upgrade 恢复

### 技术方案

- **V2 seeds**：`scripts/seed-extract.mjs`（Node 标准库，正则+平衡括号提取 TS 数组 → 字段映射 → 生成 SQL）可复现；禁手写长 INSERT
- 数据源：src/data（teas 66 / regions 19 / processes 6 / people 21 / poems 25 / wares 6 / etiquettes 14）；tea_relations 无数据源留空（不编造）
- 映射决策：region_id/process_id 留 NULL（旧库 seeds 亦无关联）；related_tea_ids 存 src/data slug 数组；tea_regions.name=province
- tea 域四件套：Tea entity（TEXT columnDefinition + flavor JSONB）/TeaRepository（JpaSpecificationExecutor）/TeaService（筛选 + 分页校验）/TeaController（/api/v1/teas）
- 通用分页：`common/response/PageResult<T>(items,total,page,size)`（page 1-based）
- Security：`GET /api/v1/teas/**` permitAll（PRD F2/F3 游客浏览）
- 异常补充：MethodArgumentTypeMismatchException → 400 PARAM_INVALID（防非数字参数落 500）

## 三、影响分析

| 维度 | 影响 |
|---|---|
| 数据模型 | V2 数据迁移（7 表 157 条种子，无 schema 变更；up/down 成对） |
| API | 新增 GET /api/v1/teas + /{id}（已同步 .harness/wiki/api-contract.md） |
| 前端 | 无改动（联调切片切换） |
| 承重墙 | 无影响（只读目录；幂等/评分/AI 降级链不触碰） |
| 回滚 | 迁移：rollback.sql + 清 history V2；代码：git checkout 前一 commit |

## 四、质量门禁（自检）

- [x] 编码规范红线 15 条零违反（分层单向 / 统一 ApiResponse / 只读事务 / Flyway 迁移成对）
- [x] 编译 0 error（mvn -q compile）
- [x] 测试全绿 49/49（旧 31 + TeaServiceTest 6 + TeaControllerTest 5 + TeaIntegrationTest 7）
- [x] 迁移 upgrade/downgrade 往返实测通过（全新部署 + down 清零 + re-up 恢复）
- [x] expert-reviewer 评审通过：🔴 0 / 🟡 0（见 review.md）
- [x] 自检清单逐项完成

## 五、部署与观测

- [x] staging 冒烟通过（集成测试真实 HTTP + 真实库；容器 5433 库已应用 V1+V2 验证）
- [ ] 部署记录（随 M1 整体部署）
- [ ] 30 分钟观测期（随 M1 部署后执行）
