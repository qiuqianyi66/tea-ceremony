# user-memory 变更记录

> 目录：`.harness/changes/user-memory/`
> 依据：REQ-ai-project-2026-10-09 G-10/F-B2（跨会话长期记忆）+ 蓝图 B1.4

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | user-memory：跨会话用户画像（单表 key-value 摘要） |
| 需求来源 | `docs/prd/REQ-ai-project-2026-10-09.md`（G-10/F-B2） |
| 类型 | feat（数据模型 + 后端模块） |
| 涉及范围 | 数据（Flyway V12 单表）/ 代码（`com.tea.ai.service` UserMemoryService/Extractor/Repository + AiChatService 注入）/ 文档（ADR-028 + PORTFOLIO-EVIDENCE） |

## 二、需求与方案

### 需求描述

1. 跨会话记住稳定偏好：用户在会话 A 说「我忌绿茶」，会话 B 开场茶灵要记得。
2. 隐私红线：不存敏感信息、可查看、可删除、越权归属校验。
3. 画像不膨胀：每用户每类一行，新信息与旧摘要 LLM 合并写回。

### 验收标准（Given-When-Then）

- **Given** 用户在旧会话表达忌口（如「我忌绿茶」）
- **When** 新会话开场（无 sessionId，触发对最近旧会话抽取）
- **Then** 画像表写入/合并 `restriction` 摘要，新会话后续轮次 system prompt 注入该摘要

- **Given** 用户查看/删除画像
- **When** 调用 `UserMemoryService.list/delete`
- **Then** 仅返回/删除该用户自己的行（归属校验），他人不可读

### 技术方案

- 单表 `user_memory(user_id, key, value, source_session_id)`，`key ∈ {preference, restriction, habit}`，`uk(user_id, key)` 每用户每类恒一行（ADR-028 选型，否独立宽表）。
- 抽取时机 = 旧会话结束 best-effort；失败仅 warn 不阻塞聊天承重墙。
- 注入只放 LLM 提炼摘要（≤50 字/类），不回灌原始对话消息。
- `source_session_id` 不建 FK（会话删除后画像保留，直到显式删除）。

## 三、影响分析

- 新增单表，无既有表变更；回滚 `DROP TABLE IF EXISTS user_memory CASCADE`。
- 迁移编号 V12（V11 预留给 embedding 维度迁移，蓝图 D1 未采用，Flyway 跳号合法，见 ADR-028 Note）。
- 契约：无新端点（查看/删除留待前端接入切片，ADR-028 声明）。
- 承重墙：抽取失败仅 warn，不阻塞 chat 主链路。

## 四、自检清单

- [x] ADR-028 已写（选型 + 回滚 + 隐私红线）
- [x] 迁移成对：`V12__user_memory.sql`（up）+ `rollback.sql`（down）
- [x] 命名合规：`uk_` / `ix_`，全字段 `COMMENT ON`
- [x] `ddl-auto: validate` 不变，schema 只走 Flyway
- [x] 往返测试 `UserMemoryMigrationRoundTripTest`（Testcontainers 真 PG）
- [x] AGENTS.md / 工程结构.md / CONTEXT.md ADR 声明同步至 028
- [ ] 集成测试本机执行（Docker 未运行，由 CI 补跑）
