---
name: backend-migration-status
description: 后端重写迁移盘点（2026-10-22 首版）——旧 FastAPI 23 个端点逐一对照 Spring Boot 新栈：10 已迁 / 13 未迁（含处置建议）/ 新栈独有 19 个。回答「还剩哪些端点没迁」这一信息盲区；随迁移进度更新。
last_updated: 2026-10-22
status: active
owner: yanha
---

# 后端重写迁移盘点（FastAPI → Spring Boot）

> 口径：AGENTS.md §7「重写**中**，旧 FastAPI 仅维护不新增」。本文是端点级进度清单，补此前的信息盲区。
> 方法（2026-10-22 实测）：两端各自 grep 路由装饰器——旧栈 `backend/app/routers/*.py` 的 `@router.*` + `backend/main.py:119-124` 的 prefix；新栈 `backend/src/main/java/com/tea/**/*Controller.java` 的 `@*Mapping`。**不转抄任何文档结论**。
> 维护规则：迁移一个端点 → 更新下表对应行；端点废弃 → 移入「已退役」并注明日期。本文件数字人工维护，无脚本门禁。

## 0. 一分钟结论

1. 旧栈 **23 个端点全部有结局**：10 个已迁（§1）+ 13 个已退役（2026-10-22 D9 执行，§2/§3）。
2. **D9 已执行（2026-10-22，用户拍板「全部退役」）**：删 6 个文件（routers/teawares、routers/culture、schemas/culture、schemas/ware、services/culture_service、tests/test_culture）+ main.py/schemas 聚合/ai.py（recommend/note）/test_ai/test_middleware/test_errors/wiki 契约/e2e mock/audit-wiki-drift 映射同步；py_compile + 五门禁全绿，CI pytest 待跑。
3. 旧栈现存 9 个端点（auth 2 / teas 2 / records 4 / ai chat 1）**全部已有新栈对应**——端点维度「重写完成」判据①已满足。
4. 剩余判据：②删 `backend/app` 整段 + CI 旧门禁；④Flyway 成为唯一 schema 来源（Alembic 退役）。
5. 新栈独有端点 19 个（garden / ai sessions / metrics / experiments / telemetry / admin backfill）——这些是新功能，不是迁移欠账。

## 1. 已迁对照（10/23）

> 2026-10-22 注：下表右列的旧端点半数已随 D9 退役删除（teawares/culture/ai-recommend/note）；
> 迁移映射作为历史记录保留——**能力沿革看此表，代码存亡看 §2/§3**。

| 旧端点（FastAPI，`/api/*`） | 新端点（Spring Boot，`/api/v1/*`） | 证据（新栈） |
|---|---|---|
| POST /api/auth/register | POST /api/v1/auth/register | `AuthController.java:26` |
| POST /api/auth/login | POST /api/v1/auth/login | `AuthController.java:31` |
| GET /api/teas/ | GET /api/v1/teas | `TeaController.java:25` |
| GET /api/teas/{tea_id} | GET /api/v1/teas/{id} | `TeaController.java:34` |
| POST /api/records | POST /api/v1/records | `TastingRecordController.java:33` |
| GET /api/records | GET /api/v1/records | `TastingRecordController.java:39` |
| GET /api/records/{record_id} | GET /api/v1/records/{id} | `TastingRecordController.java:46` |
| DELETE /api/records/{record_id} | DELETE /api/v1/records/{id} | `TastingRecordController.java:52` |
| GET /api/culture/search | GET /api/v1/culture/search | `CultureSearchController.java:23` |
| POST /api/ai/chat | POST /api/v1/ai/chat | `AiChatController.java:27` |

## 2. 未迁清单 → **已全部退役（2026-10-22 D9 执行）**

> 原 13 个未迁端点按 D9 决策表全部退役，旧代码已删。本节为退役记录；决策理由与执行清单见 §3。

### 2.1 茶器目录（1）— 已退役

| 旧端点 | 旧栈用途 | 前端消费方 | 结局 |
|---|---|---|---|
| GET /api/teawares/ | 茶器列表 | **无**——前端用本地静态数据 `src/data/teawares.ts` | **已删**（router + schema + service 引用清理） |

### 2.2 茶文化只读域（10）— 已退役

| 旧端点 | 前端消费方 | 结局 |
|---|---|---|
| GET /api/culture/regions、/regions/{region_id} | 无 | **已删** |
| GET /api/culture/people、/people/{person_id} | 无 | **已删** |
| GET /api/culture/poems、/poems/{poem_id} | 无 | **已删** |
| GET /api/culture/processes、/processes/{process_id} | 无 | **已删** |
| GET /api/culture/teas/{tea_id}/detail | 无 | **已删** |
| GET /api/culture/graph/{tea_id} | 无 | **已删** |

退役依据（2026-10-22 拍板时实测）：①`CultureSearchController.java:14` 注释明示「文化域其余端点留后续 culture 切片」；②文化数据两条腿走路——8 表 ILIKE + `culture_chunks` 向量检索（`CultureSearchService.java:26-30`），RAG 不依赖这些详情端点；③全库 grep 前端/e2e/脚本对这 10 个路径零真实调用（e2e 仅 mock 拦截，已改指新栈）。

### 2.3 AI 旧端点（2）— 已退役

| 旧端点 | 旧栈用途 | 新栈对应能力 | 结局 |
|---|---|---|---|
| POST /api/ai/recommend | 按时间/天气/心情荐茶（80 字） | 五专家 advisor（荐茶师）经 `/api/v1/ai/chat` | **已删** |
| POST /api/ai/note | 按品鉴数据生成茶记（60 字） | 无直接对应（taster 偏评茶非茶记） | **已删** |

## 3. D9 决策与执行记录（2026-10-22）

**决策**（用户拍板）：13 个未迁端点**全部退役**——0 前端消费方（能力已不在产品里）；YAGNI，为假想中的文化浏览页补迁等于把旧栈设计带进新栈；真要做时按新栈规范重做，代价低于维护移植代码。

**执行清单**（当日完成）：

| # | 动作 | 产物 |
|---|---|---|
| ① | 删 6 文件 | `backend/app/routers/{teawares,culture}.py`、`backend/app/schemas/{culture,ware}.py`、`backend/app/services/culture_service.py`、`backend/tests/test_culture.py` |
| ② | ai.py 删 recommend/note 路由与请求模型（保留 chat） | `backend/app/routers/ai.py` |
| ③ | main.py 移除两个 include 与 import | `backend/main.py` |
| ④ | schemas 聚合去掉 culture/ware 导出 | `backend/app/schemas/__init__.py` |
| ⑤ | 测试同步 | `test_ai.py`（删 2 测试、502 测试改 chat）、`test_middleware.py`（限流共享 key 测试改 chat）、`test_errors.py`（404 用例改 `/api/teas/999999`） |
| ⑥ | wiki 契约同步 | `.harness/wiki/api-contract.md`（删 14 行端点登记，文化/AI 段改退役说明；登记数 52→38） |
| ⑦ | 消费方同步 | `e2e/aiask.spec.ts`（mock 改 `/api/v1/culture/*`）、`scripts/audit-wiki-drift.cjs`（PY_PREFIX 移除两域） |

**验证**：`py_compile` 全过；`verify-harness` / `audit-redlines` / `audit-wiki-drift`（38/38）/ `audit-context-budget` / `verify-nginx-routes` 五门禁全绿；旧栈 pytest 需 `backend/.venv`（本机不存在），由 CI `backend-test` job 兜底。

**反转条件**（与决策表一致）：产品要文化浏览页/动态茶器/茶记生成 → 按新栈规范立项重做，不从旧代码迁移。

## 4. 新栈独有端点（19 个，非迁移欠账）

| 域 | 端点 | 说明 |
|---|---|---|
| garden | POST/GET /api/v1/garden-plants；GET /api/v1/garden-energy；POST /api/v1/garden-energy/collect | S1 茶园能量账本（ADR-015），新功能 |
| ai sessions | POST/GET /api/v1/ai/sessions；GET /{id}/messages；DELETE /{id} | 会话记忆锚定（F-6/F-9/F-10） |
| ai metrics | GET /api/v1/ai/metrics/golden；GET /api/v1/ai/metrics/quality | 三大黄金指标 + 质量层（ADR-026） |
| admin experiments | GET /api/v1/admin/experiments；GET/{key}；POST/{key}/start；POST/{key}/stop | A/B 实验管理（ADR-024），X-Admin-Token 保护 |
| admin culture | POST /api/v1/admin/culture/chunks/backfill | embedding 回填（付费，令牌 + 限流） |
| telemetry | POST /api/v1/telemetry/batch；GET /api/v1/telemetry/slo；GET /fingerprints；PATCH /fingerprints/{id}/review | 匿名遥测（ADR-022） |

## 5. 迁移残留（收尾前要清）

1. ~~**`scripts/verify-garden-sync-e2e.cjs:31` 仍打 `/api/auth/register`**（旧栈路径，无 `/v1`）~~ → **已修（2026-10-22）**：改 `/api/v1/auth/register` + `ApiResponse` 解包；PG 连接串改走 `TEA_PG` 环境变量（口令不入库）；queryPg 的 python 路径可用 `TEA_PY` 覆盖（旧 `backend/.venv` 已不存在）。
2. **CI 双跑**：pytest（旧）+ Maven（新）并存；`backend-lint` 的 ruff/bandit 与 `dependency-audit` 的 pip-audit 均只覆盖旧栈（pip-audit 为有据放行，见 `docs/security-harness-engineering-spec.md` §5-G4）。
3. **迁移双轨**：新表走 Flyway（`db/migration`），旧栈仍 Alembic（`backend/migrations/`）——AGENTS.md §8 过渡期口径。
4. **`backend/app` 未删**：`backend/main.py` + `app/{models,routers,schemas,services}` + `tests/` + Alembic 配置俱全，旧栈可独立运行。

## 6. 「后端重写完成」判据（可执行定义）

满足全部四条，才可在 AGENTS.md §7 把「重写中」改为「已完成」：

1. ~~§2 的 13 个未迁端点全部有明确结局~~ → **✅ 已满足（2026-10-22 D9：全部退役，旧代码已删）**。
2. `backend/app`、`backend/main.py`、`backend/migrations/`、`backend/tests/`（pytest）整段删除；CI 移除 pytest/ruff/bandit/pip-audit 旧栈 job；Alembic 配置与依赖清理。⬜ **剩余主项**。
3. ~~前端/e2e/脚本对 `/api/*`（无 v1）零引用~~ → **✅ 已满足（2026-10-22：garden-sync 脚本与 aiask e2e 均已改新栈路径）**。
4. Flyway 迁移成为唯一 schema 来源，且 upgrade/downgrade 往返测试在 CI 绿。⬜ 剩余（依赖判据②的 Alembic 退役）。

## 7. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-22 | 首版：23 个旧端点逐一实测对照（10 迁 / 13 未迁）；新栈独有 19 个；残留 4 项；完成判据 4 条 |
| 2026-10-22（晚） | 新增 §3 D9 决策表（13 个未迁端点建议全部退役 + 退役执行清单，待拍板）；§5 残留第 1 项（garden-sync 脚本旧路径）已修；后续章节顺延 |
| 2026-10-22（深夜） | **D9 执行完毕**：13 端点全部退役（删 6 文件 + 7 处同步），wiki 登记 52→38，五门禁全绿；判据①③ 满足，剩②④（删 backend/app 整段 + Alembic 退役） |
