# m1-record 品鉴记录 — 需求分析（PRD 级）

> 阶段 1 产出（开发流程规范：需求分析先行，用户确认后才进方案设计）。
> 事实来源：`.harness/wiki/{data-model,business-model,api-contract}.md`、`V1__init.sql`（tasting_records 建表）、旧后端 `backend/app/{routers/records.py,services/record_service.py}`、前端 `src/services/scoring.ts`。均已读原文核实，无编造。
> 日期：2026-10-06。状态：**待用户确认**。

## 1. 背景与目标

批 B 第三片（T8）：把品鉴记录域从旧 FastAPI 迁移到 Spring Boot。品鉴记录是业务闭环"品鉴记录 → 个人成长"的落点，承载两块承重墙：

- **幂等创建**（ADR-001 离线优先）：前端写 IndexedDB（`sync_status=pending`）乐观展示，网络恢复后批量同步 → 同一条记录重放不产生重复
- **评分可解释性**（ADR-002）：`overall_score = 八维口感评分 × 工艺系数`，计算在前端完成（`src/services/scoring.ts`），后端只存储、不重算

目标：4 个只读/写端点按旧语义 + 新契约（`/api/v1`、`ApiResponse<T>`）迁移，表结构零变更（V1 已建好 `tasting_records` + 幂等唯一索引）。

## 2. 范围与边界

| 方向 | 内容 |
|---|---|
| 做（F8-1~4） | 品鉴记录提交（client_id 幂等）、我的记录列表、记录详情、记录删除——全部需登录 |
| 不做 | 评分计算与校验（前端算好透传，后端不重算，可解释性在前端承重）；IndexedDB 离线同步（前端切片）；记录分享/统计报表（PRD 无）；软删除（V1 无 is_deleted 列，旧实现物理删除）；茶园种植（属独立切片） |

## 3. 现状事实（已核实）

### 3.1 表结构（V1__init.sql 已建，T8 零迁移）

`tasting_records`：`id / user_id(FK users) / client_id VARCHAR(64) NOT NULL / tea_id(FK teas, 可空) / tea_name VARCHAR(100) NOT NULL / brew_temp INT / brew_time INT / infusions INT NOT NULL DEFAULT 1 / water_type VARCHAR(20) / ware_id(FK teawares, 可空) / dimensions JSONB NOT NULL DEFAULT '{}' / overall_score DOUBLE PRECISION / process_factor DOUBLE PRECISION / aroma_type VARCHAR(50) / notes TEXT / weather VARCHAR(50) / mood VARCHAR(50) / created_at / updated_at`

约束：`uk_tasting_records_user_client (user_id, client_id)` 唯一；`ix_tasting_records_user_id` / `ix_tasting_records_tea_id`；FK user/tea/ware 均已建。

### 3.2 旧后端语义（迁移基线）

| 端点 | 行为 |
|---|---|
| POST `/api/records` | 登录；`client_id` 非空 → 查同 `user_id + client_id`，已有则直接返回（幂等）；否则创建（字段透传 + 服务端设 user_id） |
| GET `/api/records` | 登录；`skip` 默认 0、`limit` 默认 50、clamp 1-100；按 `created_at DESC` |
| GET `/api/records/{id}` | 登录；按 `id + user_id` 归属校验；无 → 404 "记录不存在" |
| DELETE `/api/records/{id}` | 登录；归属校验；物理删除；返回 `{message:"已删除"}` |

### 3.3 前端评分口径（`src/services/scoring.ts` + `types/tasting`）

- `TasteDimensions` 八维：`bitterness / sweetness / aftertaste / body / aroma / rhyme / shape / mind`，各 **1-5**（bitterness 为反向维度）
- `overall_score`：八维归一化 × `processFactor`，范围 **1-10**、保留一位小数
- `process_factor`：前端按 温度偏差/时间偏差/茶器加成/水源 计算，**实际 ≤ 1.0**
- **后端职责 = 透明存储**（dimensions/overall_score/process_factor 原样入库）

### 3.4 Wiki 漂移发现（记录待校正，不属 T8 代码）

- `data-model.md` 写"八维评分各 0-100"——实际前端为 1-5
- `data-model.md` 写"工艺系数 0.8-1.2 越界异常"——实际前端计算 ≤ 1.0

→ 方案阶段一并校正 wiki 描述（数据模型文档一致性），T8 代码不据此校验。

## 4. 功能需求（Given-When-Then）

### F8-1 提交品鉴记录（幂等创建）

- Given 登录用户提交 `POST /api/v1/records`（含 `client_id`、tea_id?/tea_name、brew_temp/brew_time/infusions、dimensions/overall_score/process_factor、water_type/ware_id?/aroma_type/notes/weather/mood），When 首次提交，Then 200 + 记录完整返回（含服务端 id）
- Given 同用户已存在同 `client_id` 记录，When 再次提交相同 `client_id`，Then 返回**同一条已有记录**（200，不产生新行）
- Given 未携带 `client_id`，When 提交，Then 400 PARAM_INVALID（V1 表 NOT NULL，幂等承重墙必填）
- Given 未登录（无 token），When 提交，Then 401 UNAUTHORIZED 统一格式
- Given 不同用户提交相同 `client_id`，When 各自提交，Then 各得一条独立记录（幂等键含 user_id）

### F8-2 我的记录列表

- Given 登录用户有 N 条记录，When `GET /api/v1/records`，Then 200 + 记录列表**按 created_at 倒序**（最新在前），仅含本人记录
- Given 未登录，Then 401
- Given 请求分页参数，Then 响应含分页结构（分页风格见 D8-1，待方案拍板）

### F8-3 记录详情

- Given 记录属于当前用户，When `GET /api/v1/records/{id}`，Then 200 + 全字段（dimensions JSONB / overall_score / process_factor / notes 等）
- Given 记录不存在**或属于他人**，When 同上，Then 404 NOT_FOUND 统一格式（不泄露存在性）

### F8-4 删除记录

- Given 记录属于当前用户，When `DELETE /api/v1/records/{id}`，Then 200 + `{message:"已删除"}`，库中行消失
- Given 记录不存在或属于他人，Then 404 NOT_FOUND
- Given 未登录，Then 401

## 5. 非功能约束

| 维度 | 约束 |
|---|---|
| 鉴权 | 四个端点全部需登录（JWT，Security 配置同 auth 域） |
| 幂等并发 | 同 client_id 并发提交：唯一索引兜底（DB 23505 冲突需捕获处理，方案阶段定策略：转幂等返回 or 409） |
| 越权 | 归属一律按 `user_id` 过滤；跨用户访问返回 404 而非 403（不泄露资源存在性） |
| 性能 | 个人记录量级（百~千级/人），无分页深度压力；列表按已有 `ix_tasting_records_user_id` 索引 |
| 数据校验 | 入参基础校验（非空/类型/长度）；`tea_id`/`ware_id` 存在性校验策略见 D8-2 |
| 可解释性 | 后端不重算评分、不改写 dimensions/process_factor（前端承重，ADR-002） |

## 6. 影响分析

| 维度 | 影响 |
|---|---|
| 承重墙 | **幂等**：新实现必须保留"同 user+client 返回已有"语义（唯一索引 + 查重），改动必须带回归测试；**评分模型**：后端纯存储不触碰计算逻辑 |
| 数据模型 | **零迁移**（V1 表/索引/约束已就位）；无 schema 变更 |
| API | 新增 `/api/v1/records` 四端点 → api-contract.md 同步（旧 `/api/records` 保留过渡） |
| 前端 | 无改动（联调切片切换） |
| 文档 | data-model.md 评分口径漂移校正（方案阶段一并） |
| 回滚 | 代码回退上一 commit；无迁移回滚负担 |

## 7. 开放决策点（方案阶段给推荐并确认）

- **D8-1 列表分页风格**：对齐 T7 的 `page/size`（PageResult 统一，前端联调切片一起切） vs 兼容旧 `skip/limit`（过渡期前端无感）
- **D8-2 `tea_id`/`ware_id` 存在性校验**：非空时 Service 校验存在（未知 → 400，健壮性） vs 完全透传（旧实现行为，FK 违反落 500）

## 8. 验收清单（阶段 1 自检）

- [x] 每个功能 F8-1~4 有编号 + Given-When-Then
- [x] 承重墙影响已声明（幂等/评分）
- [x] 范围边界明确（不做评分计算/不做前端/不做迁移）
- [x] 影响分析完整（数据/API/前端/文档/回滚）
- [x] 澄清规则命中项已核对事实（评分口径以代码为准，wiki 漂移已标注）
- [x] 决策点已列出（D8-1/2，方案阶段确认）
