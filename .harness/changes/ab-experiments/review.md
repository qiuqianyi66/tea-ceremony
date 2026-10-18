# ab-experiments Review

> 评审对象：A/B 实验 + 异常指标自动回滚（Flyway V9 单表 + `com.tea.ai.experiment` + 4 个需 JWT 端点）
> 评审方式：逐项核对（需求 → 迁移 → 分层 → 测试 → 安全 → 实测证据），证据全部本机实跑
> 结论：**通过（1 项待主控接线）**，🔴 0 🟡 1，2026-10-18

## 一、需求对齐

- ✅ 双轨调度：`assign(expKey, subjectId)` 返回 `control` / `treatment`，确定性哈希分桶，无 assignment 表
- ✅ 安全默认：实验缺失 / 非 running / 占比 0 / subjectId 空 → `control`
- ✅ 异常指标触发器：错误率差值与 P99 比值两条判据，样本门槛先拦
- ✅ 无损回滚：只改实验状态（`stopped` + `stopped_at` + `stop_reason`），`assign` 随即全量回落 control，无需重启容器
- ✅ 生命周期：start（draft/paused → running，running 幂等）/ pause / stop（任意 → stopped，幂等），stopped → running 抛 `ConflictException`
- ✅ 与调用方契约：`assignActive` 返回 `Optional<String>`（empty = 没有可用实验，调用方保持现状），`assign` = `orElse(control)`；未标注 `experiment` 的 trace 仅在唯一 running 实验时计入

## 二、迁移与命名

- ✅ 单表 15 列，`BIGSERIAL` / `TIMESTAMPTZ` / `SMALLINT` / `JSONB`，与需求字段逐字一致
- ✅ `uk_ab_experiments_key`（UNIQUE exp_key）、`ix_ab_experiments_status (status, updated_at DESC)`
- ✅ CHECK：`status IN ('draft','running','paused','stopped')`、`traffic_percent BETWEEN 0 AND 100`
- ✅ 全字段 `COMMENT ON COLUMN`（表 1 条 + 列 15 条，实测 `pg_description` 计数 = 16）
- ✅ `changes/ab-experiments/db-migrations.sql` 与 V9 逐字一致（脚本比对 `EndsWith` = True）

## 三、真实 PostgreSQL 17 验证（实跑，非静态自检）

环境：本机 PostgreSQL 17.7，一次性 schema `ab_verify_1018_1705`（未触碰 public），跑完 `DROP SCHEMA`。

| 项 | 结果 |
|---|---|
| `psql -f V9__ab_experiments.sql` | exit 0：CREATE TABLE + 16 COMMENT + 2 INDEX |
| 最小插入默认值 | `draft / 10 / {} / {} / 0`，`created_at = updated_at` |
| status 非法值 `bogus` | 违反 `ck_ab_experiments_status`（23514） |
| traffic_percent 101 / -1 | 违反 `ck_ab_experiments_traffic`（23514） |
| 重复 exp_key | 违反 `uk_ab_experiments_key`（23505） |
| 边界值 0 / 100 | 均可插入 |
| jsonb 读写 | `variants->'treatment'->>'fallback' = false`、`guardrail->>'minSampleSize' = 50` |
| Repository 原生 SQL（从 Java 源码抽取后执行，两轮） | 第一轮（要求 exp_key 非空）：`control 30/3/129.71`、`treatment 30/10/429.71`，4 类干扰行全过滤；第二轮（放宽为 exp_key 可为空）：另出 `NULL/control 7/7/5000`、`NULL/treatment 9/0/6000` 两组未标注行，窗口外/无 variant/null plan_layer/variant=bogus 四类干扰行仍全过滤 |
| `rollback.sql` | exit 0，表计数 0（两轮均验证） |
| `DROP SCHEMA ... CASCADE` | exit 0，`information_schema.schemata` 计数 0 |

## 四、分层与事务

- ✅ `Controller → Service → Repository` 单向；`LayerDependencyTest` 实跑通过（ArchUnit 6 条规则全绿）
- ✅ 写方法 `@Transactional(rollbackFor = Exception.class)`；只读 `readOnly = true`；`@Scheduled` 方法不加事务（不在一个长事务里等库）
- ✅ Controller 只做参数与响应，返回 `ApiResponse<T>`，无业务判断、无查询
- ✅ DTO 全 record；JSONB 以 `JsonNode` / 强类型 `GuardrailConfig` 透出，无裸 Map 返回

## 五、测试

| 类 | 例数 | 结果 |
|---|---|---|
| `ExperimentAssignTest` | 9 | 全绿（含 10000 主体分布 8%~12%、100 次跨缓存确定性） |
| `ExperimentGuardTest` | 13 | 全绿（样本门槛 / error_rate / p99 / null 语义 / 自定义阈值 / 端到端 stop + 计数 / 未标注 trace 归属两例） |
| `ExperimentLifecycleTest` | 11 | 全绿（三态流转 / stop 幂等保留首因 / stopped→running 409 / 404 / 400） |
| `LayerDependencyTest` | 1 | 全绿 |
| 合计 | 34 | Run 34 / Failures 0 / Errors 0 |

## 六、安全（🟡 1）

- ✅ 4 端点均落在 `anyRequest().authenticated()`，未改 `SecurityConfig`
- 🟡 **启停端点只校验「已登录」**：项目当前没有角色/管理令牌的方法级鉴权（无 `@EnableMethodSecurity`，`AdminTokenFilter` 只挂在 `/api/v1/admin/**`），因此任何已登录用户都能 start/stop 实验。按角色或管理令牌收紧需在 Security 侧接线（本切片硬约束为不改 SecurityConfig）。
- ✅ 异常全部走 `BusinessException` 子类（400 `PARAM_INVALID` / 404 `NOT_FOUND` / 409 `CONFLICT`）
- ✅ 原生 SQL 只用绑定参数，无字符串拼接注入面

## verdict

🔴 0 🟡 1 —— 通过。V9 单表在真实 PostgreSQL 17 完成建表/约束/默认值/jsonb/原生 SQL/rollback 全链验证并清理一次性 schema；分桶确定性、分布、回滚判据、生命周期共 31 例单测全绿；唯一遗留是启停端点的权限收紧，属主控接线项（不改 SecurityConfig 的硬约束下无法在本切片完成）。

---

## 八、主控复核补充（2026-10-18）

### 8.1 已修复：实验端点越权（子代理遗留 🟡 第 1 条）

子代理交付时启停端点只校验「已登录」——任何注册用户都能 `POST .../start` 打开灰度或 `.../stop` 掐掉正在跑的实验。这是本轮审计里「权限控制」一项的实质缺陷。

修法：把实验端点从 `/api/v1/ai/experiments` 挪到 **`/api/v1/admin/experiments`**，由既有 `AdminTokenFilter` 覆盖（`tea.admin.token` 未配置时 fail-closed 401，常量时间比较，令牌只走环境变量）。**没有新建角色模型**——用户表无角色字段，加角色是 L3 数据模型变更，用现成管理令牌是更小改动面。契约同步改为 admin 前缀。

### 8.2 已补：trace 写 `experiment` 归属

子代理原生 SQL 按 `(experiment, variant)` 分组，但只有 variant 时靠「唯一 running 实验」兜底推断；两个实验并行就会 WARN 并忽略，表现为指标为 0、自动回滚静默失效。

修法：`TraceRecorder.begin(...)` 增加 7 参重载，`plan_layer` 同时写 `variant` 与 `experiment`；`AiChatService` 传实验键。原有 5/6 参重载保留（既有调用零改动）。这样多实验并行无需改 SQL 即生效。

### 8.3 主控独立复验 V9（不采信子代理自述）

本机 PostgreSQL 17，隔离 schema，全流程自跑：

| 项 | 结果 |
|---|---|
| 应用 V9 | exit 0 |
| 索引/约束落库 | `ab_experiments_pkey`、`ix_ab_experiments_status`、`uk_ab_experiments_key` 三处齐 |
| 最小插入默认值 | `draft \| 10 \| {} \| {}`——与「实验默认不运行、10% 流量」的设计一致 |
| `exp_key` 唯一 | 第二次插入报 `uk_ab_experiments_key` 冲突 |
| `traffic_percent` CHECK | 150 被 `ck_ab_experiments_traffic` 拦下 |
| `status` CHECK | `bogus` 被 `ck_ab_experiments_status` 拦下 |
| 回滚 | `rollback.sql` exit 0 → 表计数 0 |

### 8.4 接线验证（3 个新用例）

| 用例 | 断言 |
|---|---|
| `controlVariantSuppressesFallbackAndKeeps502` | 对照组退化为 ADR-023 之前的旧语义（502），且规则库一次都没被调用 |
| `treatmentVariantUsesFallback` | 实验组仍走规则兜底，`degraded=true` |
| `variantIsRecordedIntoEvalTrace` | trace 同时含 `treatment` 与 `ai.fallback.rollout`（缺任一，Guard 都算不出对比） |

### 8.5 本轮实测汇总

| 命令 | 结果 |
|---|---|
| `mvn clean test-compile` | BUILD SUCCESS |
| `mvn test -Dtest='Experiment*Test,AiChatFallbackWiringTest,AiChatServiceTest,AiCallQuotaTest,TraceRecorderTest,LayerDependencyTest'` | **74 run / 0 fail / 0 error** |
| `node scripts/audit-wiki-drift.cjs` | 端点双向一致，`ERRORS: []` |
| `node scripts/verify-harness.cjs` | `ERRORS: []` |
| `node scripts/audit-redlines.cjs` | `ERRORS: []` |

### 8.6 仍然存在（下一轮）

1. **回滚粒度 ≤30 秒**（分桶缓存 TTL），非毫秒级；毫秒级需网关层调度（ADR-024 反转条件）。
2. **Testcontainers 集成测试未跑**：本机 Docker 未启用。`ExperimentGuardService` 的原生 SQL 与 Hibernate `validate`（`SMALLINT ↔ Short`）属**未复核断言**，靠 CI 真跑。
3. **管理令牌 = 单令牌全权限**：`ADMIN_API_TOKEN` 能同时操作回填与实验。项目无角色模型，细粒度授权仍是空缺。
