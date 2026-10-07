---
last_updated: 2026-10-06
status: active
owner: yanha
---

# 「一盏茶」重构 PRD v0.2 — Spring Boot + Spring AI Alibaba + .harness 治理体系

> 版本：v0.2（草案，待评审；v0.1 保留为 
>
> `PRD-spring-ai-refactor.md`
>
> ）
> 日期：2026-10-04
> 状态：Draft — 待用户确认后进入设计阶段
> 方法论来源：oh-my-claudecode（OMC）团队流水线・oh-my-opencode-slim 多智能体编排・
>
> **tulingshop&#x20;**
>
> `.harness`
>
> **&#x20;工程治理体系（33 图学习成果）**



***

## 0. 文档速览



| 项    | 内容                                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 项目   | 一盏茶（沉浸式在线茶道应用）                                                                                                                                                   |
| 重构范围 | <u>后端全部重写</u><u>（FastA</u>PI → Spring Boot + Spring AI Alibaba）；前端保留并适配；数据库沿用 PostgreSQL 并扩展                                                                     |
| 核心目标 | ① 技术含金量升级（Java 企业级 + 阿里云 AI 生态）② AI 从 "代理转发" 升级为 "多智能体体系" ③ **引入 tulingshop 式&#x20;**`.harness`**&#x20;开发治理体系（十阶段流水线 + 技能目录 + 红线审计 + 变更追踪）** ④ 达到可上线、可展示、可开源的高水准 |
| 模型栈  | 通义千问系列（qwen-max /qwen-plus/qwen-flash）+ 百炼 RAG + pgvector 向量检索                                                                                                   |
| 治理骨架 | `.harness/rules` + `.harness/skills`（main-dev / biz-dev / trouble-shooting）+ `.harness/wiki` + `.harness/changes` + `.claude/agents`（红线审计 / 一致性核对 / 代码评审）        |
| 当前阶段 | 需求分析（PRD v0.2）→ 待评审 → 架构设计（ADR）→ 开发                                                                                                                              |



***

## 1. 背景与动机

### 1.1 现状（已读代码核实）

**前端（保留）**：Vue 3.5 + Pinia 4 + Tailwind 4 + TresJS 5.8/Three 0.185 + Dexie（离线优先 PWA），ECharts/Chart.js 可视化，3D 茶席，业务闭环完整（入席→选茶→备器→煮水→冲泡→品鉴→成长）。

**后端（重写）**：FastAPI + SQLAlchemy 2.0 async + PostgreSQL + Alembic，JWT 认证，限流 / 熔断 / Sentry/Prometheus 已具备生产意识。AI 现状：**仅做代理转发**——3 个端点（recommend/note/chat）把请求转发给 DeepSeek，RAG 是 SQL `ILIKE` 关键词检索（非向量），无记忆、无工具调用、无多智能体。

### 1.2 重构动机



1. **技术栈档次**：FastAPI 单文件脚本式 → Spring Boot 企业级框架，Java 生态、Spring Security、可观测性、社区成熟度，是主流企业技术栈，简历与开源展示价值更高。

2. **AI 能力代差**：现有 AI 只是 "套壳聊天"，Spring AI Alibaba 提供 ChatModel/RAG/Function Calling/MCP/Graph 多智能体全套能力，可把「一盏茶」的 AI 从 "回复生成器" 升级为 "茶道专家团队"。

3. **开发治理升级**：tulingshop 的 `.harness` 体系证明了 "项目内嵌开发流程治理 + 技能目录 + 红线审计 + 变更追踪" 能让 AI 协作产出稳定、可评审、可回滚的高质量代码。把它搬到 tea，等于给重构工程装上质量门禁。

4. **生产级增强**：Spring 生态自带 Actuator、Micrometer、Spring Security、事务管理、连接池、测试框架。

5. **不计成本**：用户明确投入不限，优先质量、可展示性、完备性。

### 1.3 非目标（明确不做）



* 不重写前端（保留 Vue 3.5 现有代码与设计系统）

* 不迁移历史用户数据（重构后数据库重新初始化，视为全新部署；保留表结构设计复用）

* 不做移动端原生 App（维持 PWA）

* 不引入微服务拆分（单体 Spring Boot 足够，避免过度工程）

* 不替换 PostgreSQL（沿用，扩展向量能力）

* 不照搬 tulingshop 的 MQ/Redis 技术栈 —— 按 tea 实际需要裁剪（无 RocketMQ；Redis 可选），**迁移的是治理范式而非技术栈**



***

## 2. 参照体系学习总结（tulingshop `.harness`，33 图提炼）

### 2.1 体系全貌



```
tulingshop/
├── .claude/
│   ├── CLAUDE.md               # AI 编码约束 + 文件索引（技能总入口）
│   ├── settings.json           # Claude Code 配置
│   └── agents/
│       ├── code-reviewer.md        # 代码评审子代理（6 维度分级评审，独立上下文）
│       ├── consistency-verifier.md # 一致性核对子代理（代码 vs wiki 漂移检测）
│       └── red-line-auditor.md     # 红线审计子代理（全库红线与规范扫描）
├── .harness/
│   ├── rules/                  # 工程结构.md / 编码规范.md / 开发流程规范.md
│   ├── skills/
│   │   ├── main-dev/     # 十阶段流水线主流程（6 个技能）
│   │   ├── biz-dev/      # 业务专项开发（19 个技能，含 tea 专属 offline-sync/3d-scene/design-taste）
│   │   └── trouble-shooting/  # 故障排查（5 个技能）
│   ├── wiki/                   # business-model / api-contract / data-model / glossary
│   └── changes/{feat-name}/    # summary.md + db-migrations.sql + rollback.sql（变更追踪）
├── tulingshop-backend/         # Spring Boot + MyBatis-Plus + RocketMQ + Redis
└── tulingshop-frontend/        # Vue 3 + Element Plus + Pinia
```

### 2.2 十阶段流水线（核心治理引擎）

**需求 → 方案 → 拆分 → 编码 → 单测 → 评审 → 集成 → 预发 → 部署 → 观测**



| Stage | Name | 使用技能                             | Quality Gate（退出条件）      | Output              |
| ----- | ---- | -------------------------------- | ----------------------- | ------------------- |
| 1     | 需求分析 | request-analysis                 | 需求清晰无歧义，模糊点已澄清，业务价值明确   | 需求清单 + 影响分析         |
| 2     | 方案设计 | request-analysis                 | 方案经过评审，技术选型有依据，红线冲突清零   | 技术变更清单 + summary.md |
| 3     | 任务拆分 | request-analysis                 | 任务粒度 ≤4h，依赖关系明确         | 任务列表 + 执行顺序         |
| 4     | 编码实现 | coding-skill（+ biz-dev-skill 专项） | 遵守编码规范，红线零违，编译 0 error  | 可编译代码               |
| 5     | 单元测试 | unit-test-write                  | 覆盖率 ≥80%，核心逻辑 100%，测试全绿 | 测试报告                |
| 6     | 代码评审 | expert-reviewer + unit-test-ci   | 评审通过无🔴问题；CI 门禁全绿       | 评审记录                |
| 7     | 集成测试 | -（联调执行）                          | 接口联调通过，数据流正确            | 集成测试报告              |
| 8     | 预发验证 | deploy-verify                    | staging 环境验证通过（含冒烟）     | 验证记录                |
| 9     | 上线部署 | deploy-verify                    | 部署脚本执行成功，冒烟通过           | 部署记录                |
| 10    | 线上观测 | deploy-verify                    | 30 分钟观测期无异常，指标在基线内      | 观测报告                |

**衔接规则**：串行推进，Stage N 的 Gate 未满足禁止进入 N+1；小改动阶段 1-3 可合并一次完成，但 `summary.md` 不可省略、红线检查与冒烟验证任何场景都不可省略；任一阶段失败按回滚路线表回到对应阶段重来。

### 2.3 request-analysis（需求分析范式）



* **核心功能点**：动词 + 宾语描述（如 "用户领取优惠券"），每个功能点独立编号 F1、F2…

* **功能边界**：明确做什么、不做什么，边界项同样列出

* **验收标准**：每条可验证（Given-When-Then 或可执行检查），**禁止 "体验良好" 这类不可验证表述**

* **角色与入口**：哪些角色使用、入口在哪里（页面 / 接口 / 定时任务）

* **4 种必澄清场景**：① 同一术语与领域术语表不一致 ② 涉及金额 / 库存 / 状态流转但无精确规则 ③ "等 / 之类的 / 类似 xx" 模糊指代 ④ 隐含非功能不明确（并发量级、数据量级、时效性）

* **技术影响逐层评估**：数据库（DDL 草案）→ 后端（文件变更清单）→ Redis（Key 设计）→ MQ（Topic/Consumer 清单）→ 前端（文件变更清单）→ 定时任务（频率与幂等策略）

### 2.4 coding-skill（编码范式）



* **frontmatter 规范**：name + description（触发语义写清 "何时用 / 不用"）

* **触发 / 前置条件**：前置缺失先回 request-analysis，不硬编码

* **上下文准备**：规则 + Wiki 合计 ≤4 个，按需加载

* **代码结构参照**：生成代码必须落在真实包结构，禁止自行发明路径

* **后端分步**：Step1 Model（Entity/DTO/VO 分离、金额 Integer 分、@TableLogic 软删、LocalDateTime）→ Step2 Repository（BaseMapper、LambdaQueryWrapper、复杂 SQL 进 XML、Page）→ Step3 Service（接口 + impl、@RequiredArgsConstructor final 注入、@Transactional (rollbackFor)、异常体系 NotFound/Validation/Conflict/Auth/Business）→ Step4 Controller（@RestController、统一 ApiResponse、@Valid、RESTful）→ Step5 Config（Redis Key 前缀 + TTL）→ Step6 MQ（如需）

* **前端分步**：Types↔DTO/VO 对齐 → API 封装 → Store（Pinia）→ Composable（纯逻辑）→ Component/View（`<script setup lang="ts">`、defineProps/defineEmits 带类型）

* **分批与验证（40% 阈值）**：单次变更 ≤ 文件总量 40%，每完成一个 Step / 批次立即验证（后端 `mvn compile`、前端 `npx vue-tsc --noEmit`）

* **10 项自检清单**：编译 0 error / 红线零违 / 金额字段类型 / Redis Key 前缀 / MQ 幂等 / 异常体系 / 构造器注入 / 事务注解 rollbackFor /script setup / 统一响应

### 2.5 unit-test-write /expert-reviewer/ 故障排查



* **测试用例设计顺序**：正常 → 边界（page=1/size=0、金额 0 分）→ 异常路径（NotFoundException/ValidationException/ConflictException）→ 幂等 / 重复（MQ 重复投递）→ 状态流转（非法前置状态）；**禁止只写 happy path**；bug 先写复现测试

* **评审 6 维度**：架构合规 / 编码红线（8 条逐条过）/ 性能 / 安全 / MQ 可靠性 / Redis 一致性

* **问题分级**：🔴 必须修改（红线 / 资损 / 安全，阻断合并）・🟡 建议修改・🟢 符合规范・💡 改进建议；升级规则：同维度 2-3 个🟡 或同类重复 → 升级为🔴

* **评审流程**：先读 summary.md 建立预期，再读代码（防止被实现带偏）；🔴 未解决不得进下一阶段

* **故障排查技能**：慢 SQL / OOM（保留现场 → 看日志 → MAT 分析 → 常见场景 → 自检清单 + 红线）/ CPU 飙高 / MQ 积压 / Redis 热点 Key—— 每篇都带 "触发条件 → 前置条件 → 核心流程 → 自检清单 → 红线"

### 2.6 企业落地 Skill 体系 7 大痛点（最后一张 PPT）



| 痛点               | 优化方向                                               |
| ---------------- | -------------------------------------------------- |
| Skill 数量多，命中率下降  | 分层路由（先领域粗分类再细语义匹配）、结构化标签前置过滤、向量 + 关键词混合检索、热门结果前置缓存 |
| 多 Skill 组合参数传递不准 | 统一参数 Schema 强校验、中间结果标准化封装、节点级重试与降级、执行状态快照断点续跑      |
| 高频调用成本高          | Skill 结果语义缓存、同类批量请求合并、热数据预计算、简单场景规则 / 小模型兜底        |
| 迭代升级兼容性          | 多版本并行管理、按流量 / 租户灰度、上线前自动效果评测、一键回滚、向下兼容设计           |
| 数据安全合规           | 角色级 Skill 访问权限、输入输出统一脱敏、全量调用审计日志、敏感操作二次校验          |
| 标准化开发规范          | 统一输入输出 Schema、强制元数据规范、自动化测试与上线校验、组件化可插拔设计          |
| 第三方 Skill 不稳定    | 输出格式强校验、结果置信度评分、失败自动重试                             |



***

## 3. 技术选型（已调研核实）



| 决策点   | 选择                                                                                    | 依据                                                                                                                                               |
| ----- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 后端框架  | **Spring Boot 3.5.x**                                                                 | Spring AI Alibaba 1.1.2.0 官方兼容 Spring Boot 3.5.x（查证自 [java2ai.com](https://java2ai.com) 版本说明）；Spring Boot 4/Spring AI 2.0 已发布但 SAA 尚未主推适配，风险高，不选 |
| AI 框架 | **Spring AI Alibaba 1.1.2.0**（当前推荐版）                                                  | 官方版本表标注 "当前推荐"；支持 Agent Skills、Supervisor、Routing 多智能体；集成百炼平台、RAG、MCP、可观测                                                                        |
| 依赖管理  | `spring-ai-alibaba-bom` + `spring-ai-bom` + `spring-ai-alibaba-extensions-bom`        | 官方 BOM 统一版本，避免冲突                                                                                                                                 |
| 模型    | 通义千问：`qwen-max`（主推理）、`qwen-plus`（均衡）、`qwen-flash`（低成本快）；Embedding：`text-embedding-v3` | 百炼平台官方模型                                                                                                                                         |
| 向量库   | **pgvector**（PostgreSQL 扩展）                                                           | 沿用现有 PG，避免引入新存储；茶文化数据量级（数百文档）pgvector 足够                                                                                                         |
| 认证    | Spring Security + JWT                                                                 | 保留现有前端登录交互不变                                                                                                                                     |
| ORM   | **Spring Data JPA**（已定，ADR-010 记录） | tea 现有 SQLAlchemy 语义与 JPA/Entity 最贴近（面向对象、实体关系映射）；Spring 生态官方深度集成（审计/分页/事务）；评分与统计聚合场景 JPA Criteria 足够；MyBatis-Plus 更适 SQL 强控的电商复杂查询，tea 领域查询复杂度低，JPA 更省心智 |
| 构建    | Maven（或 Gradle，设计阶段定）                                                                 | Java 生态标准                                                                                                                                        |
| 部署    | **Docker Compose**（已定）：后端 + PostgreSQL(pgvector) + 前端构建产物，一键 `docker compose up`；本机/云主机均可跑 | 可复现、可开源、面试展示效果好；与 M7 生产化验收标准一致 |
| 观测    | Spring Boot Actuator + Micrometer + 可选 Langfuse/ARMS                                  | SAA 官方支持                                                                                                                                         |

### 3.1 版本兼容要点（查证自官方文档）



* SAA 1.1.2.0 基于 **Spring AI 1.1.2 + Spring Boot 3.5.x**，JDK 17+（建议 JDK 21 LTS）

* 核心组件：`spring-ai-alibaba-agent-framework`（ReactAgent / 多智能体 / Hooks/Skills）、`spring-ai-alibaba-graph-core`（图工作流）、`spring-ai-alibaba-starter-dashscope`（模型接入）、`spring-ai-alibaba-studio`（嵌入式调试 UI）、`spring-ai-alibaba-starter-graph-observation`（可观测）

* 官方示例：chatbot /deepresearch/documentation（[github.com/alibaba/spring-ai-alibaba/tree/main/examples](https://github.com/alibaba/spring-ai-alibaba/tree/main/examples)）



***

## 4. 目标架构

### 4.1 分层总览（示意）



```mermaid
flowchart TB
    subgraph client["浏览器 PWA（保留）"]
        views["Vue 3.5 视图层"]
        stores["Pinia 状态"]
        services["services/（http / storage / scoring / teaAI 规则降级·承重墙）"]
    end

    subgraph server["Spring Boot 3.5 后端（全新）"]
        api["REST API 层（Controller，统一 ApiResponse）"]
        biz["Service 业务层（认证/茶叶/品鉴/文化/旅程）"]
        ai["AI 层：茶灵多智能体"]
        aiorch["Orchestrator 编排器（分层路由）"]
        ag1["@荐茶师 advisor"]
        ag2["@品鉴师 taster"]
        ag3["@茶文化学者 librarian"]
        ag4["@冲泡教练 brewer"]
        ag5["@成长导师 mentor"]
        rag["RAG 检索（pgvector + 混合检索）"]
        mem["记忆服务（短期会话/长期画像）"]
        graph["Graph 工作流 + Human-in-the-loop"]
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

### 4.2 与旧后端差异对照



| 维度      | 旧（FastAPI）          | 新（Spring Boot + SAA）                          |
| ------- | ------------------- | --------------------------------------------- |
| AI 调用   | httpx 转发 DeepSeek   | ChatModel 抽象 + 多模型路由 + 流式                     |
| RAG     | SQL ILIKE 关键词       | 向量检索 pgvector + Embedding + Advisor           |
| 智能体     | 无                   | Orchestrator + 5 个角色（ReactAgent / Supervisor） |
| 工具调用    | 无                   | Function Calling（查茶叶库、查品鉴记录等）                 |
| 记忆      | 无                   | ChatMemory 短期 + 用户画像长期                        |
| 工作流     | 无                   | Graph（荐茶流水线、品鉴分析流水线）                          |
| 认证      | 自研 JWT              | Spring Security + JWT                         |
| 可观测     | Prometheus + Sentry | Actuator + Micrometer + 可选 Langfuse           |
| 限流 / 熔断 | 手写中间件               | Spring 生态（Bucket4j/Resilience4j 待设计定）         |



***

## 5. 业务需求（request-analysis 范式重写）

### 5.1 功能点清单（F1-Fn 编号）



| 编号  | 功能点       | 角色 / 入口      | 边界（不做）      | 验收标准（Given-When-Then）                                                                              |
| --- | --------- | ------------ | ----------- | -------------------------------------------------------------------------------------------------- |
| F1  | 用户注册 / 登录 | 游客 / 页面      | 不做第三方 OAuth | Given 未注册手机 / 邮箱，When 提交注册，Then 创建账号并返回 JWT（30 天有效）                                                |
| F2  | 浏览茶叶目录    | 所有用户 / 页面    | 不做购物车 / 下单  | Given 用户打开茶单页，When 按茶类 / 产区筛选，Then 返回分页列表（P95<300ms）                                               |
| F3  | 查看茶叶详情    | 所有用户 / 页面    | 不做库存        | Given 用户打开某茶详情，When 请求 /teas/{id}，Then 返回产区 / 工艺 / 茶人 / 相关茶诗全量信息                                   |
| F4  | 浏览茶器库     | 所有用户 / 页面    | 不做购买        | 同上模式                                                                                               |
| F5  | 创建品鉴记录    | 登录用户 / 页面    | 不做图片上传（首版）  | Given 用户完成一次冲泡，When 提交八维评分 + 工艺系数，Then 记录落库并计算 overall\_score；离线时暂存 IndexedDB，联网后按 client\_id 幂等同步 |
| F6  | 查看品鉴历史    | 登录用户 / 个人页   | -           | Given 用户有历史记录，When 分页查询，Then 返回按时间倒序记录含评分与茶名                                                       |
| F7  | 浏览茶文化知识   | 所有用户 / 页面    | -           | 产区 / 茶人 / 茶诗 / 礼仪 / 知识图谱查询                                                                         |
| F8  | 个人成长      | 登录用户 / 成长页   | 不做排行榜（首版）   | 品鉴行为累计 XP / 等级，旅程可视化                                                                               |
| F9  | AI 荐茶     | 登录用户 / AI 入口 | 不做库存推荐      | Given 用户请求荐茶，When 调用 /api/ai/recommend，Then 返回结构化推荐（茶名 + 理由 + 冲泡参数 + 相关茶诗），格式可校验                   |
| F10 | AI 茶记     | 登录用户 / 品鉴完成  | -           | Given 用户刚提交品鉴，When 调用 /api/ai/note，Then 结合八维评分生成洞察性茶记                                              |
| F11 | AI 文化问答   | 所有用户 / AI 入口 | 不做闲聊兜底      | Given 用户问茶文化问题，When 调用 /api/ai/chat，Then 返回带出处的回答（RAG 引用）                                          |
| F12 | AI 冲泡指导   | 登录用户 / 冲泡流程  | -           | Given 用户在冲泡流程中，When 请求指导，Then 按茶类 / 茶器 / 天气返回水温 / 时间 / 手法                                          |
| F13 | AI 品鉴复盘   | 登录用户 / AI 入口 | -           | Given 用户要求复盘周期品鉴，When 调用 /api/ai/review，Then 多专家协作输出阶段总结与建议                                        |
| F14 | AI 会话流式   | 登录用户 / AI 入口 | -           | Given 用户发起对话，When 请求 stream，Then SSE 流式返回、可中断                                                      |
| F15 | 品鉴趋势统计    | 登录用户 / 统计页   | -           | Given 用户有品鉴记录，When 请求聚合接口，Then 返回按时间 / 茶类 / 评分的趋势数据                                                |

### 5.2 必澄清场景（评审前确认）



1. 术语：AI 角色命名（荐茶师 / 品鉴师…）与现有产品文案是否一致

2. 精确规则：八维评分各维度的取值范围与权重口径（沿用现有 `tea-tasting` 基准表）

3. 模糊指代："个性化" 的程度边界 —— 首版只做画像偏好加权，不做协同过滤

4. 隐含非功能：AI 并发量级（个人应用，单用户即可）、文化问答时效（<3s 首字）、成本上限



***

## 6. AI 多智能体设计（参照 slim 编排 + tulingshop 治理 + 7 痛点应对）

### 6.1 角色定义与委派阈值



| 角色                   | 职责                   | 委派时机              | 不委派时机           |
| -------------------- | -------------------- | ----------------- | --------------- |
| **Orchestrator 编排器** | 理解请求、分层路由、规划工作图、整合结果 | 任何 AI 请求的入口       | 不可禁用            |
| **@荐茶师 advisor**     | 按时间 / 天气 / 心情 / 偏好荐茶 | 用户求推荐             | 仅查茶叶列表（走普通 API） |
| **@品鉴师 taster**      | 解读八维评分、生成茶记、对比历史     | 用户提交品鉴 / 询问品鉴反馈   | 简单 CRUD         |
| **@茶文化学者 librarian** | RAG 检索、文化问答、带出处      | 涉及历史 / 文化 / 知识的问答 | 用户已有明确答案        |
| **@冲泡教练 brewer**     | 冲泡参数建议（水温水时手法）       | 冲泡流程中 / 用户询问冲泡    | 机械参数表已够用时       |
| **@成长导师 mentor**     | 品鉴历史分析、阶段总结、建议       | 用户要求复盘 / 成长建议     | 单条记录查询          |

### 6.2 企业落地 7 痛点 → tea AI 层应对



| 痛点           | tea 落地设计                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Skill 命中率    | **分层路由**：意图粗分类（荐茶 / 茶记 / 问答 / 冲泡 / 复盘）→ 语义细匹配 → 专家选择；结构化标签（茶类 / 场景 / 意图）前置过滤；向量 + 关键词混合检索（pgvector + ILIKE 兜底）；热门知识结果缓存 |
| 多 Skill 组合参数 | **统一 Request/Response Schema**（record/JsonSchema 强校验）；中间结果标准化封装（`AgentResult<T>`）；节点级重试与降级；Graph 状态快照支持断点续跑             |
| 高频调用成本       | 常见问答语义缓存（同问同答直接命中）；qwen-flash 兜底简单场景；前端 `teaAI.ts` 规则引擎优先（离线 / 低价值请求不调模型）                                               |
| 迭代升级兼容       | 专家 prompt 版本化（`agent_prompts` 表）；按用户灰度；上线前自动效果评测（评审样本集）；一键回滚到旧 prompt 版本                                                |
| 数据安全合规       | 角色级权限（用户只能读自己的画像 / 记录）；输入输出统一脱敏（手机 / 邮箱 / Token）；全量调用审计日志（`ai_usage_logs`）；敏感操作二次确认                                     |
| 标准化开发        | Agent Skill 统一 Schema + 元数据规范 + 自动化测试（prompt 回归样本）；组件化可插拔（新增专家不侵入编排器）                                                   |
| 第三方结果不稳定     | 输出 JSON Schema 强校验（不符合→重试→降级）；置信度评分（结构化字段缺失 / 矛盾时降级为规则回复）；失败自动重试（指数退避）                                                  |

### 6.3 多智能体编排模式



* **模式一（单专家）**：意图明确 → Orchestrator 直接路由单个专家，低延迟低成本。

* **模式二（Supervisor 协作）**：复杂请求（如 "复盘本月品鉴"）→ Orchestrator 编排 taster + mentor 依次工作，整合输出。

* **模式三（工作流 Graph）**：荐茶流水线（读画像 → 查茶叶库 → RAG 文化 → 生成推荐 → Schema 校验）、品鉴分析流水线（读记录 → 聚合统计 → 生成洞察）用 SAA Graph 固化，Human-in-the-loop 节点用于高价值确认。

### 6.4 降级与容错（保留旧系统承重墙）



* 前端 `teaAI.ts` 规则引擎降级逻辑**保留不动**：后端 AI 不可用时前端自动回退离线规则（荐茶 / 茶记 / 基础问答），这是离线优先 PWA 的承重墙。

* 后端 AI 增加：超时、重试（指数退避）、熔断、多模型 fallback（qwen-max 失败 → qwen-plus → qwen-flash）、输出 Schema 校验失败 → 规则降级。



***

## 7. 数据模型设计

### 7.1 沿用现有表（结构复用，新库重建）

teas / tea\_regions / tea\_processes / tea\_people / tea\_poems / tea\_etiquettes / tea\_relations / teawares / users / tea\_journeys / tasting\_records / culture\_documents

### 7.2 新增表



| 表                  | 用途                      | 关键字段                                                                      |
| ------------------ | ----------------------- | ------------------------------------------------------------------------- |
| `ai_chat_sessions` | AI 对话会话（短期记忆持久化）        | id, user\_id, title, model, created\_at                                   |
| `ai_messages`      | 会话消息（供记忆 / 审计）          | id, session\_id, role, content, tokens                                    |
| `user_profiles`    | 长期用户画像（AI 记忆）           | user\_id, preferred\_teas, preferred\_aromas, tasting\_stats, goals       |
| `culture_chunks`   | 文化文档切片 + 向量             | doc\_id, chunk\_index, content, embedding vector(1536), source            |
| `ai_usage_logs`    | AI 调用计量（限流 / 成本 / 审计）   | user\_id, agent, model, tokens\_in, tokens\_out, latency, prompt\_version |
| `agent_prompts`    | 专家 prompt 版本管理（灰度 / 回滚） | agent, version, content, status, created\_at                              |

### 7.3 数据迁移策略



* 全新部署：flyway/liquibase（二选一，设计阶段定）建库 + seeds 脚本灌入文化数据（现有 `backend/seeds/` 内容作为数据源参考，茶文化数据需人工核对不编造）。

* 旧库数据不迁移（视为 demo 数据）。

* 变更追踪沿用 `.harness/changes/{feat-name}/`：每次 schema 变更产出 `db-migrations.sql` + `rollback.sql`，对应 git 分支 `feature/{feat-name}`。



***

## 8. API 设计（草案）

### 8.1 兼容保留（前端改动最小）



| 端点                                   | 说明                     |
| ------------------------------------ | ---------------------- |
| POST /api/auth/register, /login      | 认证                     |
| GET/POST /api/teas, /api/teas/{id}   | 茶叶目录                   |
| GET /api/teawares...                 | 茶器                     |
| POST /api/records + GET /api/records | 品鉴记录（含 client\_id 幂等）  |
| GET /api/culture/...                 | 文化查询                   |
| POST /api/ai/recommend, /note, /chat | AI 兼容端点（内部升级实现，返回格式不变） |

### 8.2 新增端点



| 端点                                                       | 说明                  |
| -------------------------------------------------------- | ------------------- |
| POST /api/ai/chat/stream                                 | SSE 流式对话（专家路由后流式返回） |
| GET /api/ai/sessions, GET /api/ai/sessions/{id}/messages | 会话历史                |
| POST /api/ai/review                                      | 品鉴复盘（多专家协作）         |
| POST /api/ai/brew-guide                                  | 冲泡指导                |
| GET /api/analytics/tastings                              | 品鉴趋势聚合              |



***

## 9. 开发治理体系（核心新增：tulingshop `.harness` 范式落地 tea）

> 本节是 v0.2 相对 v0.1 的最大变化：把 "开发流程治理" 制度化进仓库，让 AI 协作有门禁、可评审、可回滚。

### 9.1 tea 版 `.harness` 目录规划



```
tea/.harness/
├── rules/
│   ├── 工程结构.md          # tea 目录规范（backend 包结构 + frontend src/ 结构）
│   ├── 编码规范.md          # Java/Vue 编码约定（红线依据）
│   └── 开发流程规范.md      # 十阶段流水线（tea 版，见 9.2）
├── skills/
│   ├── main-dev/      # request-analysis / coding-skill / expert-reviewer
│   │                        #  / unit-test-write / unit-test-ci / deploy-verify
│   ├── biz-dev/       # tea 业务专项（tulingshop 13 项裁剪 + tea 专属 6 项）
│   └── trouble-shooting/  # tea 故障排查（慢SQL/OOM/CPU/AI异常/RAG质量）
├── wiki/
│   ├── business-model.md  # 品鉴业务闭环 + 实体关系（对应 docs/DATABASE_ER.md）
│   ├── api-contract.md    # API 契约（对齐 OpenAPI）
│   ├── data-model.md      # Schema 与表定义（对齐 DATABASE_ER.md）
│   └── glossary.md        # 茶道术语表（六大茶类/八维评分/工艺系数）
└── changes/{feat-name}/     # summary.md + db-migrations.sql + rollback.sql

.claude/agents/              # code-reviewer.md / consistency-verifier.md / red-line-auditor.md
CLAUDE.md（或 AGENTS.md 扩展） # AI 编码约束 + 文件索引
```

> 注：tea 已有 
>
> `AGENTS.md`
>
> （当前 AI 协作规则）与 
>
> `docs/architecture/`
>
> 、
>
> `DATABASE_ER.md`
>
> 。落地时
>
> **以&#x20;**
>
> `.harness/`
>
> **&#x20;补齐治理层，AGENTS.md 保留为总入口并指向&#x20;**
>
> `.harness/`
>
> ，避免双份规则打架。**落地范围：完整照搬（用户已定）**——rules 三份 + skills 全套（main-dev 6 + biz-dev 19 + trouble-shooting 5）+ wiki 四件套 + changes 模板 + `.claude/agents/` 三子代理，M0 一次建齐；文件全量建，**上下文仍按需加载（Token 成本行约束）**。

### 9.2 tea 版十阶段流水线 + Quality Gate

与 2.2 表一致，映射到 tea 的 M1-M7 里程碑（见第 11 节）。关键 gate 适配：



| Stage            | tea 特有 Gate                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| 1-3 需求 / 方案 / 拆分 | 每个功能点有 Given-When-Then 验收标准；技术变更清单覆盖 DB / 后端 / 前端 / AI 四层              |
| 4 编码             | 红线零违（见 9.4）；`mvn compile` + `npx vue-tsc --noEmit` 0 error；单批 ≤40% 文件量 |
| 5 单测             | 核心业务覆盖率 ≥80%（评分模型 / 幂等同步 / AI 降级路径 100% 关键分支）                          |
| 6 评审             | 6 维度评审无🔴；🟡 未清零不得通过；CI 门禁全绿                                           |
| 7 集成             | 旧前端 API 契约联调通过（用现有前端测试套件回归）                                            |
| 8-9 预发 / 部署      | staging 冒烟通过；部署脚本可复现                                                   |
| 10 观测            | 30 分钟无异常；AI 成本 / 延迟指标在基线内                                              |

### 9.3 tea 版技能目录映射（biz-dev-skill 裁剪）



| tulingshop 技能              | tea 映射 | 说明                                                          |
| -------------------------- | ------ | ----------------------------------------------------------- |
| 01-crud-scaffold           | ✅ 直接可用 | 茶叶 / 茶器 / 文化 CRUD                                           |
| 02-pagination-query        | ✅ 直接可用 | 品鉴历史 / 茶叶目录分页                                               |
| 03-redis-cache             | 🔶 按需  | 仅热门知识 / 限流用；默认不引入                                           |
| 04-mq-messaging            | ⭕ 不引入  | tea 无 RocketMQ；异步用 Spring 事件 / 虚拟线程即可                       |
| 05-transaction-consistency | ✅ 可用   | 品鉴提交 / 画像更新事务                                               |
| 06-exception-handling      | ✅ 可用   | BusinessError 体系（BadRequest/Unauthorized/NotFound/Conflict） |
| 07-business-validation     | ✅ 可用   | 八维评分范围 / 工艺系数校验                                             |
| 08-excel-import-export     | 🔶 按需  | 文化数据批量导入 seeds                                              |
| 09-db-migration            | ✅ 必用   | flyway/liquibase + changes 追踪                               |
| 10-scheduled-task          | 🔶 按需  | 文化索引重建 / 缓存预热                                               |
| 11-file-upload             | 🔶 按需  | 用户头像 / 茶照片（首版可延后）                                           |
| 12-notification            | ⭕ 延后   | 成长提醒（M6 后）                                                  |
| 13-stats-report            | ✅ 可用   | 品鉴趋势聚合                                                      |
| （新增）14-ai-agent            | ✅ 新增   | 多智能体开发技能（Spring AI Alibaba 编排模板）                            |
| （新增）15-rag-pipeline        | ✅ 新增   | 文化文档切片 /embedding/ 检索质量                                     |
| （新增）16-ai-fallback         | ✅ 新增   | 降级链与 Schema 校验（承重墙配套）                                       |
| （新增）17-offline-sync        | ✅ 新增   | 离线优先同步：IndexedDB ↔ 后端对账、`client_id` 幂等、`sync_status` 流转（tea 承重墙配套） |
| （新增）18-3d-scene            | ✅ 新增   | TresJS / Three 茶席场景维护（视觉层不改状态机，`3D_SPEC.md` 约束）        |
| （新增）19-design-taste        | ✅ 新增   | 前端设计质量（移植 taste-skill：三拨盘 + 62 项 Pre-Flight 逐项全检 + anti-slop 红线，Vue 化） |

> **FastAPI 技能退役**：后端重写为 Spring Boot 后，旧 FastAPI 相关技能 / 规则条目一律不进入 M0 `.harness/`；仅保留前端 `teaAI.ts` 降级承重墙（前端代码，与后端技能无关）。

### 9.4 tea 版编码红线（评审 / 审计依据）



1. 🔴 `teaAI.ts` 规则引擎降级逻辑**禁止删除或削弱**（离线优先 PWA 承重墙）

2. 🔴 AI 请求**必须走后端代理&#x20;**`/api/ai/*`，禁止前端直连第三方 AI

3. 🔴 品鉴评分模型保持可解释：八维口感评分 × 冲泡工艺系数，禁止黑盒替换

4. 🔴 金额 / 评分精度：价格类字段用 Integer（分）或定点类型；评分计算禁止浮点累积误差

5. 🔴 离线同步幂等：品鉴记录必须带 `client_id` 幂等键，服务端去重

6. 🔴 文化数据不编造：茶名 / 茶器 / 历史人物不确定标 "待核实"，优先复用 `src/data/` 已有数据

7. 🔴 异常必须走统一业务异常体系（BusinessError 子类），禁止裸抛 `RuntimeException`

8. 🔴 写操作事务必须 `@Transactional(rollbackFor = Exception.class)`

9. 🟡 Controller 构造器注入（禁 `@Autowired` 字段注入）；前端禁 Options API（`<script setup lang="ts">`）

10. 🟡 统一响应结构 `ApiResponse<T>`；敏感信息（Token / 密码 / 手机号）不入日志、出参脱敏

11. 🟡 前端设计禁 AI 默认痕迹（Inter 默认 / AI 紫渐变 / 三等分卡片 / 居中 Hero+三卡片 / emoji 当图标），改 UI 前先输出 Design Read（taste 19-design-taste）

### 9.5 wiki + changes 变更追踪



* **wiki**：业务模型 / 接口协议 / 数据模型 / 领域术语四件套，作为 AI 上下文（按需加载：request-analysis 规则 + Wiki ≤3 个，coding-skill ≤4 个，均不超限）；与现有 `docs/architecture/system-overview.md`、`DATABASE_ER.md` 建立索引关系，**不重复维护**。

* **changes**：每个特性目录 `changes/{feat-name}/summary.md`（需求 / 方案 / 技术变更清单）+ `db-migrations.sql` + `rollback.sql`；与 git 分支 `feature/{feat-name}` 同名；commit 用 conventional commits（`type(scope): desc`）。

### 9.6 评审与审计子代理（.claude/agents 对应）



| 子代理                  | 职责                       | tea 落点                                            |
| -------------------- | ------------------------ | ------------------------------------------------- |
| code-reviewer        | 6 维度分级评审（🔴🟡🟢💡），独立上下文 | 评审报告模板落到 `.harness/changes/{feat-name}/review.md` |
| consistency-verifier | 代码 vs wiki 漂移检测          | 实体字段 ↔ `wiki/数据模型.md` 一致性核对                       |
| red-line-auditor     | 全库红线与规范扫描                | 9.4 红线清单逐条可脚本化检查（部分可接入 CI）                        |

### 9.7 CI 质量门禁（unit-test-ci 对应）



* `npm run quality`（现有前端门禁）保持

* 后端：`mvn verify`（test + checkstyle/spotbugs 可选）+ 迁移测试（upgrade/downgrade 往返）

* 新增：红线审计脚本（扫描 9.4 可脚本化项）、prompt 回归样本集（AI 输出 Schema 校验冒烟）

### 9.8 开发期多 agent 并行（subagent 协作）

> 治理的对象不只是"代码怎么写"，还有"开发过程怎么并行"。重构期间多个 subagent 并行开发，各自独立上下文、互不干扰。

**并行粒度**：按里程碑/模块拆分为独立单元（如 M2 拆为 auth / teas / records 三路并行），单元间无强依赖即可并行；共享基础（BOM、配置、基类）先由主 agent 打好，再放行并行单元。

**防冲突四规则**（参照 oh-my-claudecode team 模式 + tulingshop 文件所有权）：

1. **文件所有权 pre-assign**：每个 subagent 开工前锁定自己的文件清单（`feature/{feat-name}` 分支或 worktree 隔离），禁止跨权写文件；共享文件（pom.xml、application.yml）由主 agent 独占。
2. **独立上下文**：每个 subagent 只加载自己需要的规则 + Wiki（≤4 个），不带全量项目上下文——同时服务 token 优化。
3. **批批验证**：每完成一个 Step 立即 `mvn compile` / `vue-tsc` 验证，合并前必须过评审 Gate（9.6 三子代理）。
4. **任务看板**：`task_list` 追踪并行单元状态（pending/in_progress/completed），主 agent 做对账与依赖解除；超过 5 分钟无进展的单元主动介入。

**tea 开发期角色分工**：

| 角色 | 职责 | 触发 |
|---|---|---|
| 主 agent（编排） | 拆分任务、锁定文件所有权、对账、合并、走流水线 Gate | 始终 |
| 业务 subagent | 按模块实现 CRUD/业务逻辑（M2/M3 等） | 模块独立时 |
| 评审 subagent | 6 维评审（对应 code-reviewer） | 编码完成后 |
| 一致性 subagent | 实体字段 ↔ wiki 数据模型漂移检测 | 数据模型变更后 |
| 红线 subagent | 全库红线扫描 | 每批次合并前 |

**约束**：并行单元 ≤4 路（上下文与对账成本最优）；串行依赖不强行并行（如 M4 依赖 M3 的 AI 接入）；任何单元的红线问题未清零不得合入主干。

***

## 10. 非功能需求



| 类别  | 要求                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 安全  | Spring Security + JWT；密码 bcrypt（锁定 4.0.1）；CORS 白名单；Rate Limit（AI 10 次 / 60s、登录 10 次 / 300s）；敏感信息不入日志；输入校验（Bean Validation）；角色级 AI 权限 |
| 性能  | AI 首字延迟 < 2s（流式）；普通 API P95 < 300ms；连接池；缓存（Redis 可选）                                                                                 |
| 可观测 | Actuator /health（liveness）+/health/readiness（readiness，base-path=/）+/metrics；Micrometer；结构化日志（JSON + request\_id）；AI 调用审计（agent/model/tokens/ 延迟）；可选 Langfuse tracing             |
| 可靠性 | AI 熔断 + 多模型 fallback + Schema 校验降级；数据库连接池；优雅停机                                                                                       |
| 成本  | AI 用量日志 + 每日预算告警（可选）；qwen-flash 兜底；语义缓存；规则引擎优先
| Token 成本（开发协作） | **skills/规则/Wiki 按需渐进式加载**：request-analysis 规则 + Wiki ≤3 个、coding-skill ≤4 个，未命中触发的 SKILL.md 不进上下文；frontmatter 声明触发条件用于路由过滤；changes 只存增量；开发期 subagent 独立上下文避免全量复制；prompt 版本化避免重复实验                                                                                       |
| 测试  | 单元测试（Service）+ 集成测试（Testcontainers Postgres）+ 前端现有 vitest/playwright 保持；AI 输出 Schema 回归样本                                            |
| 文档  | OpenAPI 自动生成；`.harness/wiki` 四件套；README 重构说明；ADR 记录关键决策                                                                              |



***

## 11. 里程碑规划（十阶段流水线 + M1-M7）



| 里程碑                 | 对应阶段 | 内容                                                                    | 验收标准（Exit Criteria）                       |
| ------------------- | ---- | --------------------------------------------------------------------- | ----------------------------------------- |
| **M0 治理底座**         | 1-3  | `.harness/rules` 三份 + `skills` 全套（main-dev 6/biz-dev 19/trouble-shooting 5）+ `wiki` 四件套 + `changes` 模板 + `.claude/agents/` 三子代理 + AGENTS.md 扩展 + CI 门禁骨架 | 十阶段流水线文档化；红线清单评审通过；skills 全部落位；CI 可跑                  |
| **M1 骨架**           | 4-6  | Spring Boot 工程搭建、依赖 BOM、配置管理、数据库连接、健康检查、CI 基础                         | `mvn test` 通过、/ready 200、数据库连接正常、红线审计脚本通过 |
| **M2 认证 + 基础 CRUD** | 4-6  | Spring Security JWT、users/teas/teawares/records/culture 全套 API        | 兼容旧前端 API 契约；集成测试覆盖认证与幂等；评审无🔴            |
| **M3 AI 接入**        | 4-6  | dashscope starter、ChatModel 三端点兼容（recommend/note/chat）、降级保留、流式        | 旧前端 AI 功能无感迁移；熔断 /fallback 测试通过           |
| **M4 RAG + 向量**     | 4-6  | 文化文档切片入库、embedding、pgvector 检索、librarian 带出处引用                        | 知识问答能引用来源；检索质量冒烟通过                        |
| **M5 多智能体**         | 4-6  | Agent Framework：Orchestrator + 5 专家、工具调用、会话记忆、Graph 流水线               | 4 个典型场景（荐茶 / 茶记 / 问答 / 复盘）端到端跑通           |
| **M6 画像与个性化**       | 4-6  | 用户画像沉淀、个性化荐茶 / 建议、prompt 版本管理                                         | 同一用户两次荐茶体现偏好收敛；prompt 可灰度回滚               |
| **M7 生产化**          | 7-10 | 集成联调、可观测、限流熔断、错误处理、文档、部署脚本、安全审计、30 分钟观测                               | 生产部署手册可复现；上线检查清单全过；观测无异常                  |

预计总周期：M0-M7 为 8-12 周（视开发节奏；M0 治理底座优先，贯穿全程）。



***

## 12. 风险与缓解



| 风险                            | 影响       | 缓解                                                          |
| ----------------------------- | -------- | ----------------------------------------------------------- |
| SAA 1.1.2 较新，部分文档不全           | 踩坑       | 官方 examples 逐例跑通；锁定 BOM 版本；问题反馈社区                           |
| Spring AI 2.0/Boot 4 升级压力     | 未来迁移成本   | 架构上隔离 AI 层；暂不追新，稳定优先                                        |
| 通义千问成本                        | 费用       | qwen-flash 兜底、用量日志监控、限流、语义缓存、规则引擎优先                         |
| 前端兼容回归                        | 体验倒退     | 保留 API 契约 + 前端测试套件回归                                        |
| 文化数据质量                        | 编造风险     | seeds 数据人工核对，标注 "待核实"，优先复用现有 `src/data/`                    |
| `.harness` 治理体系落地过重           | 拖慢开发     | M0 先做最小集（rules + changes + wiki 引用）；skills 按里程碑增量补；红线清单先立后严 |
| 双份规则冲突（AGENTS.md vs .harness） | AI 行为不一致 | AGENTS.md 作为总入口指向 `.harness/`；rules 明确边界                    |



***

## 13. 验收标准（整体 Done 定义）



1. M0-M7 全部 Exit Criteria 达成（十阶段流水线每阶段 Gate 留痕）。

2. 前端 `npm run quality` 保持绿（现有门禁不回归）。

3. 后端测试覆盖率 ≥ 70%（核心业务 + AI 降级路径 100% 覆盖关键分支）。

4. 4 个典型用户场景可完整演示：注册→选茶→冲泡→品鉴→AI 茶记→AI 复盘→个性化荐茶。

5. `.harness` 治理体系落地：rules/wiki/changes 齐备，至少一个特性完整走完十阶段流水线（含评审记录与回滚演练）。

6. 部署文档可让任何人从零复现生产环境。

7. 开源仓库整洁：README、LICENSE、ADR、CHANGELOG、CONTRIBUTING 齐备。



***

## 14. 待确认问题（阻塞评审项）

**v0.1 遗留：**



1. 构建工具：Maven 还是 Gradle？（✅ **已定：Maven**，见 ADR-011）

2. 数据库初始化：flyway 还是 liquibase？（✅ **已定：Flyway**，见 ADR-011）

3. Redis：是否需要引入（会话 / 限流 / 缓存）？（✅ **已定：不引入**，Caffeine 本地缓存替代；biz-dev-skill 03-redis-cache 裁剪，见 ADR-011）

4. 部署形态：Windows 服务 / Docker Compose / 云主机？（✅ **已定：Docker Compose**，后端 + PG + 前端一键起）

5. 文化数据：新库 seeds 数据从现有 `backend/seeds/` 与 `src/data/` 整理迁移，是否接受？是否要补充更多茶文化内容？（✅ **已定：先迁移现有真实数据**，扩充后置带来源标注，见 ADR-011）

6. AI 成本上限：qwen 用量是否设置每日预算告警？（✅ **已定：设**，ai_usage_logs + 每日统计定时任务 + 超阈值告警，见 ADR-011）

7. 品鉴复盘等新功能是否纳入首版范围（M5），还是作为 M6 之后增强？（✅ **已定：入首版 M5**）

**v0.2 新增：**

8\. `.harness` 治理体系落地范围：完整照搬（rules + skills 全套 + agents）还是先最小集（rules + wiki 引用 + changes + 红线）？（✅ **已定：完整照搬**，M0 一次建齐；文件全量建、上下文仍按需加载）

9\. ORM 选型：Spring Data JPA 还是 MyBatis-Plus？（✅ **已定：Spring Data JPA**，理由见第 3 节技术选型表 + ADR-010）

10\. 专家角色命名（荐茶师 / 品鉴师 / 茶文化学者 / 冲泡教练 / 成长导师）是否需要与产品文案统一确认？（✅ **已定：技术命名先行** RecommendAgent/TastingAgent/CultureAgent/BrewCoach/GrowthMentor，中文文案后置，见 ADR-011）



***

*本文档依据已读代码事实 + 官方文档（*[java2ai.com](https://java2ai.com)*&#x20;版本说明、Spring AI Alibaba 概览）+ tulingshop&#x20;*`.harness`*&#x20;体系 33 图学习成果撰写；所有外部事实已标注来源。*