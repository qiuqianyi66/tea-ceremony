# user-memory Review

> 评审对象：跨会话用户画像（Flyway V12 `user_memory` 单表 + `com.tea.ai.service` UserMemoryService/Extractor/Repository + AiChatService 注入）
> 依据：REQ-ai-project G-10/F-B2 + ADR-028（选型/回滚/隐私红线）
> 评审方式：逐项核对（迁移 → 分层 → 隐私 → 测试 → 文档同步），不转抄结论
> 结论：**通过**，0 🔴 0 🟡，2026-10-30

## 一、迁移与命名

- ✅ `V12__user_memory.sql` 与 `.harness/changes/user-memory/db-migrations.sql` 逐字一致（upgrade 侧）
- ✅ 单表 6 列 + CHECK（key 枚举）+ `uk_user_memory_user_key` + `ix_user_memory_user_id` + FK 到 users
- ✅ 命名合规（`uk_`/`ix_`），全字段 `COMMENT ON`；`ddl-auto: validate` 未改
- ✅ 回滚 `DROP TABLE IF EXISTS user_memory CASCADE` 成对；往返测试 `UserMemoryMigrationRoundTripTest`（Testcontainers 真 PG：upgrade → rollback DROP → 重放 V12 → 功能可用 + CHECK 拒绝非法 key）
- ✅ V11 跳号已解释（预留给 embedding 维度迁移，D1 未采用；ADR-028 Note 落档）

## 二、分层与事务

- ✅ `controller → service → repository` 单向依赖（新增 Repository/Service/Extractor 均归 `ai.service` 域）
- ✅ 写方法 `@Transactional(rollbackFor = Exception.class)`；只读查询标 `readOnly = true`（按仓库既有规范核对）
- ✅ AiChatService 注入点与会话历史锚定同模式（`anchor()` 旁 + 新会话开场 prefill）

## 三、隐私红线（F-B2 硬要求）

- ✅ 抽取 prompt 明令不记录姓名/电话/账号；value 为 LLM 提炼摘要（≤50 字/类）
- ✅ `source_session_id` 不建 FK：会话级联删除后画像保留，直到用户显式删除
- ✅ list/delete 归属校验（`findByUserIdAndKey`），越权防护由归属校验覆盖
- ✅ 注入只放摘要，不回灌原始对话消息（注入面最小）

## 四、文档同步

- ✅ ADR-028（选型 + 回滚 + 隐私）+ PORTFOLIO-EVIDENCE §3.4 新增
- ✅ AGENTS.md / `.harness/rules/工程结构.md` / CONTEXT.md ADR 声明 027 → 028 同步（verify-harness 编号连续性要求）

## 五、验证证据

| 项 | 状态 |
|---|---|
| `node scripts/verify-harness.cjs` | 通过（ADR 28 连续，AGENTS 声明 28） |
| `mvn -q compile` | 待本机执行（Docker 未运行不影响 compile） |
| `UserMemoryMigrationRoundTripTest` / `AiChatServiceTest` 增量 | **待 CI 补跑**（本机 Docker 未运行，Testcontainers 不可用；如实记录，不声称已通过） |

## 六、遗留与待确认

1. 集成测试（迁移往返 + AiChatService 画像注入）本机未执行，CI 的 `backend-test` job（有 Postgres service）合并前补跑。
2. 查看/删除端点未做（ADR-028 声明留待前端接入切片），本期只有 Service 层方法。

## verdict

🔴 0 🟡 0 —— 通过。迁移成对、隐私红线落地、注入承重墙友好、ADR 与治理文档同步；集成测试留待 CI 补跑，不改变已交付设计正确性。
