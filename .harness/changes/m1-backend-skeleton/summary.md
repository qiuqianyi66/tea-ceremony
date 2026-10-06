# m1-backend-skeleton 变更记录

> 目录：`.harness/changes/m1-backend-skeleton/`，与 git 分支 `feature/m1-backend-skeleton` 同名。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | m1-backend-skeleton |
| 分支 | `feature/m1-backend-skeleton` |
| 需求来源 | HANDOFF-2026-10-05 §8 / PRD v0.2（ADR-010/011，10 项决策全定案） |
| 类型 | feat |
| 预计工作量 | 5 个 Task，各 ≤4h |
| 涉及范围 | 后端 / 数据库 |

## 二、需求与方案（阶段 1-2）

### 需求描述

M1 第一批：Spring Boot 3.5 后端工程地基——Maven 工程初始化（与旧 FastAPI 并存）、Flyway V1 初始迁移（13 张表 + 索引）、基础骨架（统一响应/异常体系/健康端点）、容器 Postgres 往返测试与冒烟。认证、领域切片在批 B（下一轮），不在本批。

### 验收标准（Given-When-Then）

- **F1 Maven 工程**：Given 本地 JDK21 + Maven；When 在 `backend/` 执行 `mvn -q compile`；Then 编译 0 error，`backend/src/main/java/com/tea/TeaApplication.java` 与 `pom.xml` 存在，旧 FastAPI 文件（`backend/app`）未被改动。
- **F2 Flyway V1 迁移**：Given 容器内 PostgreSQL 16 可连；When 应用启动执行迁移；Then 13 张表（users/teas/tea_regions/tea_processes/tea_people/tea_poems/teawares/tea_etiquettes/tea_relations/tasting_records/garden_plants/agent_prompts/ai_usage_logs）全部创建，索引/唯一约束按 wiki 命名规则存在；执行 rollback 后表全部消失；upgrade→downgrade→upgrade 往返通过。
- **F3 基础骨架**：Given 请求一个不存在的资源路径；When 后端返回；Then 响应体为 `ApiResponse<T>` 统一格式（code/message/data），`@RestControllerAdvice` 捕获异常；访问健康端点返回 200。
- **F4 冒烟验证**：Given 服务已启动并连容器 Postgres；When 请求健康端点与一个异常路径；Then 健康 200、异常响应格式统一，`mvn -q test` 单测全绿。

### 技术方案

- 目录结构唯一依据：`.harness/rules/工程结构.md` §四（`backend/` = Maven 工程，`src/main/java/com/tea/`，旧 `backend/app` 过渡期不动）。
- 字段来源：`.harness/wiki/data-model.md` 表清单（用户确认全量 13 张）+ 旧 FastAPI 模型（`backend/app/models/`，用户确认补全字段类型）+ PRD §7.2（agent_prompts/ai_usage_logs）。garden_plants 无任何来源明细，按最小合理集建空表并注释待茶园切片确认。
- 依赖：Spring Boot 3.5.x parent、web/JPA/Security/Validation/Flyway/PostgreSQL、Spring AI Alibaba 1.1.2.0（锁版本，本批仅引入不实现）、test。
- 迁移：Flyway `V1__init.sql` 为真身，`changes/` 三件套留档（规范 §8）；upgrade/downgrade 成对；禁 `ddl-auto: update`。
- 执行期决策（用户拍板 2026-10-05）：`tasting_records.client_id` 由旧模型 nullable 改为 **NOT NULL**（幂等键核心，红线 #5 落地；`user_id` 保持可空支持匿名记录），V1 真身与留档已同步。
- 红线冲突清零声明：#7 迁移成对 + 往返、禁手改历史迁移、索引命名规则，全部遵守。

## 三、影响分析

| 维度 | 影响 |
|---|---|
| 数据模型 | 新增 13 张表（见 db-migrations.sql）：users / teas / tea_regions / tea_processes / tea_people / tea_poems / teawares / tea_etiquettes / tea_relations / tasting_records / garden_plants / agent_prompts / ai_usage_logs |
| API | 新增健康端点（`/api/health` 或 `/actuator/health`）；统一响应/异常骨架（同步更新 .harness/wiki/api-contract.md 于批 B 认证接入时） |
| 前端 | 无 |
| 承重墙 | 否。AI 降级链 / 幂等 / 评分模型不受影响；tasting_records 表结构保持与旧栈兼容（表名按 wiki 无 `_v2` 后缀） |
| 回滚 | 迁移回滚：rollback.sql（Flyway downgrade）；代码回退：`git checkout main`（分支未合并前零风险） |

## 四、质量门禁（阶段 4-6 自检）

- [ ] 编码规范红线 15 条零违反（对照 .harness/rules/编码规范.md）
- [ ] 编译 0 error（`mvn -q compile`）
- [ ] 单元测试覆盖（新增逻辑）覆盖率 ≥ 80%
- [ ] 迁移 upgrade/downgrade 往返测试通过（容器 Postgres）
- [ ] expert-reviewer 评审通过无 🔴、🟡 清零
- [ ] 自检清单（编码规范 §六）逐项勾完

## 五、部署与观测（阶段 8-10）

- [ ] staging 冒烟通过（健康端点 + 异常路径）
- [ ] 部署记录（版本标签 / 时间）
- [ ] 30 分钟观测期无异常
