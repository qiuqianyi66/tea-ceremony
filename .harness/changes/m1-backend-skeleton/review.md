# Review — m1-backend-skeleton（批 A：T2 Maven 工程 / T4 基础骨架 / V1 迁移）

> 评审人：MainAgent（expert-reviewer 流程，6 维评审）
> 日期：2026-10-05
> 变更范围：backend/pom.xml、TeaApplication.java、application.yml(+dev)、V1__init.sql、common/（errorcode/response/exception/config）、测试 8 个（ApiResponseTest/BusinessExceptionTest）
> 验证证据：`mvn -q compile` ✓、`mvn -q test` ✓（23/23，含 T6）、`mvn -q package` ✓（79.7MB jar）

## 6 维评审

### 正确性
- ApiResponse/异常体系/全局异常处理：单测覆盖 success/error、四子类错误码与 HTTP 状态；Controller 测试验证 400 + ApiResponse 格式。✅
- User 实体与 V1 users 表逐字段对齐（类型/可空/默认/snake_case 命名），由 ddl-auto: validate 兜底。✅
- V1 迁移 13 表 + 索引/唯一/外键，命名 ix_/uk_/fk_ 一致。⚠️ 见 🟡-1。

### 性能
- JWT 过滤器无状态不查库，无 N+1；无批量/缓存场景。✅

### 安全
- BCrypt 哈希、登录失败统一文案（防用户枚举）、500 不泄露堆栈、JWT secret ≥32 字节校验 + 环境变量注入。✅

### 一致性（wiki 漂移）
- pom 版本已实查（Boot 3.5.3、jjwt 0.12.6、spring-ai-alibaba 1.1.2.0 官方 README）。✅
- ⚠️ V1 与 wiki §3 幂等键规则存在矛盾，见 🟡-1。

### 可维护性
- 分层清晰、命名符合工程结构规范；record DTO/VO；测试行为导向。✅

### 架构合规
- 分层单向（Controller→Service→Repository）、四层对象分离、红线 #2 异常体系、红线 #7 ddl-auto: validate、/api/v1 前缀、事务注解齐全。✅

## 分级问题

- 🔴 阻断：无
- 🟡 主要：无代码缺陷；1 个设计矛盾待用户决策（见下）
- 🟢 次要：
  - application-dev.yml 注释引用 scripts/dev-postgres.ps1（不存在）——明天本地起库方式确定后修正注释
  - User.preferredAroma（JSONB List）类型映射未经真实库验证——明天集成测试覆盖
- 🔵 提示：
  - tea_relations 无查询索引（本阶段无查询实现，T 切片时补）
  - JwtService 构造抛 IllegalArgumentException（配置错误启动即失败，非业务路径）

## 🟡-1（已决策：方案 1 采纳，2026-10-05 用户拍板）

**幂等键与列可空的矛盾**：
- wiki §3 明文：`tasting_records` 幂等键 = `user_id + client_id` 唯一
- 旧 FastAPI 模型（record.py）：`user_id nullable`、`client_id nullable`
- V1 迁移忠实旧模型（两列可空）→ Postgres 唯一索引对含 NULL 的行不生效 → **幂等语义失效**（与红线 #5 冲突）

**决策**：采纳方案 1 —— `client_id NOT NULL`（幂等键核心，客户端总是生成 UUID），`user_id` 保持可空（支持匿名记录）。V1 真身与 changes 留档已同步修改，待明天 T3 真实库验证。

## 结论

批 A 代码质量通过评审（🔴 零、🟡 无代码缺陷）；🟡-1 已按用户拍板采纳方案 1 并落地到 V1。评审通过条件：T3/T5 完成后批 A 方闭合。

---

## 2026-10-06 复核（T3 迁移往返 / T5 冒烟闭合）

> 验证证据：`mvn -q test` ✓（31/31，含 T6 集成）、真实 Postgres 往返实测。

### T3 迁移往返（真实库实测）
- upgrade：应用启动 Flyway 应用 V1 → public 14 表（13 业务表 + flyway_schema_history）✓
- downgrade：rollback.sql 13 DROP（逆序）全部执行 + 清 flyway 历史 → public 0 表 ✓
- re-upgrade：应用重启 Flyway 重放 V1 → 14 表恢复，history 记录 `1 - init` ✓

### T5 冒烟（真实库 + 真实 HTTP）
- `/actuator/health` → 200 `{"status":"UP"}` ✓
- register/login 真实走通 → 200 ApiResponse(TokenVo) ✓
- 带有效 token 访问未知路径 → 404 `NOT_FOUND` 统一格式 ✓
- 密码错误 → 401 `UNAUTHORIZED` ✓
- 匿名访问受保护路径 → 403 空 body（评审发现：Security 默认入口点，随 T6 集成修复为 401 统一格式）

### 分级问题（今日新增）
- 🔴 阻断：无
- 🟡 主要：
  - **畸形 JSON → 500**（HttpMessageNotReadableException 落入兜底 Exception 处理器）——已修复：补 `HttpMessageNotReadableException → 400 PARAM_INVALID("请求体格式错误")`，回归测试 `malformedJsonReturnsParamInvalidInsteadOf500` ✓
  - **错误 HTTP 方法 → 500**（HttpRequestMethodNotSupportedException 同前；ErrorCode.METHOD_NOT_ALLOWED 已定义却无处理器）——已修复：补 `→ 405 METHOD_NOT_ALLOWED`，回归测试 `unsupportedMethodReturns405UnifiedResponse` ✓
- 🟢 次要（昨日遗留，今日闭环）：
  - application-dev.yml 注释引用不存在的 scripts/dev-postgres.ps1 → 已按实测修正（Docker 容器 5433，宿主机 PG17 占用 5432）
  - User.preferredAroma JSONB 真实库映射 → 集成测试 registerPersistsUserAndLoginSucceeds 覆盖（插入+读取往返）✓
- 🔵 提示：
  - 宿主 PostgreSQL 17 Windows 服务（postgresql-x64-17）占用 5432，Docker 容器落 5433——环境事实已记入 HANDOFF，compose（T9）需规避
  - Testcontainers 1.21.2 与 Docker Engine v29 最低 API 1.44 不兼容（npipe 400 空 /info）→ 升 1.21.4（T6 变更，见 m1-auth review）

## 结论（复核后）

批 A 正式闭合：🔴 零、🟡 清零（今日两处框架异常 500 已修复并带回归测试），T3/T5 实测证据齐全。可提交。
