# m1-record 变更记录

> 目录：`.harness/changes/m1-record/`，与 git 分支 `feature/m1-record` 同名。
> 三件套：本文件 + `db-migrations.sql`（无变更声明）+ `rollback.sql`（无变更声明）——**T8 零迁移**（V1 表/索引/约束已就位）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | m1-record（T8 品鉴记录域迁移，批 B 第三片） |
| 分支 | `feature/m1-record`（基于 feature/m1-tea） |
| 需求来源 | `docs/prd/m1-record-requirements.md`（2026-10-06 用户确认）+ PLAN.md T8 细化方案 |
| 类型 | feat |
| 涉及范围 | 后端 record 域 + ware 最小映射 + wiki 文档同步 |

## 二、需求与方案

### 需求描述

品鉴记录四端点迁移到 Spring Boot：提交（client_id 幂等）、列表（倒序分页）、详情、删除——全部需登录；评分由前端计算透明存储（可解释性承重墙）。

### 验收标准（Given-When-Then）

- **F8-1** Given 登录首次 POST（含 client_id），Then 200 创建；Given 同 client_id 再 POST，Then 200 返回同一条（total 不变）
- **F8-1b** Given 无 client_id，Then 400 PARAM_INVALID；Given 无 token，Then 401
- **F8-1c** Given 不同用户同 client_id，Then 各自独立记录
- **F8-2** Given N 条记录 GET 列表，Then created_at 倒序 + 分页结构 + 仅本人
- **F8-3** Given 本人记录 GET 详情，Then 200 全字段；Given 他人记录/不存在，Then 404（不泄露存在性）
- **F8-4** Given 本人记录 DELETE，Then 200 + 行消失；Given 他人/不存在，Then 404

### 技术方案

- 幂等（ADR-001）：`findByUserIdAndClientId` 查重 → 返回已有；并发唯一索引冲突（DataIntegrityViolationException）兜底 → 再查转幂等返回
- 评分（ADR-002）：dimensions/overall_score/process_factor 前端计算（scoring.ts），后端透明存储不重算
- 归属：详情/删除 `findByIdAndUserId`，无 → 404（不泄露存在性）
- 分页：page/size 统一（D8-1，与 T7 PageResult 一致）；tea_id/ware_id 非空校验存在（D8-2，400）
- 命名：`TastingRecord`（规避 java.lang.Record 冲突）；TeaWare 最小映射（仅 existsById 校验用）
- 鉴权：SecurityConfig `anyRequest().authenticated()` 已覆盖，零配置改动

## 三、影响分析

| 维度 | 影响 |
|---|---|
| 数据模型 | **零迁移**（V1 tasting_records + uk_tasting_records_user_client 已就位） |
| 承重墙 | 幂等语义保留（查重 + 唯一索引兜底 + 回归测试）；评分模型后端不触碰（透明存储） |
| API | 新增 /api/v1/records 四端点（api-contract.md 已同步，含 client_id 字段） |
| 前端 | 无改动；契约差异记录：前端 client_id 可选（游客本地记录）vs 后端必填（V1 NOT NULL）、dimensions 可选 vs 后端可空存 '{}'——联调切片处理 |
| 文档 | data-model.md 评分口径校正（八维 1-5、工艺系数 ≤1.0，消除漂移） |
| 回滚 | git checkout 前一 commit（无迁移负担） |

## 四、质量门禁（自检）

- [x] 编码规范红线零违反（分层 / ApiResponse / 事务 / 参数绑定）
- [x] 编译 0 error（mvn -q compile）
- [x] 测试全绿 74/74（旧 49 + ServiceTest 11 + ControllerTest 6 + IntegrationTest 8）
- [x] 承重墙回归：幂等（同 client 两次 → 同 id 一条）、越权（跨用户 404）、倒序、tea_id 校验（集成实测）
- [x] expert-reviewer 评审通过：🔴 0 / 🟡 0（见 review.md）
- [x] api-contract.md / data-model.md 同步完成

## 五、部署与观测

- [x] staging 冒烟通过（集成测试真实 HTTP + 真实库）
- [ ] 部署记录（随 M1 整体部署）
- [ ] 30 分钟观测期（随 M1 部署后执行）
