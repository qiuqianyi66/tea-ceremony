# m1-tea 评审记录（expert-reviewer，T7.5）

> 评审对象：feature/m1-tea 全部变更文件（git diff 基线 = feature/m1-auth@9583dbf）。
> 结论：**通过 —— 🔴 0 / 🟡 0 / 🟢 3 / 🔵 2**（🟢🔵 不阻塞，记录备查）

## 变更文件清单（全量覆盖）

| 类别 | 文件 |
|---|---|
| 迁移/脚本 | `scripts/seed-extract.mjs`、`backend/src/main/resources/db/migration/V2__culture_seed.sql`、`.harness/changes/m1-tea/{db-migrations,rollback,summary}.{sql,md}` |
| 后端 tea 域 | `common/response/PageResult.java`、`tea/entity/Tea.java`、`tea/repository/TeaRepository.java`、`tea/vo/TeaVo.java`、`tea/service/TeaService.java`、`tea/controller/TeaController.java` |
| 后端修改 | `auth/security/SecurityConfig.java`（放行 GET teas）、`common/exception/GlobalExceptionHandler.java`（补 400） |
| 测试 | `tea/service/TeaServiceTest.java`（6）、`tea/controller/TeaControllerTest.java`（5）、`tea/TeaIntegrationTest.java`（7） |
| 文档 | `.harness/wiki/api-contract.md`（新增 /api/v1/teas 契约） |

## 六维评审

### 1. 正确性 ✅
- 分页：page 1-based → `PageRequest.of(page-1, size)` 转换正确（单测 verify）；size 上限 100、page ≥ 1 校验（BadRequestException）
- 筛选：category equal（trim 后）、origin `like %x%`（trim 后）、blank 忽略——谓词构建正确（集成测试真实库验证 category=绿茶 全匹配）
- 详情：按 PK 查找，缺失抛 NotFoundException → 404（slice + 集成双覆盖）
- V2 迁移：157 条计数与 src/data 逐一相符（teas 66/regions 19/processes 6/people 21/poems 25/wares 6/etiquettes 14）；upgrade/downgrade/re-upgrade 往返实测全过；JSONB flavor 与 TEXT 长文本转义实测入库正确（西湖龙井抽样字段断言）
- MethodArgumentTypeMismatch → 400 PARAM_INVALID（slice + 集成双覆盖）

### 2. 性能 ✅
- 分页 size ≤ 100 硬上限，杜绝全量拉取；列表按 id 排序（seeds 顺序）确定性
- category 筛选走 V1 已建 `ix_teas_category` 索引；详情走 PK
- 无 N+1（tea 域无关联查询）；`origin like %x%` 前导通配无索引——当前 66 条规模可忽略（见 🟢-1）

### 3. 安全 ✅
- SQL 注入：JPA Criteria API 全程参数绑定，无字符串拼接 SQL
- 越权：公开只读目录无敏感数据；Security 放行仅 `GET /api/v1/teas/**`（未放行其他方法）
- 异常信息脱敏：类型不匹配统一返回"参数格式错误"，不泄露内部异常（见 🔵-1）

### 4. 一致性 ✅
- api-contract.md 已同步新增 /api/v1/teas（方法/路径/参数/响应/错误/字段清单）——本切片交付项完成
- TeaVo snake_case 与前端 TeaResponseDto 对齐；PageResult 与 ApiResponse 分页注释 `{items,total,page,size}` 一致
- 错误码复用既有枚举（PARAM_INVALID/NOT_FOUND），未新增码值
- V2 表结构严格对齐 V1 schema（无 schema 变更，仅数据）；related_tea_ids 存 slug 数组与数据模型一致

### 5. 可维护性 ✅
- seeds 由 `seed-extract.mjs` 生成（dry-run/--write 双模式），杜绝手写 79KB INSERT；生成器内记录全部映射决策（留 NULL 依据：旧库 seeds 亦无关联，不编造）
- TeaService 单一职责：筛选/分页/详情；常量 MAX_SIZE；`PageResult.of()` 静态工厂
- 测试命名 given-when-then 风格；集成测试覆盖真实 HTTP + 真实库 + Security 放行（游客 200）
- 测试与生成逻辑分离：谓词内部断言交给集成测试（真实库），单测只断言公共行为——符合行为测试三规则（见 🟢-3）

### 6. 架构合规 ✅
- 分层单向：Controller（仅参数/响应）→ Service（业务+校验）→ Repository；无业务逻辑泄漏
- 统一 ApiResponse + BusinessError 体系（BadRequest/NotFound）
- 只读方法 `@Transactional(readOnly = true)`；写操作无（纯迁移）
- Flyway 迁移成对（V2 up / rollback.sql down）+ 真实 Postgres 往返——09-db-migration 技能流程合规
- ddl-auto validate 未触碰；Security 最小放行（游客可浏览是 PRD 明示需求）

## 分级问题

### 🟢 次要（记录，不阻塞）
1. `origin like %x%` 前导通配：当前 66 条无索引压力；未来数据 > 1k 时评估 pg_trgm/全文索引，本切片不动
2. `TeaService` 常量字符串"茶叶不存在"内联：与 auth 域 `LOGIN_FAILED` 模式一致，M1 收敛期统一消息管理时再抽
3. 测试重构沉淀：Criteria mock 手动执行 toPredicate 在 Mockito strict 下脆弱（PotentialStubbingProblem/UnnecessaryStubbing），改为公共行为断言 + 集成测试覆盖谓词——后续测试沿用此分工

### 🔵 提示（不阻塞）
1. like 通配符 `%`/`_` 未转义：筛选参数场景风险极低（用户自选值，非持久化注入点）；如需严格匹配再转义
2. story/description 含 HTML 原文返回：前端渲染转义属前端职责，联调切片核对

## 自检清单

- [x] 6 维全覆盖
- [x] 🔴 零残留、🟡 清零
- [x] 评审记录已落盘（本文件）
- [x] 变更文件全量覆盖（无遗漏）
