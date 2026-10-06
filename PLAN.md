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

### 批 B — M1.2 认证 + 领域切片

- T6 auth：注册/登录（JWT + BCrypt，Spring Security）**✅ 已完成并提交（feature/m1-auth @ 9583dbf）**
- T7 tea：茶叶 CRUD + 文化 seeds 迁移（`src/data/` → Flyway V2）— 细化方案见下
- T8 record：品鉴记录（client_id 幂等 + 八维评分 × 工艺系数，可解释性）
- T9 docker-compose 编排（backend/frontend/postgres/nginx）+ CI 接线

---

#### T7 tea 领域细化方案（v1，2026-10-06，待确认后执行）

> 依据：request-analysis 范式（F 编号 + Given-When-Then + 影响分析）；现状事实均经只读核实，无编造。

##### 1. 范围与边界

| 方向 | 内容 |
|---|---|
| 做（F7-1/2/3） | 茶叶目录只读接口（列表筛选分页 + 详情）；文化数据 seeds 迁移（Flyway V2，7 表有数据源） |
| 不做 | 茶叶写接口（目录由迁移管理，PRD 无后台管理需求）；文化表 CRUD（属 AI 切片）；**前端改动**（联调切片）；图片入库（库表无 image 列，前端按名称映射资产） |

- F7-1 茶叶目录列表：游客可浏览，按茶类/产地筛选 + 分页
- F7-2 茶叶详情：全字段返回（冲泡参数/风味/故事/汤色）
- F7-3 文化 seeds 迁移：src/data 真实数据 → V2（up/down 成对、往返验证）

##### 2. 现状事实（已核实）

- V1 已建 13 表；`teas` 24 字段（flavor JSONB、soup_color_min/max、dry_tea_color、season/grade/historical_period/water_requirement、region_id/process_id FK）
- 数据源规模：`src/data/teas.ts` **66 茶**（字段齐全）/ `tea-regions.ts` 23 / `teaProcesses.ts` 6 / `teaPoems.ts` 25 / `teaMasters.ts` 21 / `teawares.ts` 6 / `teaEtiquette.ts` 14；**tea_relations 无前端数据文件 → 无种子（不编造）**
- `backend/seeds/`（旧库种子，tea_seed 30 茶 / culture_seed 10 产区 6 茶人）作字段结构对照，**以 src/data 为主数据源**（前端真实展示数据）
- 前端契约：`http.ts` 统一补 `/api`（调 `/teas` → 实际 `/api/teas`，dev 代理到旧后端 8000）；新后端 base 为 `/api/v1`（auth 已按此）→ **路径前缀需拍板（D1）**
- `process` 映射：src/data 为字符串（'炒青'），DB `process_id` FK → 开工核对旧 model 映射规则（不确定先 NULL，D4）
- category 口径：DB 与前端 TeaType 一致用中文（'绿茶'…'青茶'）；`tea-regions.ts` 的 '乌龙茶' 是展示层口径，不冲突

##### 3. 数据层：V2 seeds 迁移

- **脚本生成 SQL**：Python 转换脚本（读 src/data → 生成 `V2__culture_seed.sql` + rollback），脚本入库可复现——禁手写 100+ 条 INSERT（token 成本）
- up：7 表顺序 INSERT（regions → processes → teas → people → poems → teawares → etiquettes，先清空再插保幂等）；`tea_relations` 留空（无源）
- down：按表逆序 DELETE 种子（计数断言清零）
- 验证：09-db-migration 流程——up 计数 = src/data 条数 → down 清零 → re-up 恢复

##### 4. 接口契约（base `/api/v1`）

| 接口 | 行为 | 响应 |
|---|---|---|
| `GET /api/v1/teas?category=&origin=&page=1&size=20` | 筛选 + 分页；size 1-100（默认 20，超限 400 PARAM_INVALID） | `ApiResponse{data:{items: TeaVo[], total}}` |
| `GET /api/v1/teas/{id}` | 详情；不存在 404 NOT_FOUND | `ApiResponse{data: TeaVo}` |

- TeaVo（snake_case，对齐前端 dto）：id/name/category/origin/altitude/best_temp/best_time/infusions/flavor[]/story/description/dry_tea_color/soup_color_min/soup_color_max/season/grade/historical_period/water_requirement/region_id/process_id
- 鉴权：`GET /api/v1/teas/**` permitAll（PRD F2/F3 所有用户）→ SecurityConfig 追加放行
- 错误走既有 GlobalExceptionHandler（400/404 已就位）

##### 5. 验收标准（Given-When-Then）

- **F7-1** Given 库中已灌 seeds，When `GET /api/v1/teas?category=绿茶&page=1&size=20`，Then 200 + 分页结构（items/total），仅含绿茶；列表默认按 id 排序（seeds 顺序即茶类分组）
- **F7-1b** Given size=101，When 同上请求，Then 400 PARAM_INVALID（分页上限）
- **F7-2** Given id 存在，When `GET /api/v1/teas/{id}`，Then 200 + 全字段（含 flavor JSONB/story/汤色）
- **F7-2b** Given id 不存在，When 同上，Then 404 NOT_FOUND 统一格式
- **F7-3** Given V2 未应用，When upgrade，Then 7 表计数 = src/data 条数；When downgrade，Then 清零；When re-upgrade，Then 恢复

##### 5b. 承重墙与合规声明

- **承重墙影响：无**——T7 为只读目录，不触碰幂等键（tasting_records/garden_plants）、评分模型（八维×系数）、前端 AI 降级链（teaAI.ts）；SecurityConfig 仅追加 GET teas 放行（auth 逻辑不变）
- 分页/错误码/索引命名符合编码规范（page/size ≤100、统一 ApiResponse、V1 已建 ix_teas_category 等）
- T7.3 交付项含**同步 `.harness/wiki/api-contract.md`**（新增 /api/v1/teas 契约）

##### 6. 测试计划

- 单测：TeaServiceTest（筛选/分页边界/详情/404）、TeaControllerTest（@WebMvcTest：参数校验/响应结构）
- 集成：TeaIntegrationTest（Testcontainers + V1+V2：列表/筛选/详情/404）
- 迁移：V2 往返实测（上表 F7-3）

##### 7. 任务拆分（每片 ≤4h）

| 片 | 内容 | 前置 |
|---|---|---|
| T7.1 | seeds 转换脚本 + V2 up/down + 往返验证 | 确认 D1-D4 |
| T7.2 | Tea entity + Repository + TeaService | T7.1 |
| T7.3 | TeaController + TeaVo + Security 放行 | T7.2 |
| T7.4 | 单测 + 集成测试 | T7.3 |
| T7.5 | expert-reviewer 评审 + changes 三件套 + 提交 | T7.4 |

##### 8. 决策点（需确认）

| # | 决策 | 推荐 | 备选 |
|---|---|---|---|
| D1 | 接口前缀 | **`/api/v1/teas`**（与 auth 一致；前端联调切片改路径） | `/api/teas` 兼容旧前端（前缀不一致，留债） |
| D2 | seeds 范围 | **7 表有源全迁** + relations 留空 | 仅迁 teas（文化表后续切片再迁，重复往返） |
| D3 | 列表分页 | **规范分页**（size≤100，默认 20） | 数组全量（兼容旧前端，66 条规模小但留债） |
| D4 | process 映射 | 核对旧 model；**不确定先 NULL** | 按 category 关联 tea_processes（可能错配） |

##### 9. Token 优化（用户要求，落地方式）

- 实施按需渐进加载：T7.1 前读 `09-db-migration/SKILL.md`；T7.2 前读 `coding-skill` + `.harness/wiki/api-contract.md`；T7.5 前读 `expert-reviewer/SKILL.md`——禁全量读技能/规则
- 数据转换一律脚本生成 SQL，禁手写长 INSERT
- 本方案即权威来源（F 编号已定），实施不再重复需求解析
- 承接关系：本方案 + PLAN 批 A/B + PRD v2 §5/§7/§8 为 T7 全部需求依据

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
