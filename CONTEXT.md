# CONTEXT.md — 一盏茶项目共享语言

> 本文件定义项目统一术语、ADR 索引与架构关键词；AI 与开发者共用同一语言，避免每次重新解释。
> 新增术语/决策/关键状态变更时同步本文件。ADR 正文在 `docs/ADR/`（ADR-0XX.md 独立文件），架构细节在 `docs/architecture/system-overview.md`。

---

## 核心概念

| 术语 | 定义 | 代码位置 |
|------|------|----------|
| 茶席 | 一次完整的茶道体验流程：入席→选茶→备器→煮水→冲泡→品鉴 | `src/views/` |
| 冲泡 | 投茶、注水、浸泡、出汤的交互过程（3D 茶席视觉） | `src/views/BrewView.vue` |
| 品鉴 | 观色、闻香、品味三步评分流程 | `src/views/TasteView.vue` |
| 八维评分 | 汤色、香气、滋味、苦涩、生津、喉韵、耐泡度、协调性 | `src/services/scoring.ts` |
| 工艺系数 | 水温、投茶量、时间、茶器、水源对评分的修正系数（0.8-1.2） | `src/services/scoring.ts` |
| 离线优先 | 数据先写 IndexedDB，再异步同步后端 | `src/services/storage/` |
| 同步状态 | pending / synced / failed 三态 | `src/types/tasting.ts` |
| AI 茶灵 | 五专家（单请求单专家路由）+ 茶文化 RAG + LLM 对话（走后端代理），网络不可用时降级规则回复 | `src/services/teaAI.ts` + `backend/.../ai/` |
| 茶器 | 泡茶器具（盖碗、紫砂壶、玻璃杯等），影响工艺系数 | `src/data/teawares.ts` |
| 水源 | 冲泡用水（纯净水、矿泉水、山泉水），影响工艺系数 | `src/data/constants.ts` |
| 业务异常 | service 层抛出的统一异常（BadRequest 400 / Unauthorized 401 / NotFound 404 / Conflict 409），Controller 不直接抛 HTTPException | `backend/src/main/java/com/tea/common/` |
| Service 层 | 后端业务逻辑下沉层：CRUD、幂等、密码哈希、JWT 签发；Controller 只做参数与响应 | `backend/src/main/java/com/tea/` |
| 幂等创建 | 品鉴记录 / 茶园种植按 `user_id + client_id` 去重，重复提交返回同一条 | `backend/src/main/java/com/tea/record/` |
| 目标用户 | 茶小白 / 有品茶习惯的人 / 冥想·慢生活人群；功能取舍以「三类用户能否完成一席完整茶事」为准 | 定位见 README |

---

## 架构决策记录（ADR）

独立文件见 `docs/ADR/`（ADR-009 起统一格式：Status / Context / Decision / Consequences / Rejected）。索引（状态均为 Accepted）：

| ADR | 主题 | ADR | 主题 |
|---|---|---|---|
| ADR-001 | 离线优先的数据层 | ADR-011 | 后端重写工程决策（Maven / Flyway / 无 Redis / seeds 迁移 / AI 成本告警 / 角色命名） |
| ADR-002 | 可解释评分模型 | ADR-012 | 引入 Redis（两级缓存 / 语义缓存 / 分布式限流 / JWT 黑名单，修订 011） |
| ADR-003 | AI 降级策略 | ADR-013 | 引入 pgvector + pg_trgm 混合检索（S2 知识检索升级） |
| ADR-004 | 前后端分离 + Nginx 代理 | ADR-014 | ArchUnit 事务与响应契约机械化（H18/K10） |
| ADR-005 | SQLAlchemy 2.0 异步 + Alembic 迁移 | ADR-015 | 茶园能量账本（S1，garden 域 + V4 迁移） |
| ADR-006 | 本地行为埋点（不远程上报） | ADR-016 | AI 评测 Trace 四层归因（V5 `ai_eval_traces`） |
| ADR-007 | 技能库分工（全局权威 vs 项目专属） | ADR-017 | 运行时领域技能（V6 `agent_skills`） |
| ADR-008 | 全局技能库重构为 Spring Boot Full-stack Skill OS | ADR-018 | Spring AI Alibaba Graph 引入暂缓 |
| ADR-009 | 文档治理与 AI 协作规范重构（V4） | ADR-019 | 任务控制协议上收至最高规范（分诊 / 拆解 / 客观执行） |
| ADR-010 | 后端重写 ORM 选型（Spring Data JPA） | ADR-020 | SFT 微调纳入执行范围（推翻「只出概念文档」） |
| ADR-011 | 不引入 Redis（单实例够用） | ADR-021 | 暂不引入 Redis（修订 ADR-012，前提失效 + 代码零实现） |
| ADR-022 | 匿名遥测上报（部分取代 ADR-006 的「不上报」） | ADR-023 | AI 多级兜底与分链路熔断 |
| ADR-024 | A/B 实验与异常自动回滚 | ADR-025 | Prometheus 指标导出与告警栈 |
| ADR-026 | AI 回答质量评分（quality_layer） | ADR-027 | 品鉴综合评分按六大茶类加权 |

新决策一律写入 `docs/ADR/ADR-0XX.md`，禁止塞进本文档。

---

## 架构关键词

- 前端：Vue 3.5 + TS 6（strict）+ Pinia 4 + Tailwind 4 + Vite 8 + TresJS 5.8 / Three 0.185 + Dexie 4 + ECharts 6 / Chart.js 4，Node 22.18+
- 后端（新栈）：Spring Boot 3.5 + Spring Data JPA + Spring AI Alibaba（DashScope）+ Flyway + PostgreSQL 16 + pgvector，Java 17+；旧栈 FastAPI 0.115 + SQLAlchemy 2.0（async）+ Alembic 仅维护不新增
- 分层：前端 `views → stores → services`；后端 `Controller → Service → Repository`，Controller 只做参数与响应；AI 请求必须走后端代理 `/api/v1/ai/*`，禁止浏览器直连
- 部署：Docker Compose 编排（db / backend / frontend），旧 Windows 原生脚本保留参考；详见 `DEPLOY.md`
- 详细架构、目录速查与数据流：`docs/architecture/system-overview.md`

---

## 待办与已知限制

- [ ] 第六阶段「简历与面试材料」未做（用户明确不做，暂缓）
- [ ] 演示短视频未做（用户暂缓）
- [ ] 生产级收敛 P2（回归测试体系剩余 / 部署运维 PRD 化）待排期
- 测试基线（2026-09-20）：Vitest 142 用例 / Playwright 34 例 / pytest 51 过 3 跳；迁移测试本地跑只需 `TEST_DATABASE_URL` 指向本地 PG（CI 用 Postgres service）
- 到期需复核的架构前提：Redis 四场景（ADR-012 **已被 ADR-021 取代：代码零实现，暂不引入**）、pgvector 混合检索（ADR-013）
- 已完成里程碑（AI 代理收敛、公开品鉴分享、TresJS 3D 茶席、生产级收敛 P1）见 `CHANGELOG.md` 与对应 ADR
