# m1-record 评审记录（expert-reviewer，T8.5）

> 评审对象：feature/m1-record 全部变更文件（git diff 基线 = feature/m1-tea@bb65ade）。
> 结论：**通过 —— 🔴 0 / 🟡 0 / 🟢 1 / 🔵 1**（不阻塞，记录备查）

## 变更文件清单（全量覆盖）

| 类别 | 文件 |
|---|---|
| 需求/方案 | `docs/prd/m1-record-requirements.md`（新建）、`PLAN.md`（T8 方案章节） |
| 后端 record 域 | `record/entity/TastingRecord.java`、`record/repository/TastingRecordRepository.java`、`record/dto/RecordCreateRequest.java`、`record/vo/RecordVo.java`、`record/service/TastingRecordService.java`、`record/controller/TastingRecordController.java` |
| 后端 ware 域 | `ware/entity/TeaWare.java`、`ware/repository/TeaWareRepository.java`（最小映射，existsById 校验用） |
| 测试 | `record/service/TastingRecordServiceTest.java`（11）、`record/controller/TastingRecordControllerTest.java`（6）、`record/TastingRecordIntegrationTest.java`（8） |
| 文档 | `.harness/wiki/api-contract.md`（/api/v1/records 契约）、`.harness/wiki/data-model.md`（评分口径校正） |

## 六维评审

### 1. 正确性 ✅
- 幂等（承重墙）：查重返回已有 + 唯一索引并发兜底转幂等——集成实测同 client_id 两次提交返回同 id、total=1
- 越权：详情/删除 `findByIdAndUserId`，无 → 404——集成实测跨用户 404、不泄露存在性
- 倒序：`findByUserIdOrderByCreatedAtDesc`——集成实测 items[0] 为最后创建记录
- 校验：@Valid（client_id/tea_name 必填）→ 400；tea_id/ware_id 非空存在性 → 400——集成实测 99999 → 400
- 分页边界（page≥1、size≤100）、infusions 缺省 1——单测覆盖
- RecordVo 含 client_id（前端 fromRecordDto 还原本地 id 依赖）——评审中核对前端 records.ts 补上，避免契约断链

### 2. 性能 ✅
- 列表走 `ix_tasting_records_user_id` + 分页（size≤100）；幂等查询命中唯一索引；无 N+1
- 个人记录量级（百~千级）无压力

### 3. 安全 ✅
- 越权防护：跨用户 404（不泄露资源存在性）；匿名 401 统一格式（集成实测）
- SQL 注入：全部派生查询参数绑定；无字符串拼接
- 入参 @Valid 限长（client_id≤64、tea_name≤100 等）

### 4. 一致性 ✅
- api-contract.md 同步（/api/v1/records 四端点 + RecordVo 字段含 client_id）
- data-model.md 评分口径校正（八维 1-5、工艺系数 ≤1.0）——消除 T8 需求分析发现的 wiki 漂移
- RecordVo/RecordCreateRequest snake_case 与前端 records.ts dto 对齐（camelCase 本地模型经 toRecordDto 转换）
- 错误码复用（PARAM_INVALID/NOT_FOUND/UNAUTHORIZED），零新增码值

### 5. 可维护性 ✅
- 模式对齐 auth/tea 域（@Service + @RequiredArgsConstructor、record VO + from()、PageResult）
- `TastingRecord` 命名规避 java.lang.Record 冲突（正确性隐患前置化解）
- 幂等兜底注释说明并发语义；测试命名 given-when-then
- 集成测试 helper（registerAndGetToken/withToken）复用，8 例覆盖核心路径

### 6. 架构合规 ✅
- 分层单向：Controller 薄（仅 @AuthenticationPrincipal + 转发）、Service 业务、Repository 数据
- 统一 ApiResponse/PageResult/BusinessError；只读 @Transactional(readOnly=true)、写默认
- **零迁移**（V1 已就位，符合 09-db-migration 最小原则）；Security 默认 authenticated 覆盖，零配置改动
- 新包 `com.tea.record` / `com.tea.ware` 与工程结构规范一致

## 分级问题

### 🟢 次要（记录，不阻塞）
1. TeaWare 最小映射（仅校验 existsById）：本切片最小实现正确；teaware 目录切片（批 B 后续）展开全字段时按 data-model.md 补齐，避免重复

### 🔵 提示（不阻塞）
1. `HttpMediaTypeNotSupportedException` 无专门 handler（集成测试暴露：缺 Content-Type 时落 500）：前端正常请求均带 application/json，属防御性改进；后续统一异常收敛时补 415 映射即可

## 自检清单

- [x] 6 维全覆盖
- [x] 🔴 零残留、🟡 清零
- [x] 评审记录已落盘（本文件）
- [x] 变更文件全量覆盖（含需求文档/wiki/测试，无遗漏）
