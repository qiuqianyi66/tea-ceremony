# Global Skills V2 Blueprint（Spring Boot Backend-First）

> 目标：把全局技能库重构为 **AI-native Full-stack Developer Skill OS**——后端主栈 Java + Spring Boot，前端保留 Vue/TS/Vite，AI Agent / Vibe Coding / Design 保持优势。
> 原则：**Routing 是瓶颈，不是 Storage**。最终 Global 规模 100–120 个高质量技能，不为"看起来全"堆数量。
> 状态：**规划文档（V1）**，未执行任何文件变更。逐项标记「保留 / 合并 / 删除 / 重写 / 新增」，等你确认后按阶段落地。

---

## 1. 已核实的版本基线（2026-09-29 官方确认）

| 生态 | 当前稳定线 | 备注 |
|---|---|---|
| Java | 17+（兼容至 26） | Spring Boot 4 最低要求 Java 17；技能按 Java 21 主写、覆盖 17/25 新特性 |
| Spring Boot | **4.1.1** | 2026-08-20 发布（98 bug fixes）；新技能一律按 Boot 4 写，不复刻 Boot 2/3 老教程 |
| Spring Framework | **7.0.9** | Boot 4.1.1 依赖要求 |
| Spring Data | 2026.0（4.1） | JPA / JDBC / R2DBC / Redis / MongoDB / Elasticsearch |
| Spring Cloud | 2025.1.3 | Gateway / Config / OpenFeign / Circuit Breaker / Bus / Stream / Contract |
| Spring AI | **2.0.0**（2.1.0-M1 已出） | 官方项目：ChatClient / RAG / Vector Store / Tool Calling / Advisors / MCP |
| 消息 | Spring AMQP / Spring Kafka / Spring Pulsar | 官方项目，均纳入 |
| 其他官方 | Batch / Integration / Modulith / GraphQL / Authorization Server | 均属 Spring 官方生态，非第三方杂烩 |

**技能编写基线**：一律面向 Spring Boot 4.x + Spring Framework 7.x + Java 21 编写，标注与 Boot 3.x 的差异点（如 Jakarta EE 10、AOT/Native、gRPC 自动配置、SSRF 缓解等）。

---

## 2. 现状盘点：77 个全局技能逐项动作

图例：✅保留  🔀合并  🗑删除  ✍️重写/扩展  ➕新增

### A. AI Development Workflow（优势层，不动）

| 技能 | 动作 | 去向 |
|---|---|---|
| agent-reach | ✅ | AI Engineering |
| brainstorming | ✅ | AI Engineering（superpowers 生态） |
| create-plan | ✅ | AI Engineering |
| dispatching-parallel-agents | ✅ | AI Engineering |
| executing-plans | ✅ | AI Engineering |
| receiving-code-review | ✅ | AI Engineering |
| requesting-code-review | ✅ | AI Engineering |
| reviewer | ✅ | AI Engineering |
| subagent-driven-development | ✅ | AI Engineering |
| systematic-debugging | ✅ | AI Engineering |
| test-driven-development | ✅ | AI Engineering |
| verification-before-completion | ✅ | AI Engineering |
| skill-creator | ✅ | AI Engineering |
| mcp-builder | ✅ | AI Engineering |
| using-git-worktrees | ✅ | AI Engineering |
| gh-fix-ci | ✅ | AI Engineering |
| using-superpowers | ✅ | AI Engineering |
| diagnosing-superpowers | ✅ | AI Engineering |
| finishing-a-development-branch | ✅ | AI Engineering |
| writing-guidelines | ✅ | AI Engineering |
| writing-plans | ✅ | AI Engineering |
| writing-skills | ✅ | AI Engineering |

### B. Frontend / 3D（优势层，不动）

| 技能 | 动作 | 去向 |
|---|---|---|
| javascript-core | ✅ | Frontend |
| typescript-core | ✅ | Frontend |
| vue-core | ✅ | Frontend |
| vue-component | ✅ | Frontend |
| vite | ✅ | Frontend |
| html-core | ✅ | Frontend |
| css-core | ✅ | Frontend |
| webapp-testing | ✅ | Frontend |
| web-design-guidelines | ✅ | Frontend |
| web-artifacts-builder | ✅ | Frontend |
| threejs-fundamentals | ✅ | Frontend·3D |
| threejs-webgl | ✅ | Frontend·3D |
| web3d-integration-patterns | ✅ | Frontend·3D |
| lightweight-3d-effects | ✅ | Frontend·3D |

### C. 文档/表格产物（不动）

| 技能 | 动作 | 去向 |
|---|---|---|
| docx | ✅ | Productivity |
| pdf | ✅ | Productivity |
| pptx | ✅ | Productivity |
| slides | ✅ | Productivity |
| xlsx | ✅ | Productivity |

### D. Design（过载，压缩 22 → 12）

| 技能 | 动作 | 去向 |
|---|---|---|
| brand | 🔀 | → `brand-system`（合并） |
| brand-guidelines | 🔀 | → `brand-system`（合并） |
| brandkit | 🔀 | → `brand-system`（合并） |
| design | 🔀 | → `design-system`（合并） |
| design-system | ✅ | Design 核心 |
| theme-factory | 🔀 | → `design-system`（合并） |
| design-transfer | 🔀 | → `design-implementation`（合并） |
| design-from-screenshot | 🔀 | → `design-implementation`（合并） |
| redesign-skill | 🔀 | → `design-implementation`（合并） |
| banner-design | 🔀 | → `design-implementation`（合并） |
| brutalist-skill | 🔀 | → `design-implementation`（合并） |
| minimalist-skill | 🔀 | → `design-implementation`（合并） |
| soft-skill | 🔀 | → `design-implementation`（合并） |
| stitch-skill | 🔀 | → `design-implementation`（合并） |
| output-skill | 🔀 | → `design-implementation`（合并） |
| imagegen-frontend-mobile | 🔀 | → `design-implementation`（合并） |
| imagegen-frontend-web | 🔀 | → `design-implementation`（合并） |
| figma-intake | 🔀 | → `figma`（合并） |
| figma-implement-design | 🔀 | → `figma`（合并） |
| taste-skill | ✅ | Design（核心品味基准） |
| gpt-tasteskill | 🔀 | → `taste-skill`（合并） |
| taste-skill-v1 | 🗑 | 删除（旧版，被 taste-skill 取代） |
| frontend-design | ✅ | Design（项目 AGENTS.md 引用） |
| frontend-design-spec | ✅ | Design（用户自维护全局规范，AGENTS.md 引用，**不可合并**） |
| functional-design | ✅ | Design（功能设计先行，项目门禁链联动） |
| impeccable | ✅ | Design（critique/audit/polish 评审） |
| ui-ux-pro-max | ✅ | Design（UX 实现，大技能保留） |
| algorithmic-art | ✅ | Design（算法创意，独立） |
| image-to-code-skill | ✅ | Design（图转代码，独立） |
| graphify | ✅ | Design（可视化/图解，独立） |

### E. 通用 / 工具（保留）

| 技能 | 动作 | 去向 |
|---|---|---|
| distilly | ✅ | Productivity（已同步上游） |
| ruflo | ✅ | AI Engineering（已同步上游） |
| Vibe-Skills | ✅ | AI Engineering（已同步上游） |
| show-me | ✅ | AI Engineering（架构可视化） |
| fastapi-endpoint | ✅ | **Secondary Backend**（保留但不再扩展；未来主后端是 Spring） |
| db-migration | ✍️ | 重写扩展为 Flyway/Liquibase 迁移技能（吸收进 `database-engineering` 体系） |

**动作统计**：✅ 保留 55 · 🔀 合并 22（产生 4 个新合并技能）· 🗑 删除 1 · ✍️ 重写 1
合并后 Design 类：22 → 12；77 → **约 70**（+4 新合并 = 74 目录项）。

---

## 3. 最终目录结构（15 大类）

```
GLOBAL SKILLS
├── 01. SOFTWARE ENGINEERING      ← architecture / system-design / design-patterns（新增精简层）
├── 02. JAVA                      ← java-core / java-concurrency / jvm-engineering（新增）
├── 03. SPRING                    ← spring-core / spring-boot / spring-web / spring-data / jpa-hibernate / spring-security / spring-testing / spring-production（新增）
├── 04. DATA                      ← database-engineering / postgresql / mysql / redis / elasticsearch / db-migration(重写)（新增）
├── 05. MESSAGING                 ← kafka / rabbitmq / event-driven-architecture（新增）
├── 06. DISTRIBUTED SYSTEM        ← distributed-systems / resilience-engineering（新增）
├── 07. SPRING CLOUD              ← spring-cloud（新增，内部含 gateway/config/feign/breaker）
├── 08. SECURITY                  ← spring-security / oauth2-oidc（新增；spring-security 已在 03 合并管理）
├── 09. TESTING                   ← spring-testing / testcontainers / api-design（新增；复用 test-driven-development）
├── 10. DEVOPS                    ← maven-gradle / container-engineering / ci-cd / kubernetes（新增）
├── 11. OBSERVABILITY             ← observability / performance-engineering / production-debugging（新增）
├── 12. AI BACKEND                ← spring-ai / rag / vector-database / ai-backend-engineering / ai-observability（新增）
├── 13. FRONTEND                  ← javascript-core / typescript-core / vue-core / vue-component / vite / html-core / css-core / webapp-testing / web-design-guidelines / web-artifacts-builder / threejs-*（现有保留）
├── 14. DESIGN                    ← design-system / frontend-design / frontend-design-spec / design-implementation / figma / taste-skill / ui-ux-pro-max / impeccable / functional-design / brand-system / algorithmic-art / image-to-code-skill / graphify（重构后）
├── 15. AI DEVELOPMENT WORKFLOW   ← agent-reach / create-plan / brainstorming / subagent-driven-development / executing-plans / writing-* / reviewer / systematic-debugging / test-driven-development / verification-before-completion / skill-creator / mcp-builder / ruflo / Vibe-Skills / show-me / using-* / gh-fix-ci / dispatching-parallel-agents / receiving|requesting-code-review / diagnosing-superpowers / using-superpowers / finishing-a-development-branch（现有保留）
└── 00. PRODUCTIVITY              ← docx / pdf / pptx / slides / xlsx / distilly（现有保留）
```

> 说明：01 SOFTWARE ENGINEERING 是新增的精简层（3 个技能：architecture / system-design / design-patterns），承接 Java/Spring 后端所需的工程判断；若嫌多可砍成 1 个 `software-engineering`。类别是**组织视图**，不要求物理建目录——SKILL.md 的 description 足够路由，类别只用于清单可读性。

---

## 4. 新增技能边界（P0 / P1 / P2）

> 每个技能：定位一句话 + 核心边界。触发场景 = 用户问什么时命中它。

### 🔴 P0 — Spring Backend Core（第一批，17 个）

**JAVA 层**
1. **java-core** — Java 语言地基，面向 17/21/25。
  边界：Collections · Generics · Lambda/Streams · Optional · Records · Sealed Classes · Pattern Matching · Exception Handling · I/O/NIO · Date/Time · Reflection/Annotations · 函数式编程。
  触发：写 Java 代码、看不懂语法、选型"用 Optional 还是 null"。

2. **java-concurrency** — 并发正确性（现代 Boot 必读）。
  边界：Thread/Executor/ExecutorService · CompletableFuture/Future · **Virtual Threads** · Locks/Atomic · Concurrent Collections · Synchronization · **Structured Concurrency** · 线程池调参。
  触发：接口慢、线程安全问题、虚拟线程迁移（Boot 4 默认启用 Tomcat 虚拟线程）。

3. **jvm-engineering** — JVM 运行机制与调优。
  边界：Heap/Stack/Metaspace · GC（G1/ZGC）· Memory Leak · Thread Dump/Heap Dump · **JFR** · JVM 参数调优。
  触发：OOM、GC 停顿、内存飙高、启动参数怎么配。

**SPRING 层**
4. **spring-core** — 理解 Spring 为什么能工作（不是注解大全）。
  边界：IoC/DI · Bean 生命周期 · ApplicationContext · ComponentScan · Configuration/Profiles/Scopes · Events · **AOP/Proxy/Interceptor/Aspect** · SpEL · Validation/Data Binding。
  触发：Bean 不生效、循环依赖、AOP 切不上、事件解耦、Profile 切换。

5. **spring-boot** — 核心 Skill，重点打造。
  边界：Starter/Auto-Configuration/**Conditional Beans** · Configuration Properties · Application Lifecycle · Actuator · Logging · Error Handling · External Config · Health Checks/Metrics · 生产打包 · **Native Image/AOT**（Boot 4 关键）。
  触发：建新项目、配置不生效、生产环境排查、性能/内存优化（AOT）。

6. **spring-web** — API Engineering 层（替代 fastapi-endpoint 的主后端版本）。
  边界：Spring MVC · REST/Controller/DTO · Request/Response Validation · 全局异常/Problem Details · Pagination/Sorting/Filtering · 文件上传下载 · Streaming/SSE/WebSocket · CORS/Content Negotiation · WebClient/RestClient · **OpenAPI/Swagger · API Versioning · Idempotency · Rate Limiting · Webhooks**。
  触发：写接口、接口规范、分页过滤、SSE 推送、API 设计评审。

7. **spring-data** — 数据访问体系（不止 JPA）。
  边界：JPA · JDBC · **R2DBC**（响应式）· Redis · MongoDB · Elasticsearch · **@Transactional 全生命周期** · Repository 抽象。
  触发：连数据库、选数据访问方式、事务不生效。

8. **jpa-hibernate** — 后端最不能糊弄的一块，独立成技能。
  边界：Entity/Persistence Context · 映射（1:1/1:N/N:M）· **Lazy/Eager Loading · N+1 · Fetch Join · EntityGraph** · JPQL/Criteria/Specification · Pagination · **Optimistic/Pessimistic Lock · Dirty Checking · 一级/二级缓存 · Batch Insert/Fetch**。
  触发：慢查询、N+1、锁冲突、缓存问题、复杂查询怎么写。

9. **spring-security** — 认证授权与攻击防护。
  边界：Authentication/Authorization · SecurityFilterChain · Password Encoding · Method Security · RBAC/ABAC · **JWT/OAuth2/OIDC · Resource Server/Client** · CSRF/CORS/Security Headers · Session · 暴力破解防护。
  触发：登录鉴权、接口权限、JWT 签发校验、OAuth2 对接。

**DATA 层**
10. **database-engineering** — 数据库工程判断（不写死某个 DB）。
  边界：Schema Design/Normalization · Index · Transaction Isolation · Lock/Deadlock · Query Optimization · Connection Pool · ACID/MVCC · Backup/Recovery/Migration 策略。
  触发：建表、索引选择、死锁、慢 SQL、连接池耗尽。

11. **postgresql** — PostgreSQL 专项。
  边界：JSONB · GIN/GiST · CTE · Window Functions · Full-Text Search · Partitioning · Explain/Analyze。
  触发：PG 慢查询、JSON 字段、全文检索、分区表。

12. **redis** — Boot 后端绕不开。
  边界：Cache/Session · **Distributed Lock** · Counter · Rate Limiting · Pub/Sub/Streams · TTL/Eviction · **缓存穿透/击穿/雪崩** · Redlock 边界。
  触发：缓存设计、分布式锁、限流、缓存雪崩排查。

**BUILD / TEST / OPS 层**
13. **maven-gradle** — 构建体系（合并 Maven + Gradle）。
  边界：Maven：pom/dependency/plugin/profile/lifecycle/multi-module/parent BOM/依赖冲突 · Gradle：build.gradle/plugins/version catalog/task/build cache；重点 Boot 4 构建。
  触发：pom 报错、依赖冲突、多模块工程、换构建工具。

14. **spring-testing** — Spring 测试体系。
  边界：JUnit 5 · Mockito · Spring Test · MockMvc/WebTestClient · @SpringBootTest/@DataJpaTest/@WebMvcTest · **Testcontainers 集成** · DB/API/Contract Test。
  触发：写后端测试、分层测试、集成测试。

15. **testcontainers** — 真实基础设施测试（单独成技能，值得）。
  边界：PostgreSQL/Redis/Kafka/RabbitMQ 容器化测试 · 启动策略 · CI 中复用 · 与 @ServiceConnection 集成。
  触发：测试要连真实中间件、CI 里跑容器测试。

16. **container-engineering** — Docker + Compose（合并）。
  边界：Dockerfile 优化（分层/多阶段/非 root）· 镜像瘦身 · Compose 编排 · **Spring Boot 容器化最佳实践**（buildpacks/jib/原生镜像）。
  触发：写 Dockerfile、容器启动问题、镜像太大。

17. **observability** — Boot 生产必备（不是"额外高级"）。
  边界：Logging（结构化/Correlation ID）· **Metrics（Micrometer/Prometheus/Grafana）** · Tracing（OpenTelemetry）· Actuator endpoints · HTTP exchanges · 健康检查。
  触发：上线后监控、指标看板、链路追踪、日志排查。

### 🟠 P1 — Production Engineering（第二批，13 个）

18. **mysql** — MySQL 专项：InnoDB · Index · Explain · 事务隔离 · 复制 · 分区 · 性能。
19. **elasticsearch** — 搜索/分析：Mapping/Analysis · 查询 DSL · 聚合 · 与 Spring Data ES 集成。
20. **kafka** — Producer/Consumer/Partition/Offset/Consumer Group/Rebalance · 顺序性 · 复制/保留 · **Exactly-Once/At-Least-Once · 幂等 · DLQ/Retry · Kafka Transactions** · Spring Kafka。
21. **rabbitmq** — Exchange/Queue/Binding/Routing Key · Ack/Nack · Retry/DLQ/TTL · Prefetch · Publisher Confirm · Spring AMQP。
22. **distributed-systems** — 分水岭层：CAP/BASE · 一致性 · Replication/Leader Election · 分布式锁/ID · **幂等/重试/退避** · 断路器/舱壁/超时/限流 · 负载均衡 · **Saga/Outbox/CQRS/Event Sourcing**。
23. **event-driven-architecture** — 事件建模：事件/命令/查询划分 · 事件版本 · 事件溯源权衡 · 与 Kafka/Rabbit 落地。
24. **resilience-engineering** — 韧性：Resilience4j（Circuit Breaker/Bulkhead/Retry/Timeout/RateLimiter）· 降级/兜底 · 故障注入。
25. **spring-cloud** — 微服务落地（一个技能装全部）：Gateway · Config · **OpenFeign** · Circuit Breaker · Service Discovery/Load Balancing · Bus · Contract · **微服务边界的判断（何时不该拆）**。
26. **api-design** — API 设计规范：REST 资源建模 · OpenAPI 契约先行 · 版本策略 · 错误码体系 · Idempotency-Key · Webhooks 设计。
27. **performance-engineering** — 性能工程：CPU/内存/分配/GC/并发 profiling · **JMH** · 基准与回归 · 连接池/线程池调优。
28. **production-debugging** — 生产排障：Thread/Heap Dump · JFR 分析 · 慢请求链路 · 连接池耗尽/线程耗尽/GC 停顿 · 根因方法论。
29. **ci-cd** — CI/CD 体系：GitHub Actions · 流水线设计 · 多环境 · 制品管理 · 发布策略（蓝绿/金丝雀）。
30. **kubernetes** — K8s 部署：Deployment/Service/Ingress · ConfigMap/Secret · 探针 · 资源限制 · **Spring Boot on K8s** ·（Helm 进 P2）。

### 🟡 P2 — AI Backend & 高级（第三批，11 个，可延后）

31. **spring-ai** — 重点：ChatClient 流式 · Structured Output · **Tool Calling/@Tool** · Advisors · Memory · **MCP 集成** · 模型可移植（OpenAI/Anthropic/Gemini/DeepSeek）。
32. **rag** — RAG 工程：Embedding · Chunking · Retrieval 策略 · **Advisor API 落地 RAG** · 评估。
33. **vector-database** — Vector DB 选型与操作：PGVector/Redis/Milvus/Qdrant · 索引（HNSW/IVF）· 混合检索 · Spring AI VectorStore。
34. **ai-backend-engineering** — AI 后端工程化：流式 SSE · 超时/重试/降级 · Token 成本控制 · 并发与背压 · AI 网关。
35. **ai-observability** — AI 可观测：Token/成本/延迟指标 · 追踪（LLM spans）· 评估集 · 幻觉检测。
36. **spring-batch** — 批处理：Job/Step/Chunk · 读-处理-写 · 重启/跳过/事务 · 性能。
37. **spring-integration** — 集成：消息通道/网关/路由器 · 与 AMQP/Kafka 衔接。
38. **spring-modulith** — 模块化单体：模块边界 · 验证 · 事件发布 · 演进到微服务的判断。
39. **spring-graphql** — GraphQL（含 GraphQL 基础 + Spring GraphQL 实现）：Schema/Query/Mutation · 数据加载器（N+1）· 订阅。
40. **helm** — Helm 打包：Chart 结构 · Values 设计 · 与 K8s 技能配套。
41. **cloud-native** — 云原生综合：12-Factor · 配置外置 · 可移植性 · 与 Boot 4 原生镜像衔接。

---

## 5. 合并 / 删除 / 重写明细

**删除（1）**
- `taste-skill-v1`：旧版，被 taste-skill 取代。删除前先确认无独有内容（已核：无）。

**合并（22 → 4 个新技能）**
| 新技能 | 吸收 |
|---|---|
| `brand-system` | brand + brand-guidelines + brandkit |
| `design-system` | design-system + design + theme-factory |
| `design-implementation` | design-transfer + design-from-screenshot + redesign-skill + banner-design + brutalist-skill + minimalist-skill + soft-skill + stitch-skill + output-skill + imagegen-frontend-mobile + imagegen-frontend-web |
| `figma` | figma-intake + figma-implement-design |
| `taste-skill`（吸收） | + gpt-tasteskill |

> 合并方式：保留被吸收技能中的**独有能力段落**，重写为一个统一的 SKILL.md（含分类触发指引），删除旧目录。备份先行（沿用 Temp\skills-backup-20260929 模式）。

**重写（1）**
- `db-migration`：从通用迁移技能扩展为 **Flyway / Liquibase 迁移技能**（Spring 生态标准），吸收进 DATA 层。

**明确不动的**
- `frontend-design-spec`（用户自维护，AGENTS.md 引用）、`frontend-design`（项目引用）、`functional-design`、`impeccable`、`ui-ux-pro-max`——设计压缩不牺牲这些关键资产。
- `fastapi-endpoint`：保留为 Secondary Backend，仅在用户点名 FastAPI 时触发。

---

## 6. 规模核算

| 阶段 | 数量 |
|---|---|
| 当前 | 77 |
| 合并/删除后 | 约 74（目录项） |
| + P0（17） | 约 91 |
| + P1（13） | **约 104** ✓（落在 100–120 目标区间） |
| + P2（11，可选） | 约 115 |

P0+P1 即达成目标形态；P2 按需渐进，避免一次铺满。

---

## 7. 落地顺序（五阶段）

**阶段 0 · 快照与基线**
备份全局技能库 → 更新本 Blueprint 至 v1 定稿 → 你确认动作清单。

**阶段 1 · 清理（半天）**
删除 taste-skill-v1 · 执行 5 组合并（brand-system / design-system / design-implementation / figma / taste-skill 吸收）· 验证合并技能 frontmatter + 触发质量。

**阶段 2 · Spring Backend Core（重点，分批）**
P0 17 个技能按序创建：JAVA 3 → SPRING 7 → DATA 3 → BUILD/TEST/OPS 4。
每个技能：SKILL.md（定位/边界/触发/反例）+ 必要时 references/ 目录；写完后用 skill-creator 流程做触发测试。

**阶段 3 · Production Engineering**
P1 13 个技能：DATA 2 → MESSAGING 3 → DISTRIBUTED 3 → CLOUD 1 → API/PERF/OPS 4。

**阶段 4 · AI Backend**
P2 11 个（spring-ai 优先，其余按需）：与现有 mcp-builder / agent-reach 衔接，形成 Vue → Spring Boot → Spring AI → LLM → RAG → Vector DB → MCP 全链。

**阶段 5 · 收口**
全量体检（复用 技能库体检清单 流程）· 更新清单文档 · 记 ADR-008（Skill OS 架构）· 更新 AGENTS.md 引用。

---

## 8. 与项目技能的关系（66 个不动）

- tea 项目 `.agents/skills` 66 个**全部保留**：项目定制（db-migration 项目版 / fastapi-endpoint / vue-component / show-me）+ 项目独有（threejs-* 全套 / vue-* / typescript-* / tea-tasting 等）。
- 新增的 Java/Spring 技能是**全局**的（跨项目通用），不放进 tea 项目。
- 若未来有新的 Java/Spring 项目，按「项目独有的放项目、通用的放全局」分工走，不重复本轮的教训。
- `db-migration` 重写为 Flyway/Liquibase 后，tea 项目版保持不动（项目用 Alembic，属既有事实，不迁移）。

---

## 9. 待你确认的决策点

1. **P0+P1 一次性全做，还是按阶段分批落地？**（建议：阶段 1 清理先做，P0 分 2-3 批）
2. **01 SOFTWARE ENGINEERING 精简层**：3 个（architecture/system-design/design-patterns）还是砍成 1 个？
3. **Design 压缩幅度**：按本表 22→12，还是更激进压到 6（你长文方案）？——我保留了 frontend-design-spec / functional-design / impeccable / ui-ux-pro-max / taste-skill 这几个关键资产，所以是 12 不是 6。
4. **db-migration 重写**为 Flyway/Liquibase：确认？（tea 项目版不动）
5. **spring-security 与 08 SECURITY 层**：security 相关只做一个 spring-security（含 OAuth2/OIDC），不做独立 oauth2-oidc 技能——同意？
6. **P2 是否纳入本 Blueprint 的执行范围**：spring-ai 强烈建议做（与你的 AI 方向天然衔接），spring-batch 等可延后。

---

*文档版本 v1 · 2026-09-29 · 配套文件：技能库体检清单.md（现状基线）、CONTEXT.md ADR-007（技能库分工）*
