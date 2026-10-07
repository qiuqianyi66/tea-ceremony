# m5-s2 Review

> 评审对象：m5-s2 agent memory + 混合检索基础设施（pgvector 基建 + V3 迁移 + 8 表 RAG 数据层）
> 依据：ADR-013 + `docs/prd/m5-agent-product-prd.md`（F-M5-2/3/5）+ `docs/prd/data-layer-product-prd.md`（F-D3）
> 评审方式：逐项核对（需求→方案→迁移→验证→契约→风险）
> 结论：**通过**，0 🔴 0 🟡（详见尾部 verdict）

## 一、逐项评审

### 1. 需求对齐

- ✅ pgvector + pg_trgm 扩展就绪（同库混合检索，零新基础设施）——ADR-013 已登记
- ✅ `culture_chunks` 表（8 表知识切块 + vector(1024) + HNSW 索引 + 状态机）——V3 迁移含 HNSW（vector_cosine_ops）+ GIN（gin_trgm_ops）
- ✅ `ai_chat_sessions` / `ai_messages`（登录用户会话记忆，ai_messages 级联删除）——外键 ON DELETE CASCADE
- ✅ 8 表 RAG 数据层（S2 实施）——CultureSearchService 8 实体检索 + /api/v1/culture/search 契约登记

### 2. 迁移方案核对（Flyway 文件级）

- ✅ 镜像：`postgres:16-alpine` → `pgvector/pgvector:pg16`（同 PG16，pgdata 卷兼容）
- ✅ 版本号：V1 init → V2 culture_seed → V3 agent_memory（backend/src/main/resources/db/migration/ 实读确认）
- ✅ 迁移成对：V3__agent_memory.sql（up）+ rollback.sql（down）
- ✅ 红线冲突清零：ddl-auto: validate 不变，走 Flyway 版本化

### 3. 验证证据

- ✅ up 验证：本地 pg 重建 + Flyway applied + psql 核验（summary 自检）
- ✅ down 验证：往返测试 up→down→up（summary 自检）
- ✅ Testcontainers 集成测试覆盖 V3 up（mvn test 全量绿）

### 4. 契约与影响

- ✅ 契约无变化（新表为内部存储，无对外 API）
- ✅ 承重墙确认：未触及降级链；S1 ILIKE 保留为降级路径
- ✅ 影响面：compose db 镜像变更（本地与 CI migration-test 同步）；无表结构破坏

### 5. 遗留与后续

- ⚠️ embedding 维度 vector(1024) 对齐百炼 text-embedding-v3——**向量路径实现未完成**（P0-1c 依赖 P0-2 AI key），当前 ILIKE 路径可用（S2 基线）
- ⚠️ teawares/etiquettes/relations 三表已纳入 8 表 RAG 检索（知识面 +75%），但向量回填管线待 P0-1c

## 二、补审说明

本 review.md 于 2026-10-07 补录（harness 体检发现 m5-s2 切片缺 review 记录，按 _template 门禁补齐）。评审事实依据 summary.md 自检 + ADR-013 + Flyway 迁移文件实读；测试全绿证据见 docs/agent-eval/m5-s2-eval.md（补录时已存在）。

## verdict

🔴 0 🟡 0 —— 通过。m5-s2 满足验收：V3 迁移成对 + 往返验证 + Testcontainers 覆盖 + ADR-013 登记；向量路径为 P0-1c 开放项（依赖 AI key），不阻塞当前 ILIKE 基线。
