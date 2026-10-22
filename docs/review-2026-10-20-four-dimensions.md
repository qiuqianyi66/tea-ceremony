---
name: review-four-dimensions-2026-10-20
description: 一盏茶全项目四维评审报告（性能 / 安全性 / 可扩展性 / 可维护性）——静态扫描 + 高危路径逐文件深读 + 部署链路核实，含覆盖边界与「未做」项的诚实声明。
status: active
owner: yanha
last_updated: 2026-10-20
---

# 一盏茶 全项目四维评审报告（2026-10-20）

- 评审人：WorkBuddy（AI）
- 范围：前端 `src/`（164 个 ts/vue，约 2.9 万行）+ 后端 `backend/src/main/java/com/tea/`（169 个 java，约 7 千行）
- 维度：性能 / 安全性 / 可扩展性 / 可维护性
- 方法：静态扫描（硬编码密钥、超大文件、注入模式）+ 逐文件深读高危路径 + 部署链路核实（nginx / docker-compose / SecurityConfig / RateLimitFilter）

## 覆盖边界（诚实声明，避免假阴性）

- 全量深读：AI 链路（AiChatService / BaseExpertAgent / LibrarianAgent / AiCallExecutor / CultureSearchService）、安全配置（SecurityConfig / JwtAuthenticationFilter / AdminTokenFilter / RateLimitFilter）、存储层（storage/*、db.ts、share.ts）、3D 生命周期、nginx 与 compose。
- 抽样/扫描未逐行：garden 业务域、telemetry 全量、tea/taster/brewer/mentor 四个专家的完整实现、全部 47 个 .vue 的模板细节。
- **未做**：运行时性能剖析（profiling）、真实负载测试、渗透测试。所有性能结论为静态推理，量级标注「未测」。

## 优先级行动清单

| # | 级别 | 维度 | 问题 | 位置 |
|---|---|---|---|---|
| 1 | Major | 可维护性 | 视图层零测试，业务闭环核心无回归保护 | `src/views/*`、`src/components/*` |
| 2 | Major | 性能 | 文化检索每次请求重算付费 embedding，无缓存 | `CultureSearchService.java:136` |
| 3 | Major | 安全性 | `/mcp` permitAll 且无限流（当前被 nginx 挡住，潜在风险） | `SecurityConfig.java:64` |
| 4 | Minor | 性能 | RAG 检索与 chat 串行，两跳延迟叠加 | `teaAI.ts:414` |
| 5 | Minor | 可维护性 | AI 降级逻辑三处重复 | `teaAI.ts:37/357/456` |
| 6 | Minor | 性能 | `history.add()` 去重全表 filter，未用已有复合索引 | `history.ts:33` |
| 7 | Minor | 可扩展性 | 新增专家需改约 6 处（散弹式） | `AiChatService.dispatch()` 等 |
| 8 | Minor | 安全性 | 限流为进程内单实例，扩容后配额放大 N 倍 | `RateLimitFilter.java:61` |

---

## 一、性能

### 1.1 [Major] 每次文化检索都重算付费 embedding，无缓存

- 位置：`backend/src/main/java/com/tea/culture/service/CultureSearchService.java:136`
- 证据：`vectorHits(q)` 内 `qv = model.embed(q)`；`search()` 第 101 行无条件调用 `vectorHits(q)`。无任何缓存层。
- 触发路径：`/api/v1/culture/search`、`/api/v1/ai/chat`（前端 `askTeaMaster` 先 `fetchRAGContext`）、Librarian 工具调用、MCP `cultureSearch`。
- 后果：付费 embedding 调用量与检索量 1:1。按记忆记载 `ragHitRate 0.13`，约 87% 的 embedding 计算未产生命中，属纯成本支出。重复查询直接放大成本。
- 修复：加 `query → float[]` 的 LRU 缓存（如 Caffeine，`maximumSize=1000`、`expireAfterWrite=1h`）。可选：对连续未命中的查询做短周期负缓存。

### 1.2 [Minor] RAG 检索与 chat 串行

- 位置：`src/services/teaAI.ts:414`（`await fetchRAGContext(question)`）→ `:449`（chat 请求）
- 后果：总延迟 = RAG 延迟 + LLM 延迟。
- 修复：两者并发（`Promise.all`，RAG 失败仍降级）；或把 RAG 下推后端（后端已有 `CultureSearchService`），省一跳网络。

### 1.3 [Minor] 实验统计 N+1 模式

- 位置：`backend/src/main/java/com/tea/ai/experiment/service/ExperimentService.java:321-324`
- 证据：`for (AbExperiment experiment : experiments) { repository.variantWindowStats(expKey, start, end) }`
- 后果：运行中实验数 N → N 条聚合 SQL。当前实验为个位数，可接受。
- 修复：实验数增长后合并为 `where exp_key in (:keys) group by exp_key, variant`。

### 1.4 [Minor] 兜底服务每次全表载入茶/茶器

- 位置：`backend/src/main/java/com/tea/ai/fallback/LocalFallbackService.java:92,96`
- 证据：`teaRepository.findAll()` + `teaWareRepository.findAll()` 后流式匹配。
- 后果：目录约百行，当前无感；数据增长后每次兜底都全表入 JVM。
- 修复：目录加进程内缓存（变动极少），或改为库内检索。

### 1.5 [Minor] Dexie 全表扫描替代索引查询

- 位置：`src/services/storage/history.ts:33`（去重 filter）、`:69`（pending filter）、`achievement.ts:9`、`collectedWare.ts:8`、`tracking.ts:58`
- 证据：`db.tastings.filter(...)`；schema 已有 `[teaId+date]` 复合索引未用于去重。
- 后果：`history.add()` 去重为 O(n) 全表扫。单用户本地库数百行，当前无感。
- 修复：去重改 `db.tastings.where('[teaId+date]').equals([teaId, day]).first()`。

### 1.6 性能做得好的点

1. `AiCallExecutor`（`backend/.../ai/resilience/AiCallExecutor.java`）：虚拟线程 + `Future.get` 硬超时并 `cancel(true)` + lane 分桶熔断 + 业务错误不计熔断 + 指数退避加抖动 + `@PreDestroy` 关池。
2. 3D 资源释放完整：garden 五个 layer、`tea-field.ts`、`tea-tree.ts`、`TeaBrewSceneInner.vue:310`、`TeaGardenSceneInner.vue:606` 均有 dispose；`useLoop` 动画回调随组件卸载停止。
3. 无定时器泄漏：`BrewView.vue` 三个 `setInterval`、`TeaBreakView.vue`、音频层均有配对 `clearInterval`。
4. 分位计算下推 Postgres：`AiEvalTraceRepository`、`TelemetryEventRepository` 用 `percentile_cont`，不拉全量进 JVM。
5. `ChunkBackfillService.java:66` embedding 分批写入。

---

## 二、安全性

### 2.1 [Major] `/mcp` 端点无认证且未限流（潜在风险，当前不可利用）

- 位置：`backend/src/main/java/com/tea/auth/security/SecurityConfig.java:64`（`.requestMatchers("/mcp", "/mcp/messages").permitAll()`）；`RateLimitFilter.match()` 规则集不含 `/mcp`。
- 工具暴露面：`CultureSearchTool`（`backend/.../ai/mcp/CultureSearchTool.java:27`）经 MCP 暴露，其实现调用 `CultureSearchService.search()` → 触发付费 embedding。
- **自证伪核实（避免误报）**：
  1. `nginx/snippets/app-locations.conf` 无 `/mcp` location，SPA 路由白名单正则也不含 `mcp` → 公网请求落到 `location / { try_files $uri =404; }`，返回 404。
  2. `docker-compose.yml:52` backend 仅绑 `127.0.0.1:18080:8080`，后端不直公网。
  - 结论：**当前不可利用**。降级为潜在风险而非活跃漏洞。
- 潜在后果：一旦将来为放行 MCP 而新增 nginx location，即形成「无认证 + 无频控 → 付费 embedding」的成本放大通道。
- 修复（二选一）：
  - 短期显式化意图：nginx 增加 `location ^~ /mcp { return 404; }`，防止未来误开放。
  - 若要对外开放：在 `RateLimitFilter` 增加 `/mcp` 档位，并要求 JWT 或管理员令牌。

### 2.2 [Minor] dev profile 含旧 JWT 密钥兜底

- 位置：`backend/src/main/resources/application-dev.yml:16`
- 证据：`secret: ${JWT_SECRET:tea-dev-secret-key-please-change-in-production-0123456789}`
- 核实：主配置 `application.yml:66` 为 `${JWT_SECRET:}`（无兜底），`docker-compose.yml:57` 用 `${JWT_SECRET:?}` 强制注入 → 生产安全。风险仅在误激活 dev profile。
- 修复：保持现状；可选在启动时对「dev profile + 非本地环境」打告警。

### 2.3 [Minor] 限流为进程内单实例

- 位置：`backend/src/main/java/com/tea/common/ratelimit/RateLimitFilter.java:61`
- 证据：`ConcurrentHashMap` store；类注释已声明多实例需 Redis（ADR-012 方向）。
- 后果：水平扩容 N 实例后，匿名 AI 额度（3 次/分）实际放大为 3N 次/分。
- 修复：多实例部署前接 Redis 计票。

### 2.4 [Nit] 限流档位只判 Bearer 前缀存在

- 位置：`RateLimitFilter.java:151-154`
- 证据：`header != null && header.startsWith("Bearer ")`，不校验签名与有效期。
- 后果：携带任意 `Bearer x` 即从匿名档（3 次/分）升到登录档（30 次/分）。真实鉴权在 SecurityFilterChain，故非越权；属限流档位可被抬升。
- 修复：可接受；如需收紧，按「JWT 有效」判档。

### 2.5 安全做得好的点

1. `src/services/share.ts`：解码逐字段类型校验 + 版本拒绝 + base64url 字符集校验 + 纯函数无 `eval`，是防御性解码范本。
2. `src/services/http.ts:10`：mock 需 `import.meta.env.DEV && VITE_DEV_MODE === 'true'` 双门槛；`:61` 另有 `token !== 'dev-token'` 守卫，dev-token 不会作为 Authorization 发出。
3. `RateLimitFilter.java:160-167`：`clientIp` 取 XFF **末段**（对齐 nginx `$proxy_add_x_forwarded_for` 的 append 语义），防客户端伪造 XFF 逐请求轮换绕过。
4. 密钥 fail-closed：`JWT_SECRET` / `ADMIN_API_TOKEN` 无公开兜底；`AI_DASHSCOPE_API_KEY` 默认 `disabled`，命中 key 门禁直接 502。
5. 前端零 `v-html` / `innerHTML`；零绝对 URL `fetch`（未直连第三方 AI）；AI 全部走后端代理。
6. 原生 SQL 全参数化 + 显式 cast（`CultureSearchService`、`TelemetryEventRepository`、`AiEvalTraceRepository`）；`AdminTokenFilter` 路径模式与 `SecurityConfig` 逐字一致（PR #123 的修复）。
7. 运维面：nginx 拦截 `.env/.sql/.yml/.bak/.pem` 等探测路径、SPA 未知路由返回真 404、backend 仅绑 loopback、安全头由后端独占避免重复拼接。

---

## 三、可扩展性

### 3.1 [Minor] 新增专家需改约 6 处（散弹式修改）

- 位置：`AiChatService.dispatch()`（5 个顺序 if）、`AiChatService` 字段、`AiChatDeps` record、`AgentOrchestrator.routeToAgent`、`AgentType` 枚举、Spring 装配。
- 后果：新增第 6 个专家要改多个文件；漏改 `dispatch` 会静默回落到透明代理（不报错，难发现）。
- 修复：把「枚举 → 专家」收敛为 `Map<AgentType, ExpertAgent>`（专家 bean 自注册 `supports(type)`），新增专家只加一个类。属可选改进。

### 3.2 [Minor] 魔法阈值散落，部分未外置

- 位置：`VECTOR_MIN_SIM=0.55` / `VECTOR_TOP_N=3`（`CultureSearchService.java:34-36`）、`ANCHOR_LIMIT=20`（`AiChatService.java:52`）。
- 现状：均已常量化且有注释说明依据；限流参数已外置为 `tea.ratelimit.*`。
- 修复：把向量阈值也外置为 `tea.culture.vector.*`，便于线上调参。

### 3.3 [Minor] 旧 FastAPI 双栈并存

- 位置：`backend/app`、`backend/migrations`、`backend/seeds`、`backend/tests`（共 53 个 .py）
- 后果：新人需理解两套领域逻辑；有误改旧栈的风险（规范禁新增，但无机械化门禁）。
- 修复：在 `backend/app/README.md` 置顶「仅维护不新增」；或加 CI 检查旧栈目录无新增文件。

### 3.4 [评估但不建议改] `AiChatService` 职责面较宽

- 位置：`AiChatService.java`（372 行，18 依赖经 `AiChatDeps` record 聚合）
- 现状：`chat()` 串起越权校验→路由→复杂度→锚定→会话→配额→实验→trace→熔断→派发→兜底；私有助手 `dispatch/anchor/resolveSession/persist/fallbackOrThrow/subjectOf` 职责清晰，每个决策都有注释说明理由。
- 双向论证：**现在不拆**。拆成「编排 / 配额实验 / trace」三个类会增加 3 处装配与更多跨类调用，而当前单类内聚且有 27 个测试覆盖，符合项目 YAGNI。反转条件：再叠加多渠道（IM / 语音）或超过约 600 行时再拆。

### 3.5 [评估但不建议改] 巨型 3D / 视图文件

- 位置：`TeaBrewSceneInner.vue`(1322)、`teas.ts`(1296)、`BrewView.vue`(812)、`TeaGardenSceneInner.vue`(785)、`TasteView.vue`(707)
- 双向论证：**不为拆而拆**。3D 场景拆成多组件会引入 props/事件耦合与更多生命周期协调，容易引入新 bug；`teas.ts` 是数据文件而非逻辑。反转条件：单文件超约 1500 行，或多人同时改同一场景冲突频繁时，再按「茶壶 / 水汽 / 光影」拆。

### 3.6 可扩展性做得好的点

1. 分层机械化：ArchUnit `LayerDependencyTest` + CI 门禁；Controller 只做参数与响应。
2. 容错收口：`AiCallExecutor` 让新专家只传 lane，不复制容错代码。
3. 三个数据驱动扩展点：prompt 版本化（`agent_prompts` 表）、A/B 实验（`ExperimentService`，ADR-024）、运行时技能注入（`AgentSkillRouter`，ADR-017）。
4. `AiChatDeps` record 聚合 18 个依赖，消除同类型参数位置错配。
5. 契约用 record/DTO（`CultureSearchResult`、`AiChatRequest`、`TastingCardShareData`），前后端边界稳定。

---

## 四、可维护性

### 4.1 [Major] 视图层零测试，业务闭环核心无回归保护

- 位置：`src/views/*`（`BrewView.vue` 812 行、`TasteView.vue` 707 行、`TeaSynesthesiaView.vue` 431 行等）与 `src/components/*`（47 个，含两个 3D 场景）。
- 证据：25 个前端 spec 全部位于 `services` / `composables` / `data` / `stores`；组件测试仅 1 个（`PwaUpdateToast.spec.ts`）。
- 后果：冲泡状态机（`BrewView.vue` 三个 interval 驱动 heat/rinse/steep）、品鉴提交流程、分享页渲染均无测试。这些正是业务闭环（入席→选茶→备器→煮水→冲泡→品鉴）的核心，重构风险高。
- 修复：优先补 3 个关键流程的组件测试——`BrewView` 计时状态机、`TasteView` 提交与降级、`ShareView` 非法 payload 拒绝。工具链已有 Vitest + jsdom（见 `src/test/setup.ts`）。

### 4.2 [Minor] AI 降级逻辑三处重复

- 位置：`src/services/teaAI.ts` — `callLLM`（:37-42）、`fetchRAGContext`（:357-390）、`askTeaMaster`（:456-478）
- 证据：三处各写一遍「`!res.ok` → 规则降级」。
- 后果：调整降级策略要改多处；新增 AI 端点容易漏写。
- 修复：收敛为 `aiFetch<T>(path, init): Promise<T | null>`（统一超时 + `!res.ok` + 解析 + null 语义），三处改为调用。

### 4.3 [Minor] 非空断言 + 字符串前缀匹配做去重

- 位置：`src/services/storage/history.ts:31-33`
- 证据：`record.date.startsWith(recordDay!)`
- 核实：`split('T')` 必返回非空数组，断言当前安全，但依赖 `date` 为 ISO 格式；换格式即静默失效。
- 修复：`const recordDay = record.date.split('T')[0] ?? record.date`，去掉 `!`。

### 4.4 [Nit] 版本号待构建期注入

- 位置：`src/services/telemetry/config.ts:89`
- 后果：版本号可能与 `package.json` 漂移。
- 修复：Vite `define` 注入 `__APP_VERSION__`。

### 4.5 可维护性做得好的点

1. **零类型逃逸**：全 `src` 无 `any` / `as any` / `@ts-ignore` / `eslint-disable`（在 strict + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` 下）。
2. 注释解释「为什么」而非「是什么」：`AiCallExecutor` 的熔断语义、`RateLimitFilter` 的 XFF 末段取舍、`AiEvalTraceRepository` 为何用原生 SQL、`AiChatDeps` 为何聚合参数。
3. 测试命名说明行为（如 `nullResultTransparentReplyThrowsBadGateway`）。
4. 技术债仅 3 处 TODO/FIXME，且均良性。
5. 治理机制健全：`AGENTS.md` 活文档 + `docs/plans/lessons.md` + 文档分层（ADR-009）+ `scripts/verify-harness.cjs`。

---

## 五、总体判断

- 这个代码库的**安全与类型纪律明显高于平均水平**：fail-closed 密钥策略、参数化 SQL、防御性解码、零类型逃逸、部署面收紧（loopback + nginx 404 + 安全头独占）都做到了位。
- **最需要投入的是前端视图层测试**。服务层有 25 个 spec 保护，而承载业务闭环的视图/组件层几乎裸奔，这是当前最大的回归风险敞口。
- **最直接的收益是 embedding 缓存**。一行配置级的改动可消掉大部分重复付费调用。
- 架构上无明显过度设计；几处「大文件 / 宽职责类」经双向论证后建议维持现状，并在注释中写明拆分触发线，避免后人反复纠结。
