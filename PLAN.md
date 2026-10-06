# PLAN — M1 Spring Boot 后端骨架

> 依据：plan-control（Plan Mode V4.1，Controlled Track）+ HANDOFF-2026-10-05 §8 + PRD v0.2（10 项决策全定案，ADR-010/011）。
> 批准后按十阶段流水线执行：request-analysis → coding-skill → unit-test → expert-reviewer。

## Goal

交付可独立验证的 M1 地基：`backend/` 下 Spring Boot 3.5 Maven 工程（与旧 FastAPI 并存，不动 `backend/app`），含 Flyway V1 初始迁移（7 表 + 往返测试）、基础骨架（`ApiResponse<T>` / BusinessError / 全局异常）、健康端点，跑通 `mvn compile` + 单测 + 容器 Postgres 冒烟。

## Context

- **现状**：前端五阶段+P0/P1 ✅；M0 治理底座 ✅（rules/wiki/changes/技能库 30/子代理/CI）；**M1 尚未开始**。
- **已锁定**：Spring Boot 3.5.x + JDK 21（本机已装 Temurin 21.0.10，满足 PRD "JDK 17+"）；Spring Data JPA（ADR-010）；Spring AI Alibaba 1.1.2.0（ADR-011）；Flyway 迁移（成对 + 往返）；无 Redis（Caffeine）/ 无 RocketMQ（Spring Event）；Docker Compose 部署。
- **环境探测结果**：JDK 21 ✅ / Maven 3.9.12 ✅ / Docker 29.6.1 ✅ / psql 客户端 ❌（用 Docker postgres 容器 + `docker exec` 替代）。
- **相关文件**：`.harness/rules/工程结构.md` §四（backend 目标结构，本 PLAN 的目录唯一依据）；`.harness/rules/编码规范.md`（15 红线，尤其 #7 迁移）；`.harness/wiki/data-model.md`（表结构唯一来源，T3 执行时读取，本 PLAN 不编造字段）；`.harness/changes/_template/`（三件套）。
- **双栈边界**：旧 FastAPI（`backend/app`）仅维护不新增；重写完成后整段退役，迁移脚本在 `changes/` 留档。

## Risk Assessment

```
risk:
  score: 10        # Impact 3 + Scope 3 + Uncertainty 2 + Irreversibility 2
  level: HIGH      # → Controlled Track
  evidence:
    - reason: 后端第一块地基，后续所有切片依赖它（影响系统级）
      affected_area: backend/、数据库、Docker Compose、CI
      possible_failure: 表结构定错 → 后续切片返工
    - reason: 跨系统（新工程 + 数据库 + 容器编排）
      affected_area: backend/ + postgres + compose
      possible_failure: 依赖拉取失败 / 容器网络不通
    - reason: 表结构是长期契约，改字段有迁移成本
      affected_area: Flyway V1 迁移
      possible_failure: 字段与 wiki data-model 不一致
    - reason: 可回滚（git 分支 + Flyway downgrade + 容器可重建）
      affected_area: 全流程
      possible_failure: 无（可逆）
```

## Confidence

```
confidence:
  level: MEDIUM-HIGH
  basis: 目标明确（HANDOFF §8）/ 技术决策全锁（PRD+ADR-010/011）/ 环境已探测 / 目录结构有规范
  unknowns: 依赖拉取网络可用性；用户批准范围（批 A 或 A+B）
```

## Approach

**分批执行，本轮建议只做批 A（M1.1 地基）**：工程 + 迁移 + 骨架是可独立验证的最小地基，验收即冒烟通过，风险收敛后再进批 B（认证/领域切片）。理由：M1.1 失败成本低、返工面小；一次全量 8 步战线太长，任何一步的返工都波及后续。

新工程与旧 FastAPI 共存：按工程结构规范 §四，`backend/` 下新增 Maven `pom.xml` + `src/`，**不触碰 `backend/app`、`migrations/`、`alembic.ini`**。

## Tasks

### 批 A — M1.1 地基（本轮，批准后执行）

| # | Task | Input | Action | Output | Validation |
|---|---|---|---|---|---|
| T1 | 变更初始化 | git main | `git checkout -b feature/m1-backend-skeleton`；建 `.harness/changes/m1-backend-skeleton/{summary,db-migrations,rollback}.md/.sql` | 分支 + 三件套 | 分支存在、模板字段齐 |
| T2 | Maven 工程初始化 | 工程结构规范 §四 | `backend/pom.xml`（Spring Boot 3.5.x parent + JDK21 + web/JPA/Security/Validation/Flyway/PostgreSQL/Spring AI Alibaba 1.1.2.0/test）；`TeaApplication.java`；`application.yml` + `application-dev.yml` | 工程骨架 | `mvn -q compile` 通过 |
| T3 | Flyway V1 初始迁移 | `.harness/wiki/data-model.md`（表结构唯一来源） | `V1__init.sql`：users / teas / tasting_records / tea_wares / culture_documents / agent_prompts / ai_usage_logs + 索引；`changes/` 三件套同步留档；upgrade/downgrade 成对 | V1 迁移 + 往返 | Docker postgres:16 起容器 → `flyway`/启动时 migrate → downgrade → upgrade 往返通过（L3，红线 #7） |
| T4 | 基础骨架 | 编码规范 §异常/响应 | `common/exception`（BusinessError + BadRequest/Unauthorized/NotFound/Conflict）、`common/response`（ApiResponse<T>）、`@RestControllerAdvice` 全局异常、error-code 表、健康端点 | 骨架代码 | `mvn -q test` 单测通过；type 风格符合规范 |
| T5 | 冒烟验证 | T2-T4 产物 | 起服务连容器 Postgres，请求健康端点 + 一个异常路径 | 冒烟记录 | 健康端点 200、异常响应格式统一（ApiResponse） |

### 批 B — M1.2 认证 + 领域切片（批准后下一轮，本 PLAN 仅列边界）

- T6 auth：注册/登录（JWT + BCrypt，Spring Security）
- T7 tea：茶叶 CRUD + 文化 seeds 迁移（`src/data/` → Flyway V2）
- T8 record：品鉴记录（client_id 幂等 + 八维评分 × 工艺系数，可解释性）
- T9 docker-compose 编排（backend/frontend/postgres/nginx）+ CI 接线

## Trade-offs

| 选择 | 取舍 |
|---|---|
| 分批（A → B） vs 一次全量 | 分批：M1.1 独立可验证，返工面小；全量：战线长、返工波及后续。**选分批** |
| backend/ 共存 vs 新建独立目录 | 共存符合工程结构规范 §四（backend/ 即 Maven 工程目标位）；旧 app/ 不动。**选共存** |
| Docker postgres vs 本机安装 | 本机无 psql 客户端；Docker 已在，容器可重建、不污染宿主机。**选 Docker** |
| 迁移脚本真身位置 | Flyway 脚本（`resources/db/migration/`）是真身；`changes/` 三件套留档（规范 §8）。两者同步 |

## Rollback Strategy

- 全量：`git checkout main` 丢弃分支（未合并前零风险）。
- 迁移：Flyway `downgrade`/`rollback.sql` 回退；Postgres 容器 `docker rm -f` 重建。
- 依赖/网络：仅影响 T2 编译，不落库，重试或换镜像源。

## Open Questions

1. **本轮范围**：只做批 A（推荐），还是 A+B 一次推完？
2. **分支名**：`feature/m1-backend-skeleton`（默认，可改）。
3. **表结构字段**：以 `.harness/wiki/data-model.md` 为唯一来源，执行 T3 时读取——若发现 wiki 缺表或缺字段，停下来问，不自行发明。

## Not Doing

- 前端任何改动；旧 FastAPI 代码改动（仅维护不新增）。
- 认证/茶叶/品鉴/文化/AI agent（批 B，后续轮）。
- Caffeine 缓存、Spring Event 异步、RAG 管线、AI 五专家（后续切片）。
- Redis / RocketMQ（PRD 已裁）。
