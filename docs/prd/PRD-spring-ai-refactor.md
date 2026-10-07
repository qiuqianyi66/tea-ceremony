---
last_updated: 2026-10-06
status: active
owner: yanha
---

# 「一盏茶」重构 PRD — Spring Boot + Spring AI Alibaba 版

> 版本：v0.1（草案，待评审）
> 日期：2026-10-04
> 状态：Draft — 待用户确认后进入设计阶段
> 方法论来源：oh-my-claudecode（OMC）团队流水线 + oh-my-opencode-slim 多智能体编排理念

---

## 0. 文档速览

| 项 | 内容 |
|---|---|
| 项目 | 一盏茶（沉浸式在线茶道应用） |
| 重构范围 | **后端全部重写**（FastAPI → Spring Boot + Spring AI Alibaba）；前端保留并适配；数据库沿用 PostgreSQL 并扩展 |
| 核心目标 | ① 技术含金量升级（Java 企业级 + 阿里云 AI 生态）② AI 从"代理转发"升级为"多智能体体系" ③ 达到可上线、可展示、可开源的高水准 |
| 模型栈 | 通义千问系列（qwen-max / qwen-plus / qwen-flash）+ 百炼 RAG + 向量检索 |
| 当前阶段 | 需求分析（PRD）→ 待评审 → 架构设计 → 开发 |

---

## 1. 背景与动机

### 1.1 现状（已读代码核实）

**前端（保留）**：Vue 3.5 + Pinia 4 + Tailwind 4 + TresJS 5.8/Three 0.185 + Dexie（离线优先 PWA），ECharts/Chart.js 可视化，3D 茶席，业务闭环完整（入席→选茶→备器→煮水→冲泡→品鉴→成长）。

**后端（重写）**：FastAPI + SQLAlchemy 2.0 async + PostgreSQL + Alembic，JWT 认证，限流/熔断/Sentry/Prometheus 已具备生产意识。AI 现状：**仅做代理转发**——3 个端点（recommend/note/chat）把请求转发给 DeepSeek，RAG 是 SQL `ILIKE` 关键词检索（非向量），无记忆、无工具调用、无多智能体。

### 1.2 重构动机

1. **技术栈档次**：FastAPI 单文件脚本式 → Spring Boot 企业级框架，Java 生态、Spring Security、可观测性、社区成熟度，是主流企业技术栈，简历与开源展示价值更高。
2. **AI 能力代差**：现有 AI 只是"套壳聊天"，Spring AI Alibaba 1.0 提供 ChatModel/RAG/Function Calling/MCP/Graph 多智能体全套能力，可把「一盏茶」的 AI 从"回复生成器"升级为"茶道专家团队"。
3. **生产级增强**：Spring 生态自带 Actuator、Micrometer、Spring Security、事务管理、连接池、测试框架，比手工拼装更稳。
4. **不计成本**：用户明确投入不限，优先质量、可展示性、完备性。

### 1.3 非目标（明确不做）

- 不重写前端（保留 Vue 3.5 现有代码与设计系统）
- 不迁移历史用户数据（重构后数据库重新初始化，视为全新部署；保留表结构设计复用）
- 不做移动端原生 App（维持 PWA）
- 不引入微服务拆分（单体 Spring Boot 足够，避免过度工程）
- 不替换 PostgreSQL（沿用，扩展向量能力）

---

## 2. 技术选型（已调研核实）

| 决策点 | 选择 | 依据 |
|---|---|---|
| 后端框架 | **Spring Boot 3.5.x** | Spring AI Alibaba 1.1.2.0 官方兼容 Spring Boot 3.5.x（查证自 java2ai.com 版本说明）；Spring Boot 4/Spring AI 2.0 已发布但 SAA 尚未主推适配，风险高，不选 |
| AI 框架 | **Spring AI Alibaba 1.1.2.0**（当前推荐版） | 官方版本表标注"当前推荐"；支持 Agent Skills、Supervisor、Routing 多智能体；集成百炼平台、RAG、MCP、可观测 |
| 依赖管理 | `spring-ai-alibaba-bom` + `spring-ai-bom` + `spring-ai-alibaba-extensions-bom` | 官方 BOM 统一版本，避免冲突 |
| 模型 | 通义千问：`qwen-max`（主推理）、`qwen-plus`（均衡）、`qwen-flash`（低成本快）；Embedding：`text-embedding-v3` | 百炼平台官方模型 |
| 向量库 | **pgvector**（PostgreSQL 扩展） | 沿用现有 PG，避免引入新存储；茶文化数据量级（数百文档）pgvector 足够 |
| 认证 | Spring Security + JWT | 保留现有前端登录交互不变 |
| 构建 | Maven（或 Gradle，二选一待设计阶段定） | Java 生态标准 |
| 部署 | 先本地可运行 + Docker Compose 备选；上线形态待定（Windows 服务 / 云主机） | 与现有部署策略衔接 |
| 观测 | Spring Boot Actuator + Micrometer + 可选 Langfuse/ARMS | SAA 官方支持 |

### 2.1 版本兼容要点（查证自官方文档）

- SAA 1.1.2.0 基于 **Spring AI 1.1.2 + Spring Boot 3.5.x**，JDK 17+（建议 JDK 21 LTS）
- 核心组件：`spring-ai-alibaba-agent-framework`（ReactAgent/多智能体/Hooks/Skills）、`spring-ai-alibaba-graph-core`（图工作流）、`spring-ai-alibaba-starter-dashscope`（模型接入）、`spring-ai-alibaba-studio`（嵌入式调试 UI）、`spring-ai-alibaba-starter-graph-observation`（可观测）
- 官方示例：chatbot / deepresearch / documentation（github.com/alibaba/spring-ai-alibaba/tree/main/examples）

---

## 3. 目标架构

### 3.1 分层总览（示意）

```mermaid
flowchart TB
    subgraph client["浏览器 PWA（保留）"]
        views["Vue 3.5 视图层"]
        stores["Pinia 状态"]
        services["services/（http / storage / scoring / teaAI）"]
    end

    subgraph server["Spring Boot 3.5 后端（全新）"]
        api["REST API 层（Controller）"]
        biz["Service 业务层（认证/茶叶/品鉴/文化/旅程）"]
        ai["AI 层：茶灵多智能体"]
        aiorch["Orchestrator 编排器"]
        ag1["@荐茶师 advisor"]
        ag2["@品鉴师 taster"]
        ag3["@茶文化学者 librarian"]
        ag4["@冲泡教练 brewer"]
        ag5["@成长导师 mentor"]
        rag["RAG 检索（pgvector）"]
        mem["记忆服务（短期/长期）"]
        graph["Graph 工作流"]
        api --> biz
        api --> ai
        ai --> aiorch
        aiorch --> ag1 & ag2 & ag3 & ag4 & ag5
        ag3 --> rag
        aiorch --> mem
        ai --> graph
        biz --> db[(PostgreSQL + pgvector)]
        rag --> db
    end

    subgraph cloud["阿里云百炼"]
        qwen["qwen-max / plus / flash"]
        emb["text-embedding-v3"]
    end

    services --> api
    ai --> qwen
    rag --> emb
```

### 3.2 与旧后端差异对照

| 维度 | 旧（FastAPI） | 新（Spring Boot + SAA） |
|---|---|---|
| AI 调用 | httpx 转发 DeepSeek | ChatModel 抽象 + 多模型路由 + 流式 |
| RAG | SQL ILIKE 关键词 | 向量检索 pgvector + Embedding + Advisor |
| 智能体 | 无 | Orchestrator + 5 个角色（ReactAgent / Supervisor） |
| 工具调用 | 无 | Function Calling（查茶叶库、查品鉴记录、查天气等） |
| 记忆 | 无 | ChatMemory 短期 + 用户画像长期 |
| 工作流 | 无 | Graph（荐茶流水线、品鉴分析流水线） |
| 认证 | 自研 JWT | Spring Security + JWT |
| 可观测 | Prometheus + Sentry | Actuator + Micrometer + 可选 Langfuse |
| 限流/熔断 | 手写中间件 | Spring 生态（Bucket4j/Resilience4j 待设计定） |

---

## 4. 业务需求（功能清单）

### 4.1 保留（前端已有，后端重实现）

| 模块 | 说明 |
|---|---|
| 认证 | 注册/登录/JWT（30 天），接口语义兼容 |
| 茶叶目录 | 六大茶类、产区、工艺、茶人、茶诗、知识图谱 CRUD/查询 |
| 茶器 | 茶器库查询 |
| 品鉴记录 | 八维评分 + 工艺系数 + 离线优先同步（client_id 幂等） |
| 茶文化 | 产区/茶人/茶诗/礼仪/知识图谱/搜索 |
| 个人成长 | 等级/XP/旅程 |

### 4.2 AI 功能升级（核心亮点）

| 功能 | 旧 | 新 |
|---|---|---|
| 荐茶 | 单次 prompt 生成 | **@荐茶师**：工具调用读取茶叶库 + RAG 文化背景 + 用户画像偏好，输出结构化推荐（含理由/冲泡参数/相关茶诗） |
| 茶记 | 单次 prompt 生成 | **@品鉴师**：结合八维评分数据 + 历史记录对比，生成有洞察的茶记 |
| 问答 | 裸 chat | **@茶文化学者**：RAG 检索知识库 + 图谱查询，回答带出处引用 |
| 冲泡指导 | 无 | **@冲泡教练**：按茶类/茶器/天气给出水温、时间、注水手法建议 |
| 成长建议 | 无 | **@成长导师**：分析品鉴历史，生成阶段总结与下一阶段建议 |
| 多智能体协作 | 无 | Orchestrator 按任务路由到对应专家，复杂任务多角色协作（如"帮我复盘这个月的品鉴"→ taster + mentor） |
| 流式输出 | 无 | SSE 流式（打字机效果） |
| 记忆 | 无 | 短期会话记忆 + 长期用户偏好画像 |

### 4.3 新增业务能力（可选，PRD 阶段先列入）

- 品鉴趋势图表数据接口（按时间/茶类/评分聚合）
- 用户画像接口（供 AI 个性化 + 前端展示）

---

## 5. AI 多智能体设计（参照 oh-my-opencode-slim 理念）

### 5.1 角色定义与委派阈值

参照 slim 的 role-routing 风格，每个专家角色定义"何时用/何时不用"：

| 角色 | 职责 | 委派时机 | 不委派时机 |
|---|---|---|---|
| **Orchestrator 编排器** | 理解请求、规划工作图、路由专家、整合结果 | 任何 AI 请求的入口 | 不可禁用 |
| **@荐茶师 advisor** | 按时间/天气/心情/偏好荐茶 | 用户求推荐 | 仅查茶叶列表（走普通 API） |
| **@品鉴师 taster** | 解读八维评分、生成茶记、对比历史 | 用户提交品鉴/询问品鉴反馈 | 简单 CRUD |
| **@茶文化学者 librarian** | RAG 检索、文化问答、带出处 | 涉及历史/文化/知识的问答 | 用户已有明确答案 |
| **@冲泡教练 brewer** | 冲泡参数建议（水温水时手法） | 冲泡流程中/用户询问冲泡 | 机械参数表已够用时 |
| **@成长导师 mentor** | 品鉴历史分析、阶段总结、建议 | 用户要求复盘/成长建议 | 单条记录查询 |

### 5.2 多智能体编排模式

- **模式一（单专家）**：意图明确 → Orchestrator 直接路由单个专家，低延迟低成本。
- **模式二（Supervisor 协作）**：复杂请求（如"复盘本月品鉴"）→ Orchestrator 编排 taster + mentor 依次工作，整合输出。
- **模式三（工作流 Graph）**：荐茶流水线（读画像 → 查库存 → RAG 文化 → 生成推荐 → 校验格式）、品鉴分析流水线（读记录 → 聚合统计 → 生成洞察）用 SAA Graph 固化，Human-in-the-loop 节点用于高价值确认。
- **并发**：多专家可并行任务（如同时查文化背景 + 查历史记录），Orchestrator 对账。

### 5.3 Agent Skills（对应 OMC 的 skills 概念）

借鉴 OMC 的 SKILL.md 模式，在 SAA 中注册项目级 Agent Skills：
- `codemap` 对应 → 茶文化知识库导航（给 librarian 用）
- `verification-planning` 对应 → 品鉴数据校验规则（给 taster 用）
- `deepwork` 对应 → 复杂复盘工作流（给 orchestrator 用）

### 5.4 降级与容错（保留旧系统承重墙）

- 前端 `teaAI.ts` 规则引擎降级逻辑**保留不动**：后端 AI 不可用时前端自动回退离线规则（荐茶/茶记/基础问答），这是离线优先 PWA 的承重墙。
- 后端 AI 增加：超时、重试（指数退避）、熔断、多模型 fallback（qwen-max 失败 → qwen-plus → qwen-flash）。

---

## 6. 数据模型设计

### 6.1 沿用现有表（结构复用，新库重建）

teas / tea_regions / tea_processes / tea_people / tea_poems / tea_etiquettes / tea_relations / teawares / users / tea_journeys / tasting_records / culture_documents

### 6.2 新增表

| 表 | 用途 | 关键字段 |
|---|---|---|
| `ai_chat_sessions` | AI 对话会话（短期记忆持久化） | id, user_id, title, model, created_at |
| `ai_messages` | 会话消息（供记忆/审计） | id, session_id, role, content, tokens |
| `user_profiles` | 长期用户画像（AI 记忆） | user_id, preferred_teas, preferred_aromas, tasting_stats, goals |
| `culture_chunks` | 文化文档切片 + 向量 | doc_id, chunk_index, content, embedding vector(1536) |
| `ai_usage_logs` | AI 调用计量（限流/成本） | user_id, agent, model, tokens_in, tokens_out, latency |

### 6.3 数据迁移策略

- 全新部署：`flyway`/`liquibase`（二选一，设计阶段定）建库 + seeds 脚本灌入文化数据（现有 `backend/seeds/` 内容可作为数据源参考，茶文化数据需人工核对不编造）。
- 旧库数据不迁移（视为 demo 数据）。

---

## 7. API 设计（草案）

### 7.1 兼容保留（前端改动最小）

| 端点 | 说明 |
|---|---|
| POST /api/auth/register, /login | 认证 |
| GET/POST /api/teas, /api/teas/{id} | 茶叶目录 |
| GET /api/teawares... | 茶器 |
| POST /api/records + GET /api/records | 品鉴记录（含 client_id 幂等） |
| GET /api/culture/... | 文化查询 |
| POST /api/ai/recommend, /note, /chat | AI 兼容端点（内部升级实现，返回格式不变） |

### 7.2 新增端点

| 端点 | 说明 |
|---|---|
| POST /api/ai/chat/stream | SSE 流式对话（专家路由后流式返回） |
| GET /api/ai/sessions, GET /api/ai/sessions/{id}/messages | 会话历史 |
| POST /api/ai/review | 品鉴复盘（多专家协作） |
| POST /api/ai/brew-guide | 冲泡指导 |
| GET /api/analytics/tastings | 品鉴趋势聚合 |

---

## 8. 非功能需求

| 类别 | 要求 |
|---|---|
| 安全 | Spring Security + JWT；密码 bcrypt；CORS 白名单；Rate Limit（AI 10 次/60s、登录 10 次/300s）；敏感信息不入日志；输入校验（Bean Validation） |
| 性能 | AI 首字延迟 < 2s（流式）；普通 API P95 < 300ms；连接池；缓存（Redis 可选） |
| 可观测 | Actuator /health /ready /metrics；Micrometer；结构化日志（JSON + request_id）；可选 Langfuse tracing |
| 可靠性 | AI 熔断 + 多模型 fallback；数据库连接池；优雅停机 |
| 测试 | 单元测试（Service）+ 集成测试（Testcontainers Postgres）+ 前端现有 vitest/playwright 保持 |
| 文档 | OpenAPI 自动生成；README 重构说明；ADR 记录关键决策 |

---

## 9. 里程碑规划（参照 OMC team 流水线：plan→prd→exec→verify→fix）

| 里程碑 | 内容 | 验收标准（Exit Criteria） |
|---|---|---|
| **M1 骨架** | Spring Boot 工程搭建、依赖 BOM、配置管理、数据库连接、健康检查、CI 基础 | `mvn test` 通过、/ready 返回 200、数据库连接正常 |
| **M2 认证 + 基础 CRUD** | Spring Security JWT、users/teas/teawares/records/culture 全套 API | 兼容旧前端 API 契约；集成测试覆盖认证与幂等 |
| **M3 AI 接入** | dashscope starter、ChatModel 三端点兼容（recommend/note/chat）、降级保留、流式 | 旧前端 AI 功能无感迁移；熔断/fallback 测试通过 |
| **M4 RAG + 向量** | 文化文档切片入库、embedding、pgvector 检索、librarian 带出处引用 | 知识问答能引用来源；检索质量冒烟通过 |
| **M5 多智能体** | Agent Framework：Orchestrator + 5 专家、工具调用、会话记忆、Graph 流水线 | 4 个典型场景（荐茶/茶记/问答/复盘）端到端跑通 |
| **M6 画像与个性化** | 用户画像沉淀、个性化荐茶/建议 | 同一用户两次荐茶体现偏好收敛 |
| **M7 生产化** | 可观测、限流熔断、错误处理、文档、部署脚本、安全审计 | 生产部署手册可复现；上线检查清单全过 |

预计总周期：M1-M7 为 6-10 周（视开发节奏）。

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| SAA 1.1.2 较新，部分文档不全 | 踩坑 | 官方 examples 逐例跑通；锁定 BOM 版本；问题反馈社区 |
| Spring AI 2.0/Boot 4 升级压力 | 未来迁移成本 | 架构上隔离 AI 层；暂不追新，稳定优先 |
| 通义千问成本 | 费用 | qwen-flash 兜底、用量日志监控、限流 |
| 前端兼容回归 | 体验倒退 | 保留 API 契约 + 前端测试套件回归 |
| 文化数据质量 | 编造风险 | seeds 数据人工核对，标注"待核实"，优先复用现有 `src/data/` |

---

## 11. 验收标准（整体 Done 定义）

1. M1-M7 全部 Exit Criteria 达成。
2. 前端 `npm run quality` 保持绿（现有门禁不回归）。
3. 后端测试覆盖率 ≥ 70%（核心业务 + AI 降级路径 100% 覆盖关键分支）。
4. 4 个典型用户场景可完整演示：注册→选茶→冲泡→品鉴→AI 茶记→AI 复盘→个性化荐茶。
5. 部署文档可让任何人从零复现生产环境。
6. 开源仓库整洁：README、LICENSE、ADR、CHANGELOG、CONTRIBUTING 齐备。

---

## 12. 待确认问题（阻塞评审项）

1. **构建工具**：Maven 还是 Gradle？（默认 Maven）
2. **数据库初始化**：flyway 还是 liquibase？（默认 flyway）
3. **Redis**：是否需要引入（会话/限流/缓存）？（默认先不引入，PG 足够）
4. **部署形态**：Windows 服务 / Docker Compose / 云主机？（默认 Docker Compose 可复现 + 生产环境说明）
5. **文化数据**：新库 seeds 数据从现有 `backend/seeds/` 与 `src/data/` 整理迁移，是否接受？是否要补充更多茶文化内容？
6. **AI 成本上限**：qwen 用量是否设置每日预算告警？
7. **品鉴复盘等新功能**是否纳入首版范围（M5），还是作为 M6 之后增强？

---

*本文档依据已读代码事实 + 官方文档（java2ai.com 版本说明、Spring AI Alibaba 概览）撰写；所有外部事实已标注来源。*
