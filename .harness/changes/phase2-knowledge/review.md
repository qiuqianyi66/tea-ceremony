# phase2-knowledge 评审记录（expert-reviewer，T04-T07）

> 评审对象：feature/phase2-knowledge 全部变更文件（git diff 基线 = main@7f2ab76）。
> 结论：**通过 —— 🔴 0 / 🟡 0 / 🟢 3 / 🔵 1**（🟢🔵 不阻塞，记录备查）

## 变更文件清单（全量覆盖）

| 类别 | 文件 |
|---|---|
| 迁移/脚本 | `backend/src/main/resources/db/migration/V7__tea_relations_seed.sql`（170 条）、`scripts/generate-relations.mjs`、`.harness/changes/phase2-knowledge/{db-migrations,rollback,summary}.{sql,md}` |
| 后端 culture 域 | `culture/service/ChunkBackfillService.java`（新建：8 表回填 + 嵌入 + upsert 幂等 + 降级）、`culture/controller/AdminCultureController.java`（新建：POST /api/v1/admin/culture/chunks/backfill）、`culture/service/CultureSearchService.java`（修改：向量分支 vectorHits + mergeLists 补位） |
| 后端配置 | `application.yml`（embedding model 配置，AI_EMBEDDING_MODEL:text-embedding-v3） |
| 评测观测 | `scripts/eval-core.cjs`（aggregate 加 ragHitRate/ragHitRateByPath）、`scripts/eval-tea-ai.cjs`（printSummary 输出）、`scripts/tests/eval-core.node-test.cjs`（+3 单测） |
| 测试 | `culture/AdminCultureBackfillIntegrationTest.java`（3：401/降级 pending/幂等）、`culture/CultureSearchVectorBranchIntegrationTest.java`（4：语义命中/ILIKE 优先/降级/去重） |

## 六维评审

### 1. 正确性 ✅
- 回填管线：8 表 327 行（teas 66/people 21/regions 19/poems 25/wares 6/etiquettes 14/relations 170/processes 6）逐行生成 chunk_text；JSONB 字段 `::text` + cleanJson 清洗，无类型转换错误（集成测试 perType 全量断言）
- 嵌入降级：EmbeddingModel 经 ObjectProvider.getIfAvailable() 获取，无 key 时 bean 存在但调用抛异常 → catch → 全 pending 落库（集成测试断言 embedded=0/pending=327/embedStatus=degraded，真实库验证）
- **计数语义**：embedded=「有向量且落库成功」，pending=「未嵌入或落库失败」——修复过计数错位（pending 落库被误计 embedded）与降级不落库两个 bug（集成测试锁死）
- 幂等：uk_culture_chunks_source + ON CONFLICT DO UPDATE，重复执行行数不变（集成测试锁死）
- 向量检索：`embedding <=> ?::vector` 显式 cast（float[] 无法直接绑定 vector 参数——修复过导致检索恒降级的 bug）；阈值 ≤ 1-0.55=0.45、仅 status='ready'、LIMIT 18；ILIKE 优先 + 向量补位 + 按 name 去重 + 各类型 ≤5 契约不变（4 个向量分支集成测试锁死）
- V7 关系种子：generate-relations.mjs 从 src/data 推导 170 条（66 产于 + 66 工艺 + 38 相关人物），0 未匹配；抽检 5 条人工对照无误；provinceShort 处理民族自治区后缀（广西壮族→广西）
- RAG 命中率观测：ragHitRate 按 sources 非空占比、null 计未命中、空 runs=null；分路径 defaultPath/expertPath 防 chat 透明代理拉低口径（3 个单测锁死）

### 2. 性能 ✅
- 嵌入批量 10（text-embedding-v3 官方上限），327 行 = 33 批；失败单批降级不影响已成功批次
- 向量检索走 HNSW `vector_cosine_ops` 索引（V3 已建），LIMIT 18 上限防全表距离计算
- ILIKE 关键词检索未变（原 splitKeywords + 参数化），向量分支只在关键词 miss 时补位
- 管理端点显式触发（POST + embed 参数），无定时/自动调用，防意外费用

### 3. 安全 ✅
- SQL 注入：JdbcTemplate 全参数化（`?` 绑定），无字符串拼接；向量参数经 `?::vector` cast 仍是参数绑定
- 越权：/api/v1/admin/** 不在 SecurityConfig permitAll 白名单 → 匿名 401（集成测试锁死）；/api/v1/culture/** 与 /api/v1/ai/chat 白名单未变
- 敏感信息：不读 .env；AI key 仅经环境变量注入；回填端点不返回 chunk 原文（只返回计数统计）
- 降级不中断：EmbeddingModel 调用失败 → 纯 ILIKE 检索照常（data-layer-product-prd 硬要求，集成测试锁死）

### 4. 一致性 ✅
- 零 schema 改动：culture_chunks 表（V3 已建）与 tea_relations（V1 已建）均复用既有结构，embedding vector(1024) 对齐 text-embedding-v3
- V7 与 .harness/changes/phase2-knowledge/db-migrations.sql 内容一致（生成脚本同一输出）；rollback.sql 成对
- 检索接口契约不变：/api/v1/culture/search 响应结构、各类型 ≤5、字段命名均未变（CultureSearchIntegrationTest 7/7 回归通过）
- 评测口径与既有 programOnly/judgeCoverage 同哲学（口径分开算），报告字段命名 ragHitRate/ragHitRateByPath 一致
- embedStatus 语义与数据一致（degraded=全部降级，partial=部分降级，ready=全成功）——修复过「bean 存在即标 ready」的失真

### 5. 可维护性 ✅
- V7 由 generate-relations.mjs 可复现生成（dry-run/--write 双模式），禁止手写 INSERT；生成器内记录全部映射决策（省前缀/茶类匹配/slug→id 生成期映射）
- ChunkBackfillService 单一职责：collectDrafts（读 8 表）→ embed（批量+降级）→ upsert（幂等）；记录 ChunkDraft/BackfillResult 明确
- CultureSearchService 向量分支与关键词分支同文件内聚，mergeLists 泛型复用；关系类型不进向量分支（数据量小 + RelationItem 元数据不足，注释说明）
- 集成测试模式与既有 CultureSearchIntegrationTest/AuthIntegrationTest 一致（Testcontainers + register→token）；测试查询词刻意避开真实种子词（防 ILIKE 撞车假阳性）
- 测试含 mock 自检 + provider 接线断言（防假阳性：mock 未生效时降级断言全无意义）

### 6. 架构合规 ✅
- 分层单向：Controller（仅参数/响应）→ Service（业务）→ JdbcTemplate（数据）；AdminCultureController 无业务逻辑
- 统一 ApiResponse + BusinessError 体系；新端点复用全局异常处理
- 承重墙：AI 不可用降级链（检索不中断、回填落 pending）完整保留并回归
- Flyway 迁移成对（V7 up / rollback.sql down）；tea_relations 无唯一约束、V7 为版本化单次执行（幂等说明写入文件头）
- 管理端点显式触发（防乱花钱）符合「AI 调用必须可观测可节制」原则

## 分级问题

### 🟢 次要（记录，不阻塞）
1. `mergeLists` 去重按 name 字符串：同名不同实体（罕见）会合并；当前数据无此情况，未来若出现需加 id 维度
2. 向量阈值 VECTOR_MIN_SIM=0.55 为经验值：真嵌入上线后按 ragHitRate 观测校准（T07 已提供观测手段）
3. `vectorToPg` 在 ChunkBackfillService 与 CultureSearchService 各有一份（private 方法）：同 8 行，抽公共 util 属可选重构，本切片不动（避免顺手重构）

### 🔵 提示（不阻塞）
1. Mockito inline mock maker 警告（JDK 21 建议 agent）：测试已通过，CI 若遇 flaky 再按警告接入 agent

## 自检清单

- [x] 6 维全覆盖
- [x] 🔴 零残留、🟡 清零
- [x] 评审记录已落盘（本文件）
- [x] 变更文件全量覆盖（无遗漏）
- [x] 测试证据：culture 集成 14/14 + 全量 218/218 + eval-core 32/32 + 编译 0 error
