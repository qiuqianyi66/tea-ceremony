---
title: code-standards-checklist-2026-10-12
last_updated: 2026-10-12
---

# 主要代码规范清单 + 代码符合性抽查报告（2026-10-12）

> 范围：main = `fdba8db`，worktree `code-standards`（分支 `feature/code-standards-report`）。
> 性质：**只报告不修复**。违规只列位置 + 严重度 + 建议，并行 agent 按各自范围处理。
> 方法：所有「已符合 / 违规」结论附实测证据（命令输出或 文件:行号）；无法实测的标「未复核断言」。

## 结论速览

| 域 | 抽查结论 |
|---|---|
| 后端红线 | 实测 14 条 🔴（文件头自称 15 条，差 1 条，见 F1）；**符合 11 条、违规 1 条、偏差 1 条、未复核 2 条** |
| 前端硬规范 | 禁 any / 禁 Options API / 禁 @ts-ignore / 禁 Google Fonts / emoji / AI 直连 → **全部符合**；**组件 ≤200 行违规 19 个文件；触控 ≥44px 违规 14 处** |
| 架构红线 | AI 请求走后端代理 `/v1/ai/chat` → **符合**；降级链 teaAI.ts → **符合** |
| 数据规范 | Flyway V1–V7 + `ddl-auto: validate` → **符合** |
| TOP 3 违规 | ① 组件超 200 行（19 个，最重 TeaBrewSceneInner.vue 1322 行）② 触控目标 40px（SelectView mood-btn/type-btn）③ 旁路埋点 catch 吞异常（TraceRecorder.java:74，已知静默丢数） |

---

# 第一部分：主要代码规范清单（要点 + 出处）

## 1. 后端红线（`.harness/rules/编码规范.md`，逐行实测）

> 文件头描述自称「红线 15 条零容忍」；实测 🔴 标记在后端域为 **14 条**（含数据库域 3 条另列）。差异见 F1。

| # | 要点（一句话） | 出处（编码规范.md:行号） |
|---|---|---|
| R1 | 单向依赖 Controller → Service → Repository，禁反向 / 跨层（Controller 直查 Repository 即违规） | `:29` |
| R2 | Controller 只做路径 + 鉴权 + 调 Service + 响应模型；禁写业务逻辑 / DB 查询 / 异常处理 | `:30` |
| R3 | 异常统一继承 BusinessException（BadRequest/Unauthorized/NotFound/Conflict） | `:36` |
| R4 | 禁裸抛 `RuntimeException`/`Exception`；`catch(Exception)` 后必须处理或记录并重抛业务异常 | `:37` |
| R5 | 四层对象分离：Request DTO / Entity / VO / 内部 Model，职责不混用 | `:43` |
| R6 | Entity 禁止直接出参 / 入参（防字段泄露、防层间耦合） | `:44` |
| R7 | 禁事务内做远程调用 / 发消息 / 异步任务（用 `afterCommit` 回调） | `:51` |
| R8 | 禁 N+1：fetch join / @EntityGraph / 批量查询；大列表必分页，禁全表查询 | `:58` |
| R9 | 迁移只走 Flyway；禁生产 `ddl-auto: update` | `:61` |
| R10 | 禁 `Executors.newFixedThreadPool/newCachedThreadPool`；统一有界 `ThreadPoolTaskExecutor` | `:71` |
| R11 | SQL 参数化禁拼接；XSS 输出转义；Token/密码/密钥禁入日志 | `:77` |
| R12 | `.env*` / `*.pem` / secrets 禁入库；依赖安全审计 | `:78` |
| R13 | AI 请求必须走后端代理 `/api/ai/*`，禁前端直连第三方 AI | `:82` |
| R14 | AI 降级链不可删（前端 teaAI.ts 承重墙 + 后端 fallback） | `:83` |
| DB1 | Schema 变更只走 Flyway，`changes/{feat}/` 三件套与分支同名 | `:188` |
| DB2 | 每个迁移必须可回滚，upgrade/downgrade 往返测试通过才提交 | `:189` |
| DB3 | 禁生产 `ddl-auto: update/create`；禁手改已应用迁移 | `:190` |

强规范（🟢，非红线，本报告抽查见第二部分）：写方法 `@Transactional(rollbackFor = Exception.class)`（`:50`）；构造器注入 `final` + `@RequiredArgsConstructor`（`:34`）；禁 BeanUtils 反射拷贝（`:46`）。

## 2. 前端规范（AGENTS.md §6 + 编码规范 §17–26）

- 必用 Composition API + `<script setup lang="ts">`；禁 Options API；组件 ≤ 200 行，超了拆（编码规范 `:134`）。
- TS strict；禁 `any`、禁 `@ts-ignore`（特例审批）（编码规范 `:139`）。
- 单向数据流 views → stores → services；业务状态走 Pinia；局部用 ref/reactive（编码规范 `:143`）。
- IndexedDB 统一 `src/services/storage/`；API 统一 `src/services/api/`（AGENTS §6）。
- 触控目标 ≥ 44px；状态五态齐全；正文对比度 ≥ 4.5:1（编码规范 `:176`）。
- 字体自托管 `@font-face`，生产禁 Google Fonts link；全屏用 `min-h-[100dvh]` 禁 `h-screen`（AGENTS §6）。
- 图标一个家族（lucide），禁手绘 SVG 路径；Tailwind 4 工具类，禁自定义 CSS 文件（组件内 scoped 除外）（编码规范 `:162`）。
- 设计门禁 6 步（含 ⓪ 轨道判定）；禁令速查：AI 紫渐变 / 暖米白+陶土 / 纯黑灰 / Inter 与衬线默认 / Hero+三卡片 / emoji 当图标 / 玻璃拟态 / 渐变文字 / bounce·elastic 动效（AGENTS §6）。
- `src/components/three/` 只做视觉层不改状态机；禁直接创建 renderer（统一 TresJS）（编码规范 `:168-169`）。

## 3. 数据规范（AGENTS §8）

改模型必生成迁移；迁移脚本成对（`db-migrations.sql` + `rollback.sql`）；升级 / 降级往返验证；茶叶按六大茶类常识，不编造茶名 / 茶器 / 历史人物。

## 4. 测试规范（AGENTS §9）

TDD 优先；行为测试只走公共接口；不 mock 内部协作者（只 mock 跨进程边界：网络 / 时钟 / DB 驱动）；垂直切片（一个测试 → 最小实现 → 下一个）。

## 5. Commit 规范（AGENTS §10）

英文 conventional commits `type(scope): desc`（feat/fix/refactor/perf/test/docs/chore/style）；subject ≤ 72 字符；缺陷修复与功能 / 测试分开提交；`main` 只走 PR。

---

# 第二部分：符合性抽查（实测证据）

## A. 后端（`backend/src/main/java`，101 个 .java 文件）

| 规范项 | 结果 | 证据位置 | 说明 |
|---|---|---|---|
| R1 分层单向依赖 | ✅ 已符合 | `mvn -q test -Dtest=LayerDependencyTest` → surefire：Tests run: 1, Failures: 0, Errors: 0（3.8s） | ArchUnit 机械化验证，CI 门禁 job |
| R2 Controller 只做参数响应 | ✅ 已符合 | `TastingRecordController.java:31-62` 全文仅委托 service + `ApiResponse.success(...)`；Grep `Repository` 在 8 个 controller 文件 0 命中 | 抽查 1/8（记录域承重墙），其余由 ArchUnit 兜底 |
| R3 异常体系统一 | ✅ 已符合 | `backend/.../common/exception/`：BusinessException + BadRequest/Unauthorized/NotFound/Conflict/BadGateway/QuotaExceeded + GlobalExceptionHandler | 类齐全 |
| R4 禁裸抛 RuntimeException | ✅ 已符合 | Grep `throw new (RuntimeException\|Exception)` → 0 命中 | — |
| R4 catch(Exception) 处理方式 | 🔴 **违规 1 处** | `ai/service/TraceRecorder.java:74-76`：`catch (Exception e) { log.warn(...) }` 后吞掉，无重抛无计数 | 旁路埋点静默丢数；AGENTS §13 已记录 librarian eval trace 0 行。建议：加落库失败计数指标，或失败升级 error |
| R4 catch(Exception) 其余 16 处 | ✅ 已符合（抽查） | `ai/agent/BaseExpertAgent.java:71-74`：log.warn + 重抛 `BadGatewayException`；`:86-88` usageLogger 旁路 warn-only（同属已知旁路模式） | 抽查 2/17 处，模式一致 |
| R5/R6 DTO/VO 分离、Entity 不出参 | ✅ 已符合 | Controller 签名 `ApiResponse<RecordVo>` / `PageResult<RecordVo>`；入参 `RecordCreateRequest` | 未发现 Controller 直接返回 Entity |
| R7 事务内远程调用 | ⚪ 未复核断言 | — | AI 调用在 `ChatMemoryService` 写事务边界内的分布未逐方法实测 |
| R8 N+1 / 全表查询 | ⚪ 未复核断言 | — | 未开 SQL 日志实测；`TeaService.java:50` 已用 `PageRequest` 分页（合规迹象） |
| R9/DB1-3 Flyway + ddl-auto | ✅ 已符合 | `application.yml:35 ddl-auto: validate`；`resources/db/migration/` V1–V7 共 7 个迁移文件 | 无 `ddl-auto: update` |
| R10 无界线程池 | ✅ 已符合 | Grep `newFixedThreadPool\|newCachedThreadPool` → 0 命中 | — |
| R11 密钥入日志 | ⚪ 未复核断言 | — | 日志打印敏感字段未逐条审；JPA 命名参数用法符合（`AuthService.java:35` `findByUsername`） |
| R12 secrets 禁入库 | ✅ 已符合 | `git ls-files` 匹配 `.env*`/`.pem`/`secrets/`/`credentials.json` → 仅 `.env.example` | — |
| R13 AI 走后端代理 | ✅ 已符合 | 见 C 节 | — |
| R14 降级链保留 | ✅ 已符合 | `src/services/teaAI.ts` 存在；`__tests__/teaAI.spec.ts` 含降级 / v1 / 配额 / 专家 / 提示安全 5 组 describe | 承重墙有测试锁 |
| 强规范：写方法 @Transactional(rollbackFor) | 🟡 **偏差 3 处** | `garden/service/GardenPlantService.java:23`、`GardenEnergyService.java:38`、`:74`：裸 `@Transactional` 未带 `rollbackFor = Exception.class` | 其余写方法（TastingRecordService:38/102、AuthService:32、ChatMemoryService:33/45/96）均带全。建议：补 `rollbackFor = Exception.class` |
| 强规范：构造器注入 | ✅ 已符合 | Grep `@Autowired` → 0 命中 | — |

## B. 前端（`src/`）

| 规范项 | 结果 | 证据位置 | 说明 |
|---|---|---|---|
| 禁 `any` | ✅ 已符合 | Grep `:\s*any\b\|as\s+any\b` → 0 命中 | — |
| 禁 Options API | ✅ 已符合 | Grep `export default {` → 仅 `src/plugins/icons.ts:392`（vue 插件 install 对象，非组件 Options API）；Grep `data() {` → 0 | — |
| 禁 @ts-ignore | ✅ 已符合 | Grep `@ts-ignore\|@ts-nocheck` → 0 命中 | — |
| 组件 ≤ 200 行 | 🔴 **违规 19 个文件** | 行数实测（Get-Content 计数）：TeaBrewSceneInner.vue **1322**、TeaGardenSceneInner.vue 785、BrewView.vue 812、TasteView.vue 707、TeaDragDrop.vue 455、TeaSynesthesiaView.vue 431、SelectView.vue 362、MapView.vue 360、HomeView.vue 365、TeaBreakView.vue 340、TastingCard.vue 280、AIAsk.vue 283、TeaKnowledgeCard.vue 304、TeaRoom.vue 253、GardenView.vue 244、HomeHero.vue 235、TeaDetailView.vue 237、CollectionView.vue 231、TasteRadarChart.vue 230 | 严重度按行数递减；3D 两场景属视觉层（`3D_SPEC.md`），拆分需谨慎。建议：优先拆 BrewView/TasteView/SelectView |
| 触控 ≥ 44px | 🔴 **违规 14 处** | `node scripts/audit-touch.cjs`（390×844 移动视口）：共 14 处。`SelectView.vue:232/251` `min-height: 2.5rem`（=40px）→ mood-btn 92×40（4 处）、type-btn 64×40（7 处）；首页 `p.tea-name` 282×26（3 处，文字节点） | 运行目标为 localhost:5173（他处 dev server），但违规样式已静态锚定本 worktree 源码 |
| 五态 / 对比度 | ⚪ 未复核断言 | — | axe 可及性门禁在 CI（job 列表见 ci.yml），本会话未重跑 |
| 字体自托管 | ✅ 已符合 | Grep `fonts.googleapis\|fonts.gstatic` 在源码 0 命中（仅 docs 历史文档提及） | — |
| 禁 h-screen | ✅ 已符合 | Grep `h-screen` → 仅 `TeaSynesthesiaView.vue:270/304` 的 CSS 类名 `.synth-screen`，非 Tailwind 工具类 | 误报排除 |
| emoji 当图标 | ✅ 已符合 | `node scripts/scan-emoji.cjs` → `NO EMOJI FOUND`（exit 0） | — |
| Tailwind / 自定义 CSS | 🟡 观察 | `SelectView.vue:225-254` 组件内 scoped CSS（规范允许），但含硬编码 `rgba(201,169,110,...)` 色值 | 建议：迁入 DESIGN_SPEC 令牌 |

## C. 架构红线：AI 请求链路

| 检查 | 结果 | 证据 |
|---|---|---|
| 前端直连第三方 AI | ✅ 无 | Grep `dashscope\|openai\|aliyuncs.com\|deepseek\|moonshot\|/v1/chat/completions` 在 `src/` → 0 命中 |
| AI 请求走后端代理 | ✅ 是 | `src/services/teaAI.ts:24` 与 `:441`：`fetch(`${API_BASE}/v1/ai/chat`)` |

## D. 文档漂移（治理发现）

- **F1**：编码规范.md 文件头自称「红线 15 条零容忍」，后端域实测 🔴 为 14 条。建议：统一计数口径（或把 §4 部署红线 `:219` 计入）。

---

## 复现命令

```powershell
# 后端分层测试
cd backend; mvn -q test -Dtest=LayerDependencyTest; Get-Content target/surefire-reports/com.tea.architecture.LayerDependencyTest.txt
# 前端静态抽查
npm ci; node scripts/audit-touch.cjs; node scripts/scan-emoji.cjs
# 行数统计
Get-ChildItem -Recurse src -Filter *.vue | ? { (Get-Content $_.FullName).Count -gt 200 }
```

> 未实测项（R7 事务内远程调用、R8 N+1、五态/对比度）不在本报告结论内，标记「未复核断言」，由后续专项覆盖。
