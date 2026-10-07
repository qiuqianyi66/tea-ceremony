# M5 多智能体产品需求文档（PRD V2・企业级）

> 一盏茶 AI 茶灵多智能体体系产品级需求。对齐 
>
> `frontend-product-prd.md`
>
>  的企业级写法（角色 / 场景 / 功能域 GWT / 非功能矩阵 / 架构决策 / 演进扩展点）。
> 事实来源（只读核实）：
>
> `V1__init.sql`
>
> （13 表结构）、
>
> `CultureSearchService`
>
> （当前 4 表 ILIKE）、S1 代码（编排 /librarian/ 契约）、
>
> `PRD-spring-ai-refactor-v2.md §6`
>
> （M5 总设计）、
>
> `frontend-product-prd.md §6`
>
> （Token 存储决策）、
>
> `m1-ai-agent-s1.md`
>
> （S1 验收）。日期：2026-10-07。版本：V2.0（R1/R2 迭代后定稿）。

## 1. 背景与定位

「一盏茶」重构核心目标②：AI 从 "代理转发" 升级为**多智能体体系**（Orchestrator + 专家 + 工具 + 记忆 + 工作流）。这是项目差异化与简历门面的核心，非功能附加项。

当前进度：S1 已交付（意图路由骨架 + librarian 专家 + RAG 4 表 + 计量 + 契约；92 测试全绿，推送 47c4a81b）。本 PRD 覆盖 S1\~S4 全谱系，S2 起为实施依据。

## 2. 用户角色与核心场景



| 角色   | 画像      | 核心诉求                |
| ---- | ------- | ------------------- |
| 茶小白  | 入门，不懂术语 | 用大白话解释茶知识；推荐第一泡茶    |
| 茶爱好者 | 有基础，追体验 | 品鉴辅助（八维评分解释）；冲泡参数校准 |
| 老茶客  | 高要求     | 冷门知识 / 典故溯源；成长复盘    |
| 游客   | 未登录     | 体验式问答（无个人数据）        |

核心场景（端到端）：



1. **知识问答**：问 "陆羽是谁" → librarian 检索茶人 +《茶经》→ 回答带出处卡片 → 可追问

2. **荐茶**："我偏好清甜、预算不限" → advisor 结合画像推荐 2-3 款 + 理由

3. **品鉴辅助**：上传八维评分 → taster 解释口感曲线 + 对比历史均值

4. **冲泡指导**："这茶 90°C 泡多久" → brewer 按茶类参数表给步骤

5. **成长复盘**："我这周品鉴进步了吗" → mentor 读品鉴记录 + 画像，给阶段总结

6. **离线 / 无 key**：所有场景降级为规则引擎（teaAI.ts 承重墙，现状不变）

## 3. 现状事实（S1 已完成，S2 复用）



| 项         | 现状                                                                                          | 依据                  |
| --------- | ------------------------------------------------------------------------------------------- | ------------------- |
| 编排        | AgentOrchestrator：显式 agent / 关键词粗分 / 未知 400 / 回落透明代理                                        | S1 代码               |
| librarian | RAG 4 表（teas/tea\_people/tea\_regions/tea\_poems）ILIKE + 专家 prompt + sources                | S1 代码               |
| 契约        | `agent` 枚举（chat/advisor/taster/librarian/brewer/mentor）+ `sources?`                         | api-contract.md     |
| 计量        | AiUsageLogger 共用；ai\_usage\_logs 表含 prompt\_version 字段                                      | V1\_\_init.sql      |
| prompt 版本 | agent\_prompts 表已建（agent/version/content/status 唯一键），当前无数据                                  | V1\_\_init.sql      |
| 知识库规模     | 文化表百条级（teas 66 条实测）；8 表可进 RAG（还有 teawares/tea\_etiquettes/tea\_relations/tea\_processes 未用） | V1\_\_init.sql + 冒烟 |

## 4. 功能域需求（Given-When-Then）

### F-M5-1 意图编排（S1 基线 + S2 强化）



* Given `agent=librarian`，Then 路由 librarian 专家（现状）。

* Given 无 agent 且含文化意图关键词，Then 命中 librarian（现状）。

* Given 未知 agent 值，Then 400 PARAM\_INVALID（现状）。

* Given S2 后新增 advisor/taster/brewer/mentor 注册，Then 编排器按 "显式 agent > 意图分类 > 回落透明代理" 三优先序路由，意图分类错误可配置降级（不因误判阻断对话）。

* Given 多专家意图并存（如 "推荐一款茶并讲讲产地"），Then S3 Graph 编排拆分任务；S2 阶段先回落单一专家（advisor）。

### F-M5-2 知识专家 librarian（S1 基线 + S2 升级）



* Given 用户提问，Then 流程 = 意图解析 → 混合检索（见 F-M5-3）→ 专家 prompt → LLM 生成 → 回复附来源（现状 sources + S2 引用卡片）。

* Given 检索空，Then 通用茶文化常识回答 + 明确 "知识库未命中"（现状）。

* Given LLM 不可用，Then 502 降级链（承重墙不变，现状）。

* Given S2 后，Then 检索覆盖 **8 表**（+teawares/tea\_etiquettes/tea\_relations/tea\_processes），来源类型扩展（茶 / 人 / 产区 / 诗 / 茶器 / 茶礼 / 关系 / 工艺）。

* Given S2 后，Then 回答可带**引用卡片**（前端 F-M5-7）：命中条目 → 可点击查看详情页。

### F-M5-3 混合检索（S2 核心）



* Given 提问 "茶圣是谁"，Then 结果同时含：pg\_trgm 关键词命中（"茶" 相关）+ pgvector 语义命中（"茶圣"→陆羽），合并排序返回 top-k。

* Given 知识库百条级，Then 检索 P99 < 200ms（本地 PG 实测为准，作为性能基准）。

* Given 新增 / 修改文化条目，Then 触发 embedding 回填（异步任务，条目级增量，幂等）。

* Given embedding 服务不可用，Then 自动降级纯 pg\_trgm/ILIKE（检索不中断）。

### F-M5-4 五专家扩容（S2 分批注册）



| 专家              | 能力               | 输入             | 工具（S2 起）                      | 降级            |
| --------------- | ---------------- | -------------- | ----------------------------- | ------------- |
| advisor 荐茶师     | 按画像 / 偏好荐茶 2-3 款 | 画像 + 偏好 + 历史品鉴 | 检索 teas / 品鉴记录                | 无画像时按茶类常识推荐   |
| taster 品鉴师      | 解释八维评分、对比历史      | 当前评分 + 历史均值    | 检索 tasting\_records           | 无历史则单次解读      |
| librarian 茶文化学者 | 知识问答带出处          | 提问             | 混合检索 8 表                      | 无 key 502（现状） |
| brewer 冲泡师      | 参数校准、步骤指导        | 茶名 / 茶类 + 当前参数 | 检索 teas 冲泡字段 + tea\_processes | 按茶类默认参数       |
| mentor 成长导师     | 阶段总结、目标建议        | 品鉴记录 + 画像      | 聚合 tasting\_records/users     | 数据不足时通用建议     |



* Given 任一专家所需数据缺失，Then 用公开常识回答并标注 "无个人数据，通用建议"（不静默编造）。

* Given 专家调 LLM 失败，Then 502 降级链（统一）。

### F-M5-5 会话记忆（S2 新表）



* Given 用户登录对话，Then 会话按 `ai_chat_sessions`（user\_id + 主题）+ `ai_messages`（role/content/agent/token 数）落库，支持跨天追问上下文。

* Given 游客（未登录），Then 不落会话记忆（隐私），仅计量（现状）。

* Given 对话含敏感信息，Then 不写入 messages 内容（仅存结构化占位），详见 §7 安全。

* Given 用户主动删除，Then 级联删除会话及其消息（用户控制权）。

### F-M5-6 计量与成本（M2 消费端 + S2 补全）



* Given 每次 LLM 调用成功，Then 落 `ai_usage_logs`（现状含 prompt\_version 字段待 S2 填充）。

* Given 当日 / 当月 token 超预算阈值，Then 后端日志告警 + 可选前端提示（阈值可配置，默认低档：每日 5 万 token）。

* Given 管理员查看用量，Then 提供汇总接口（按日 /agent/user 维度，M2 拍板项）。

### F-M5-7 前端适配（S2 后置）



* Given 用户选中知识引用卡片，Then 跳转对应详情页（/tea/:id、茶人 / 产区详情路由）。

* Given 长回答（>800 字），Then SSE 流式输出（S3/S4 里程碑）。

* Given 前端不传 `agent` 参数，Then 非文化问题走透明代理（行为与 T11 一致）；文化问题由后端关键词粗分自动路由 librarian，响应含 `sources` 字段 —— 旧前端忽略该字段（兼容），S4 前端读取并渲染引用卡片。

## 5. 非功能需求矩阵



| 维度  | 要求                                                       | 验收判据                  |
| --- | -------------------------------------------------------- | --------------------- |
| 安全  | 内容安全过滤（敏感 / 越狱）、SQL 参数化（现状）、不落游客隐私、会话删除控制权               | 检索与 LLM 全部参数化；敏感内容不落库 |
| 性能  | 检索 P99 < 200ms；聊天首字延迟 ≤ 2s（无 key 时 502 即时返回）             | 本地基准测试记录              |
| 成本  | 每日 token 预算可配置 + 告警；embedding 增量回填不重复计费                  | 预算超限日志出现即通过           |
| 可用性 | 无 key/embedding 失败 / 检索空 → 逐级降级不白屏                       | 三级降级链路测试              |
| 可维护 | 专家 prompt 版本化（agent\_prompts 表）；编排规则集中（Orchestrator 单文件） | prompt 灰度 / 回滚可执行     |
| 可扩展 | 新专家注册 = 新增 AgentType + 注册类 + 路由条目；新知识表 = 进检索清单           | 30 分钟内可加一个专家（文档化步骤）   |
| 合规  | 无外发（现状承诺）；不调用第三方 AI（承重墙）；AI 内容带来源标注                      | 前端直连第三方 AI 代码为零       |

## 6. 架构决策（ADR 候选，S2 开工前正式落 ADR）



| 决策           | 选项                                       | 结论                                | 理由                        |
| ------------ | ---------------------------------------- | --------------------------------- | ------------------------- |
| D1 检索        | ILIKE / **pgvector+pg\_trgm 混合** / 独立向量库 | **pgvector 混合（PG16 原生扩展，零新基础设施）** | 知识库百条级；语义召回收益明确；独立向量库运维过重 |
| D2 向量索引      | IVFFlat / HNSW                           | **HNSW**（数据量小，查询快，构建成本低）          | 百条级 HNSW 毫秒级，无需分区         |
| D3 embedding | 百炼 text-embedding-v3（与 DashScope 同 key）  | **采用**（维度实现时核实并登记）                | 同一生态 / 同一 key / 无额外供应商    |
| D4 编排演进      | 单专家 → Supervisor → Graph                 | **S2 单专家路由，S3 引入 graph-core**     | 最小切片先行，工作流复杂度后置           |
| D5 prompt 版本 | 内置常量（S1）/ **agent\_prompts 表**           | S2 迁表：内容读表，缺失回退内置常量               | 灰度 / 回滚能力，表已建零迁移          |

## 7. 数据模型（S2 新表 DDL 草案，Flyway V2）



```
-- culture_chunks（知识切块 + 向量；S2 Flyway V2 上）
CREATE TABLE culture_chunks (
    id           INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    source_type  VARCHAR(20)  NOT NULL,   -- tea/person/region/poem/teaware/etiquette/relation/process
    source_id    INTEGER      NOT NULL,
    chunk_text   TEXT         NOT NULL,
    metadata     JSONB        NOT NULL DEFAULT '{}'::jsonb,  -- 茶类/朝代/产区过滤
    embedding    vector(1024),
    status       VARCHAR(20)  NOT NULL DEFAULT 'pending',     -- pending/embedded/failed
    created_at   TIMESTAMP NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_culture_chunks_source ON culture_chunks (source_type, source_id);
CREATE INDEX ix_culture_chunks_status ON culture_chunks (status);
-- 向量索引（HNSW）就绪后：CREATE INDEX ... USING hnsw (embedding vector_cosine_ops);

-- ai_chat_sessions（会话头）
CREATE TABLE ai_chat_sessions (
    id         INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    topic      VARCHAR(100),
    agent      VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
-- ai_messages（消息体；游客不落）
CREATE TABLE ai_messages (
    id         INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    session_id INTEGER NOT NULL,
    role       VARCHAR(20) NOT NULL,
    content    TEXT,
    agent      VARCHAR(50),
    tokens     INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
```



* 约束：embedding 维度对齐模型输出；`status` 驱动回填任务；幂等（source\_type+source\_id 唯一）。

* 迁移纪律：V2 前写 ADR + `db-migrations.sql`/`rollback.sql` 成对 + upgrade/downgrade 往返测试（AGENTS.md §8）。

## 8. 知识库数据治理



| 项  | 规则                                                                |
| -- | ----------------------------------------------------------------- |
| 来源 | 文化数据沿用旧 FastAPI 种子数据（V1 迁移已有）；新增条目须有出处（书籍 / 文献 / 权威站点），无出处标 "待核实" |
| 质量 | 条目级校验：不编造茶名 / 茶器 / 历史人物；六大茶类分类与冲泡参数符合茶类常识（tea-tasting 基准表）        |
| 更新 | 走 Flyway 数据迁移（L3 纪律：up/down 成对 + 往返测试）；embedding 随迁移增量回填          |
| 审核 | 文化内容 AI 生成物不直接入库；人工 / 种子来源为准                                      |

## 9. 里程碑



| 里程碑 | 内容                                                                    | 状态              |
| --- | --------------------------------------------------------------------- | --------------- |
| S1  | 编排骨架 + librarian + RAG 4 表 + 契约                                       | ✅ 已交付（47c4a81b） |
| S2  | 混合检索（pgvector 迁移 + 8 表 RAG + embedding 管线）+ 五专家注册 + 会话记忆 + prompt 版本化 | 本 PRD 依据        |
| S3  | Supervisor/Graph 协作（graph-core）+ SSE 流式                               | 预留              |
| S4  | 前端 agent 参数 + 引用卡片 + 流式 UI                                            | 预留              |

## 10. 验收清单（PRD 级自检）



* [x] 用户角色 / 场景覆盖（小白 / 爱好者 / 老茶客 / 游客 + 6 场景）

* [x] 功能域 GWT 可测（F-M5-1\~7）

* [x] 非功能矩阵含安全 / 性能 / 成本 / 可用性 / 可维护 / 可扩展 / 合规

* [x] 架构决策带理由（D1\~D5 已前置）

* [x] 数据模型 DDL 草案 + 迁移纪律

* [x] 知识库数据治理（来源 / 质量 / 更新 / 审核）

* [x] 现状事实只读核实（13 表 / 8 表 RAG 扩展点 /agent\_prompts 复用）

* [x] 与前端 PRD / 工程规范衔接（引用卡片 / 扩展点）

* [x] 明确不做（Graph 工作流、SSE、前端适配后置 S3/S4）