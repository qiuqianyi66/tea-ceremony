---
last_updated: 2026-10-07
status: active
owner: yanha
---

# 数据层产品需求文档（PRD V2 · 企业级）

> 「一盏茶」数据层（PostgreSQL + Flyway + 离线 IndexedDB + 缓存）产品级需求。对齐 `frontend-product-prd.md` / `m5-agent-product-prd.md` 的企业级写法。
> 事实来源（只读核实）：`V1__init.sql`（13 表全结构）、`application.yml`（Flyway/ddl-auto 红线/Redis ADR-012）、`docker-compose.yml`（pg 16-alpine/pgdata 卷）、`AGENTS.md §3/§8`（同步/迁移纪律）、M5 PRD（S2 新表）。日期：2026-10-07。版本：V2.0（R1/R2/R3 迭代后定稿）。

## 1. 背景与定位

数据层是全部业务的地基：前端离线优先（Dexie/IndexedDB + sync_status 状态机）、后端 Spring Boot + PostgreSQL 16（schema 完全由 Flyway 治理，红线 ddl-auto: validate）、缓存两级（Caffeine L1 + Redis L2，ADR-012）、AI 数据（计量/知识检索/记忆）。本 PRD 管数据域的**结构、迁移、质量、生命周期**，让后续切片（M2 消费端、S2 向量检索、茶园）都有数据契约可依。

## 2. 用户与业务场景（数据消费视角）

| 消费方 | 场景 | 数据需求 |
|---|---|---|
| 前端（离线 PWA） | 断网冲泡/品鉴，联网后同步 | IndexedDB 镜像业务子集；sync_status 状态机；toRaw 防 DataCloneError |
| 品鉴闭环 | 八维评分 × 工艺系数（可解释） | tasting_records 幂等键（user_id+client_id）；维度 JSONB |
| AI 茶灵（M5） | 知识问答/荐茶/复盘 | 8 表文化数据 + culture_chunks 向量（S2）+ 会话记忆（S2）+ 计量 |
| 成长体系 | level/xp 演进、mentor 复盘 | users 画像字段 + tasting_records 聚合 |
| 茶园（待 PRD） | 种植/收获 | garden_plants（表已建，字段最小集待确认） |
| 运维/财务 | 成本审计、备份恢复 | ai_usage_logs 计量 + pgdata 卷 + 备份脚本 |

## 3. 现状事实（只读核实）

| 项 | 现状 | 依据 |
|---|---|---|
| 引擎 | PostgreSQL 16-alpine（docker-compose），pgdata 卷持久化 | docker-compose.yml |
| 迁移 | Flyway（locations=classpath:db/migration），V1 已建 13 表；红线 ddl-auto: validate | application.yml + V1__init.sql |
| 表清单 | users/tea_regions/tea_processes/teas/tea_people/tea_poems/teawares/tea_etiquettes/tea_relations/tasting_records/garden_plants/agent_prompts/ai_usage_logs | V1__init.sql |
| 幂等 | tasting_records + garden_plants 均 uk(user_id, client_id) | V1__init.sql |
| AI 数据 | ai_usage_logs（含 prompt_version 列，待 S2 填充）；agent_prompts uk(agent, version) 已建无数据 | V1__init.sql |
| 缓存 | ADR-012 已定：Caffeine L1 + Redis L2；M2 落地 JWT 黑名单/两级缓存 | ADR-012 |
| 知识数据 | 8 张文化表可进 RAG（teas/tea_people/tea_regions/tea_poems/teawares/tea_etiquettes/tea_relations/tea_processes），当前 RAG 用 4 表；teas 66 条实测 | CultureSearchService + 冒烟 |
| 安全 | hashed_password BCrypt；敏感配置走环境变量；无外发承诺 | 编码规范 + application.yml |

## 4. 功能域需求（Given-When-Then）

### F-D1 表结构与迁移治理

- Given 任一 schema 变更，Then 走 Flyway 新版本迁移（V{n}），up/down 成对，禁 ddl-auto: update（红线 #7）。
- Given L3 变更（新表/改表），Then 先写 ADR 到 docs/ADR/ + `db-migrations.sql`/`rollback.sql` 成对 + upgrade/downgrade 往返测试。
- Given 迁移失败，Then Flyway 事务回滚到上一版本，应用不启动（fail-fast），日志给出版本号与原因。

### F-D2 数据一致性与幂等

- Given 前端离线写入，Then IndexedDB 记录带 `sync_status`（pending/synced/failed），联网后按状态机重放，写入前 `toRaw` 去代理。
- Given 重复提交（用户双击/重试），Then 幂等键（user_id+client_id）拒重，返回既有记录。
- Given 外键引用（teas→regions/processes、records→users/teas/teawares），Then 约束兜底，禁孤儿行。

### F-D3 AI 数据支撑（S1 已用 + S2 扩展）

- Given 每次 LLM 成功调用，Then 落 `ai_usage_logs`（agent/model/tokens/latency/prompt_version；游客 user_id 空）。
- Given S2，Then 新增 `culture_chunks`（知识切块 + vector(1024) + 元数据过滤 + status 驱动回填）+ `ai_chat_sessions`/`ai_messages`（登录用户会话记忆；游客不落）。
- Given prompt 上线，Then `agent_prompts` 按 (agent, version) 登记，status 区分 draft/active；回滚 = 切换 active 版本。
- Given 检索请求，Then 走混合检索（pg_trgm 关键词 + pgvector 语义，HNSW 索引），embedding 服务不可用自动降级纯关键词（检索不中断）。

### F-D4 离线与同步

- Given 断网，Then 业务核心（冲泡/品鉴/茶园）可离线完成，数据落 Dexie。
- Given 联网，Then pending 记录按序同步（单飞/防重），失败转 failed 可重试，不阻塞新写入。
- Given 离线数据与服务器冲突，Then 客户端版本号/时间戳策略（同物同策略：具体冲突规则在对应业务 PRD 定，数据层提供字段承载）。

### F-D5 数据质量

- Given 文化数据新增/修改，Then 走 Flyway 数据迁移，来源可溯（书籍/文献/权威站点），无出处标"待核实"；AI 生成物不入库。
- Given 茶数据写入，Then 分类按六大茶类、冲泡参数符合茶类常识（tea-tasting 基准表）；不编造茶名/茶器/历史人物。

### F-D6 备份与恢复

- Given 数据备份任务，Then pgdata 卷快照或 pg_dump 定期执行（保留周期策略：日备份 ≥7 天），恢复演练可验证。
- Given 误删/损坏，Then 按备份恢复，恢复到最近一致点，并记录恢复操作日志。

## 5. 非功能需求矩阵

| 维度 | 要求 | 验收判据 |
|---|---|---|
| 安全 | 密码 BCrypt；敏感配置环境变量；无外发；个人数据最小化（游客不落会话） | 库内无明文密码；密钥零入库 |
| 性能 | 查询走索引（唯一/外键/高频过滤列）；检索 P99 < 200ms；分页防深翻 | EXPLAIN 审查 + 基准记录 |
| 完整性 | 外键/约束/check 兜底；JSONB 只放无固定 schema 数据（口味/评分/步骤） | 迁移含约束定义 |
| 可维护 | 迁移版本化 + 注释；COMMENT ON 表级说明；命名规范 ix_/uk_/fk_ | 新表必带 COMMENT + 索引 |
| 可扩展 | 新业务表按 F-D1 纪律进 Flyway；向量/缓存能力预留（pgvector/Redis） | 30 分钟内新表走完迁移流程（文档化） |
| 合规 | 用户数据删除控制权（会话级联删除）；计量数据保留期可配置 | 删除接口可验证 |

## 6. 架构决策（ADR 状态登记）

| 决策 | 结论 | 状态 |
|---|---|---|
| D1 引擎 | PostgreSQL 16（现状保持，不换库） | 已定（V1） |
| D2 迁移 | Flyway + up/down 成对 + ddl-auto: validate | 红线 #7 已定 |
| D3 缓存 | Caffeine L1 + Redis L2（4 真实场景） | ADR-012 Accepted |
| D4 向量检索 | pgvector + pg_trgm 混合（同库扩展，HNSW） | ADR 候选（S2 开工前落 ADR-013） |
| D5 离线 | Dexie IndexedDB + sync_status 状态机 | 已定（架构边界） |
| D6 备份 | pg_dump/pgdata 快照 + 保留周期 | 待 DEPLOY 完善（低优先） |

## 7. 数据模型速查（13 表现状 + S2 新增）

| 表 | 用途 | 关键约束 |
|---|---|---|
| users | 账户/画像（level/xp/preferred_*） | uk_username；hashed_password |
| teas / tea_regions / tea_processes | 茶主表/产区/工艺 | fk 关联；category 索引 |
| tea_people / tea_poems | 茶人/诗词 | related_tea_ids JSONB |
| teawares / tea_etiquettes / tea_relations | 茶器/茶礼/关系图谱 | 待 RAG 纳入（S2） |
| tasting_records | 品鉴（八维 JSONB × 工艺系数） | uk(user_id, client_id) 幂等 |
| garden_plants | 茶园（最小集待确认） | uk(user_id, client_id) 幂等 |
| agent_prompts | prompt 版本（灰度/回滚） | uk(agent, version) |
| ai_usage_logs | 计量（含 prompt_version） | created_at 索引（每日统计） |
| culture_chunks（S2） | 知识切块 + vector(1024) + metadata + status | 向量 HNSW 索引；source 唯一 |
| ai_chat_sessions / ai_messages（S2） | 会话记忆（登录用户） | session 外键级联；游客不落 |

字段规范：ID 自增；时间戳 now()；JSONB 仅无固定 schema 场景；命名 `ix_/uk_/fk_{table}_{col}`；新表必带 COMMENT ON。

## 8. 数据生命周期

```
生产（Flyway 种子/迁移） → 使用（读路径：JPA/混合检索/缓存） → 维护（备份/恢复/保留期） → 治理（质量审核/删除控制）
       ↑__________________（L3 变更回流：ADR + 迁移 + 往返测试）__________________↓
```

## 9. 验收清单（PRD 级自检）

- [x] 消费方/场景覆盖（离线/品鉴/AI/成长/茶园/运维）
- [x] 功能域 GWT 可测（F-D1~D6）
- [x] 非功能矩阵含安全/性能/完整性/可维护/可扩展/合规
- [x] 架构决策状态登记（D1~D6，含 ADR 引用）
- [x] 数据模型速查（13 表现状 + S2 新增，约束齐全）
- [x] 现状事实只读核实（V1 表/application.yml/ADR-012/compose）
- [x] 生命周期闭环（生产→使用→维护→治理）
- [x] 明确后置（茶园字段确认/备份策略细化/D6 低优先）
