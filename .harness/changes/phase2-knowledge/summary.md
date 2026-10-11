# phase2-knowledge 变更记录

> 目录：`.harness/changes/phase2-knowledge/`，与 git 分支 `feature/phase2-knowledge` 同名。
> 三件套：本文件 + `db-migrations.sql`（V7 up 留档）+ `rollback.sql`（V7 down）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | phase2-knowledge（AI 能力建设 Phase 2 知识注入：T04-T07） |
| 分支 | `feature/phase2-knowledge`（基于 main） |
| 需求来源 | docs/plans/PLAN-ai-capability-2026-10-10.md（Controlled Track，Phase 2 = T04-T07，风险 MEDIUM 6 分） |
| 类型 | feat |
| 涉及范围 | 后端（culture 域：回填管线 + 向量检索）+ 迁移（V7 tea_relations 种子）+ 评测观测（ragHitRate） |

## 二、需求与方案

### 需求描述

把八张文化表知识注入 `culture_chunks`（含向量嵌入），检索服务加向量分支提升 RAG 命中率，填充 `tea_relations` 知识图谱关系，评测报告新增 RAG 命中率观测。

### 验收标准（Given-When-Then）

- **T04** Given 库中已有八表数据，When `POST /api/v1/admin/culture/chunks/backfill?embed=false`，Then 200 + 全部行落 `culture_chunks`（status=pending、不调 AI API）
- **T04b** Given 重复调用，When 同上再次执行，Then 行数不变（uk_culture_chunks_source + ON CONFLICT 幂等）
- **T04c** Given 匿名请求，When 调 admin 端点，Then 401（/api/v1/admin/** 自动受鉴权保护）
- **T05** Given AI key 可用，When `backfill?embed=true`，Then status=ready + embedding 写入（1024 维对齐 V3 表）；无 key 时自动降级 pending（EmbeddingModel 不可用 → getIfAvailable 返回 null）
- **T05b** Given 向量通道可用，When 语义查询（ILIKE 全 miss），Then 经向量命中补位；embedding 调用失败 → 检索不中断、纯 ILIKE 降级
- **T06** Given src/data 四数据源，When 运行 generate-relations.mjs，Then V7 迁移 170 条（66 产于 + 66 工艺 + 38 相关人物，0 未匹配）
- **T07** Given 评测报告含 sources 观测，When aggregate，Then 输出 ragHitRate（sources 非空占比）+ ragHitRateByPath（默认/专家路径分开，防 chat 透明代理拉低口径）

### 技术方案

- **零 schema 改动**：culture_chunks 表已在 V3 建好（embedding vector(1024)/status/uk 唯一/HNSW 索引）；tea_relations 在 V1 已建
- **回填管线**：ChunkBackfillService 读 8 表（teas/people/regions/poems/teawares/etiquettes/relations/processes）逐行生成结构化 chunk_text（JSONB 字段 ::text 清洗）→ EmbeddingModel（ObjectProvider.getIfAvailable，无 key 自动降级）→ batch 10（text-embedding-v3 上限）→ upsert ON CONFLICT DO UPDATE（幂等可重跑补嵌）
- **管理端点**：AdminCultureController POST /api/v1/admin/culture/chunks/backfill?embed=...，显式触发防乱花钱；/admin/** 自动 401 保护
- **向量检索**：CultureSearchService 加 vectorHits（embed → culture_chunks `embedding <=> ?` 余弦距离 ≤ 0.45（sim ≥ 0.55）、仅 status='ready'、LIMIT 18）→ mergeLists 补位合并（ILIKE 优先、向量补位、按 name 去重、各类型 ≤5 契约不变）；relation 类型不进向量分支
- **V7 关系种子**：scripts/generate-relations.mjs 可复现生成（teas.origin 省前缀→产区 / teas.type↔工艺 teaType / TEA_MASTERS.relatedTeas slug→DB id 生成期映射）
- **评测观测**：eval-core.cjs aggregate 加 ragHitRate/ragHitRateByPath（null=无观测计未命中，空 runs=null）；eval-tea-ai.cjs printSummary 输出 RAG 命中率行

## 三、影响分析

| 维度 | 影响 |
|---|---|
| 数据模型 | V7 数据迁移（tea_relations 170 条种子，无 schema 变更；up/down 成对；tea_relations 无唯一约束，V7 为 Flyway 版本化单次执行） |
| API | 新增 POST /api/v1/admin/culture/chunks/backfill（管理端点，需鉴权）；检索接口契约不变（各类型 ≤5） |
| 前端 | 无改动（LibrarianAgent 经 CultureSearchService 自动受益向量分支） |
| 承重墙 | AI key disabled 时 embedding 不可用 → 检索降级纯 ILIKE（检索不中断）；回填无 key 落 pending 可重跑补嵌 |
| 回滚 | 迁移：rollback.sql（清 tea_relations）+ 清 culture_chunks 重填；代码：git checkout 前一 commit |

## 四、质量门禁（自检）

- [x] 编码规范红线零违反（分层单向 / 统一 ApiResponse / 管理端点鉴权 / SQL 参数化）
- [x] 编译 0 error（mvn -q compile -o）
- [x] 评测单测 32/32 pass（含 T07 三个新用例）
- [ ] 集成测试全绿（AdminCultureBackfill 401/无 key pending/幂等 + VectorBranch 语义命中/ILIKE 优先/降级/去重）
- [ ] 全量 mvn test
- [ ] node scripts/verify-harness.cjs ERRORS: []
- [x] V7 生成脚本 dry-run 抽检人工对照无误（170 条 0 未匹配）
- [ ] 真嵌入（backfill?embed=true）需 AI key 环境手动触发（费用计 D-5；本环境 key 未注入）

## 五、部署与观测

- [ ] 本地 Docker 集成测试验证（Testcontainers pgvector/pgvector:pg16）
- [ ] V7 迁移在真实库执行验证（本地 dev 库或 CI）
- [ ] 部署后观测：ragHitRate 字段随评测报告输出，验证 RAG 命中率 > 0
