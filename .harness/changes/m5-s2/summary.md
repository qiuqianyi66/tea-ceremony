# m5-s2 变更记录

> 目录：`.harness/changes/m5-s2/`（本次在 main 直接落库，ADR-013 已登记）。
> 依据：ADR-013（pgvector 混合检索）+ M5 PRD §7 + data-layer PRD F-D3。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | m5-s2：agent memory + 混合检索基础设施（数据库部分） |
| 需求来源 | `docs/prd/m5-agent-product-prd.md`（F-M5-2/3/5）+ `docs/prd/data-layer-product-prd.md`（F-D3）+ ADR-013 |
| 类型 | feat（数据库迁移）+ docs |
| 涉及范围 | 部署（compose 镜像）/ 数据（Flyway V2）/ 代码（8 表 RAG，随 S2 实施） |

## 二、需求与方案

### 需求描述

1. pgvector + pg_trgm 扩展就绪（同库混合检索，不引新基础设施）。
2. `culture_chunks` 表（8 表知识切块 + embedding + 状态机）支撑语义检索。
3. `ai_chat_sessions` / `ai_messages`（登录用户会话记忆，级联删除）。

### 验收标准（Given-When-Then）

- **Given** 本地 pg 重建（pgvector/pgvector:pg16 镜像）
- **When** backend 启动执行 Flyway
- **Then** V1+V2 全部 applied；`\dx` 见 vector/pg_trgm；三张新表存在且含索引/外键

- **Given** 往返测试临时库
- **When** 依次执行 V1→V2（up）→ rollback（down）→ V2（up）
- **Then** down 后三表/两扩展消失且无依赖报错；up 后恢复原状

### 技术方案

- 镜像：`postgres:16-alpine` → `pgvector/pgvector:pg16`（同 PG16，pgdata 卷兼容）。
- V3 SQL：扩展 + 三表 + HNSW（vector_cosine_ops）+ GIN（gin_trgm_ops）+ 外键（ai_messages 级联删除）。
- 版本号 V3（V2 已被 m1-tea 文化种子占用，agent_memory 顺延）。
- embedding 维度 vector(1024)（对齐百炼 text-embedding-v3，实现时登记）。
- 红线冲突清零：ddl-auto: validate 不变；迁移走 Flyway 版本化。

## 三、影响分析

- compose db 镜像变更：本地与 CI migration-test 服务镜像同步更新。
- 无表结构破坏（V2 纯新增）；pgdata 卷同大版本兼容，数据不丢。
- 契约无变化（新表为内部存储，无对外 API）。
- 承重墙确认：未触及降级链；S1 ILIKE 保留为降级路径。

## 四、自检清单

- [x] ADR-013 已登记（docs/ADR/）
- [x] 迁移成对：V3__agent_memory.sql（up）+ rollback.sql（down）
- [x] up 验证：本地重建 + Flyway applied + psql 核验
- [x] down 验证：往返测试（up→down→up）
- [x] Testcontainers 集成测试覆盖 V3 up（mvn test）
- [x] 无红线冲突（ddl-auto: validate / 命名 / 注释）
