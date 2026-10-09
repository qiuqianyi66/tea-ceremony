# CONTEXT.md — 一盏茶项目共享语言

> 本文件定义项目的统一术语、ADR 索引与架构关键词。AI 助手和开发者都使用这里的术语沟通，避免每次重新解释。
> 新增术语、架构决策或关键状态变更时同步更新本文件；ADR 正文在 `docs/ADR/`，架构细节在 `docs/architecture/system-overview.md`。

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
| AI 茶灵 | 茶文化 RAG 检索 + LLM 对话（走后端代理），网络不可用时降级规则回复 | `src/services/teaAI.ts` |
| 茶器 | 泡茶器具（盖碗、紫砂壶、玻璃杯等），影响工艺系数 | `src/data/teawares.ts` |
| 水源 | 冲泡用水（纯净水、矿泉水、山泉水），影响工艺系数 | `src/data/constants.ts` |
| 业务异常 | service 层抛出的统一异常（BadRequest 400 / Unauthorized 401 / NotFound 404 / Conflict 409），router 不直接 raise HTTPException | `backend/app/exceptions.py` |
| Service 层 | 后端业务逻辑下沉层：CRUD、幂等、密码哈希、JWT 签发；router 只做参数与响应 | `backend/app/services/` |
| 幂等创建 | 品鉴记录 / 茶园种植按 `user_id + client_id` 去重，重复提交返回同一条 | `backend/app/services/record_service.py` |
| 目标用户 | 茶小白 / 有品茶习惯的人 / 冥想·慢生活人群；功能取舍以「三类用户能否完成一席完整茶事」为准 | 定位见 README |

---

## 架构决策记录（ADR）

ADR 独立文件见 `docs/ADR/`（ADR-009 起统一格式：Status / Context / Decision / Consequences / Rejected），索引：

| ADR | 主题 | 状态 |
|---|---|---|
| [ADR-001](docs/ADR/ADR-001.md) | 离线优先的数据层 | Accepted |
| [ADR-002](docs/ADR/ADR-002.md) | 可解释评分模型 | Accepted |
| [ADR-003](docs/ADR/ADR-003.md) | AI 降级策略 | Accepted |
| [ADR-004](docs/ADR/ADR-004.md) | 前后端分离 + Nginx 代理 | Accepted |
| [ADR-005](docs/ADR/ADR-005.md) | SQLAlchemy 2.0 异步 + Alembic 迁移 | Accepted |
| [ADR-006](docs/ADR/ADR-006.md) | 本地行为埋点（不远程上报） | Accepted |
| [ADR-007](docs/ADR/ADR-007.md) | 技能库分工（全局权威 vs 项目专属） | Accepted |
| [ADR-008](docs/ADR/ADR-008.md) | 全局技能库重构为 Spring Boot Full-stack Skill OS | Accepted |
| [ADR-009](docs/ADR/ADR-009.md) | 文档治理与 AI 协作规范重构（V4） | Accepted |
| [ADR-010](docs/ADR/ADR-010.md) | 后端重写 ORM 选型（Spring Data JPA） | Accepted |
| [ADR-011](docs/ADR/ADR-011.md) | 后端重写工程决策（Maven / Flyway / 无 Redis / seeds 迁移 / AI 成本告警 / 角色命名） | Accepted |
| [ADR-012](docs/ADR/ADR-012.md) | 引入 Redis（两级缓存 / 语义缓存 / 分布式限流 / JWT 黑名单，修订 ADR-011 无 Redis） | Accepted |
| [ADR-013](docs/ADR/ADR-013.md) | 引入 pgvector + pg_trgm 混合检索（S2 知识检索升级） | Accepted |
| [ADR-014](docs/ADR/ADR-014.md) | ArchUnit 事务与响应契约机械化（H18/K10） | Accepted |
| [ADR-013](docs/ADR/ADR-013.md) | pgvector + pg_trgm 混合检索（S2 知识检索升级，同库扩展） | Accepted |

新决策一律写入 `docs/ADR/ADR-0XX.md`，禁止塞进本文档。

---

## 架构关键词

- 前端：Vue 3.5 + TS 6（strict）+ Pinia 4 + Tailwind 4 + Vite 8 + TresJS 5.8 / Three 0.185 + Dexie 4 + ECharts 6 / Chart.js 4，Node 22.18+
- 后端：FastAPI 0.115 + SQLAlchemy 2.0（async）+ Alembic + PostgreSQL 16+ + Pydantic v2，Python 3.12+
- 分层：前端 `views → stores → services`；后端 `router → service → model`，router 只做参数与响应；AI 请求必须走后端代理 `/api/ai/*`，禁止浏览器直连
- 部署：Windows Server 原生（NSSM + uvicorn + nginx for Windows），Docker 已弃用；详见 `DEPLOY.md`
- 详细架构、目录速查与数据流：`docs/architecture/system-overview.md`

---

## 待办与已知限制

- [x] 单元测试与 E2E 测试已落地（Vitest 142 用例 / Playwright 34 例 / pytest 51 过 3 跳，2026-09-20 基线）
- [x] AI 第三方请求已收敛到后端代理（`/api/ai/*`，浏览器不再直连；DeepSeek）
- [x] 用户公开品鉴卡片和分享链接已实现（二维码 / `/share` 只读页）
- [x] 冲泡页已升级为 TresJS 3D 茶席 + 实景夜色暖光背景（`3D_SPEC.md`）
- [ ] 第六阶段「简历与面试材料」未做（用户明确不做，暂缓）
- [ ] 演示短视频未做（用户暂缓）
- [x] 迁移测试本地跑：`TEST_DATABASE_URL` 指向本地 PG 服务即可（不再依赖 Docker），CI 用 Postgres service
- [ ] 生产规模扩展（Redis 分布式限流、Sentry 异常追踪）非必需，可按需推进
- [x] 生产级收敛 P1（数据治理 DATA_POLICY / 测试体系 TESTING_SPEC / Design Spec 拆分 DESIGN_SPEC+3D_SPEC，2026-10 完成）
- [ ] 生产级收敛 P2（回归测试体系剩余 / 部署运维 PRD 化）待排期
