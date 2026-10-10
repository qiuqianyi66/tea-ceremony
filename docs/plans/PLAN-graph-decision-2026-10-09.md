---
name: plan-graph-decision
description: Graph 决策落地方案（2026-10-09）——依据 REQ-graph-introduce 的 D-1~D-6 拍板：Graph 编排暂缓，先修评测判分真实性 P0 缺陷，再做三个不依赖 Graph 的低成本件。任务到代码行，含 pre-mortem 与回滚。
status: draft
owner: yanha
date: 2026-10-09
last_updated: 2026-10-09
---

# PLAN：Graph 决策落地（2026-10-09）

## Goal

1. **保住已有成果**：修复评测判分虚高（P0-A），让简历数字可追溯、可解释。
2. **拿真实数字**：Judge 全量实跑 + 校准，产出 v3 真实四维分。
3. **补齐一个真实缺口**：AI 成本闸门（F-6）。
4. **记录 Graph 暂缓决策**（ADR-018），避免后续会话重复论证。

> **拍板后修订（2026-10-09）**：
> - **T09 结构化输出已砍**——Q1 确认 tea 无「文本解析 LLM 输出」代码，不写不存在问题的代码。
> - **T10 工具缓存已砍**——Q3 实证缓存命中率 0-1%（见 REQ §7.1），不利。不引入 Caffeine 依赖。
> - 实际任务：**T01-T08 + T04**（成本闸门为唯一保留的低成本件）。

## Context

- 依据：`docs/prd/REQ-graph-introduce-2026-10-09.md`（D-1~D-6 待拍板，本 PLAN 按「我的建议」全量铺开）。
- 依据：`docs/research-spring-ai-alibaba-graph-2026-10.md`（§10 实测反驳 / §11 规范代码提炼）。
- 现状基线：AI 五专家 + RAG + 记忆 + Trace + 计量（无消费端）；评测 50 条 / 98 考点（**77 个 judge**）；后端 33 个测试文件，全 mock 风格（K14 已成立）。
- **P0 缺陷**：v2 的 0.96 是在 `judge off` + HEAD 版「中性计 1」下产出；工作区改语义后 dry-run = **0.19**。
- 环境：Docker 引擎未运行（阻塞 live 评测）。

## Pre-Mortem（假设本方案已失败，反推最可能原因）

| # | 失败场景 | 根因推演 | 本方案的对冲措施 |
|---|---|---|---|
| PM-1 | F-4 Judge 跑完分数仍很低（如 0.4），简历数字反而变差，用户觉得白做 | 真实分本来就低，之前 0.96 是幻觉 | **F-2 先做**：报告区分 program-only 与含 judge 口径，ITERATIONS 标注水分。让「低分」成为**已知事实**而非突发打击 |
| PM-2 | F-1 改判分语义后，历史 v1/v2 数字被误读为「回退」 | 口径变了但没标注 | **D-2 红线**：不改历史数字本身，只加口径标注。禁止「为了好看」回退语义 |
| PM-3 | F-6 成本闸门误伤正常用户（长会话被截断） | 阈值拍太小 / 计数维度错（按 userId 而非 sessionId） | 计数**按 sessionId**（会话内），默认阈值 10，配置化；超限走既有降级语义不 500 |
| PM-4 | ~~F-8 缓存导致检索陈旧~~ | ~~TTL 太长 / 无失效入口~~ | **已砍**：实证命中率 0-1%，无收益（REQ §7.1）。本风险随 F-8 消失 |
| PM-5 | ~~F-7 结构化输出改动面扩散~~ | ~~直接改评分主链路~~ | **已砍**：Q1 确认 tea 无落点。本风险随 F-7 消失 |
| PM-5b（新增） | 砍掉 F-7/F-8 后，「低成本件」只剩一项，显得产出单薄 | 把「做的数量」当成果 | **正确性优先于数量**。AGENTS.md §0.2：不同意就说；§5 最小实现：不解决不存在的问题。宁可交付 3 件真的，不要 5 件假的 |
| PM-6 | Docker 起不来，F-3~F-5 全部卡死 | 用户环境限制 | F-1/F-2/F-9 不依赖 Docker，可先交付；F-3 标为用户操作依赖 |
| PM-7 | 改着改着又去实现 Graph | 方案边界不清 | 本 PLAN 明确 **Not Doing** 含 Graph 实现；F-9 产出「暂缓 + 触发条件」 |

## Risk Assessment

```
Risk = Impact + Scope + Uncertainty + Irreversibility
总体: LOW-MEDIUM（4-5）
- F-1/F-2/F-9：纯脚本+文档，可 revert，LOW
- F-3：环境操作，可重来，LOW
- F-4/F-5：AI key 费用（100 次调用），但手动跑可中断，MEDIUM
- F-6/F-7/F-8：动后端代码，每文件独立 commit，MEDIUM
```

## Approach

```
Phase A 保真（P0，无 Docker 依赖）
  T01 判分语义锁死（F-1） ──┐
  T02 报告口径标注（F-2） ──┼──→ T04 ADR-018（F-9）
                            │
Phase B 解锁（依赖 Docker）  │
  T03 环境启动（F-3） ───────┘
                            │
Phase C 拿真数（依赖 T03）   │
  T05 Judge 全量（F-4） ─────┼──→ T07 迭代记录 v3
  T06 Judge 校准（F-5） ─────┘
                            │
Phase D 低成本件（独立）     │
  T08 成本闸门（F-6） ───────┼──→ 各自独立 commit
  T09 结构化输出（F-7） ─────┤
  T10 工具缓存（F-8） ───────┘
```

## Tasks（到代码行）

### Phase A 保真（P0，先做，不依赖 Docker）

**T01 判分语义锁死（F-1）**

- 读现状：`scripts/eval-core.cjs:53-73`（工作区版已改为「judge 未回填 → 0」）。
- Action：在 `scripts/tests/eval-core.node-test.cjs` 新增 2 个单测，锁死语义：

```js
// 新增用例 1：judge 考点未回填 → 该考点 0 分（防静默满分回归）
test('judge 未回填计 0', () => {
  const c = { id: 'X', points: [{ name: 'p1', weight: 1, veto: false, check: 'judge' }] }
  assert.equal(scoreCase(c, { content: 'ok' }), 0)   // 无 judgeScores
})

// 新增用例 2：program 考点不受 judge 语义影响
test('program 考点独立判分', () => {
  const c = { id: 'Y', points: [{ name: '茶类归属正确', weight: 1, veto: false, check: 'program' }] }
  assert.equal(scoreCase(c, { content: '这是乌龙茶', expectedCategory: ['乌龙茶'] }), 1)
})
```

- Validation：`node --test scripts/tests/eval-core.node-test.cjs` → pass ≥19（现 17/17），fail 0。
- Commit：`test(eval): lock judge-unfilled-scores-zero semantics`

**T02 报告口径标注（F-2）**

- Action 1：`scripts/eval-core.cjs` 的 `aggregate()` 增加两个字段（第 102-112 行 `return` 块内）：

```js
// programOnly：只算 program 考点的分（judge off 时的真实可比口径）
// judgeCoverage：已回填 judge 考点 / 全部 judge 考点
```

  实现方式：在 `scoreCase` 之外加 `scoreCaseProgramOnly(caseDef, result)`（跳过 `check === 'judge'` 的考点）；`aggregate` 里 `runs` 需携带该值——故 `eval-tea-ai.cjs:69` 构造 `run` 时补 `programOnlyScore` 字段。

- Action 2：`docs/ai-eval/ITERATIONS.md` 表格上方加注：

```markdown
> ⚠️ **口径说明（2026-10-09 修订）**：v1/v2 的 overall 为 **judge off 下的 program-only 口径**
> （98 个考点中 77 个为 judge 考点，未参与判分）。含 judge 的全量分见 v3（T05 后补充）。
> 简历引用前须确认口径。
```

- Action 3：v1/v2 行末补 `(program-only)` 标记。
- Validation：`node scripts/eval-tea-ai.cjs --dry-run` → 报告含 `programOnlyScore` 与 `judgeCoverage: 0`；`verify-harness` ERRORS: []。
- Commit：`fix(eval): report program-only score + judge coverage, annotate ITERATIONS`

**T03（占位）ADR-018（F-9）**

- 见 Phase B 末尾 T04。

### Phase B 解锁 + 决策记录

**T03 评测环境启动（F-3）**

- Action：启动 `D:\docker\Docker Desktop.exe`（引擎 29.8.2）→ `docker compose up -d backend` → 若 8080 占用沿用 `18080:8080`。
- Validation：`curl http://localhost:18080/actuator/health` UP；`POST /api/v1/ai/chat` 返回非 502。
- **依赖用户操作**（Docker 需桌面会话）。若不解锁，T05/T06 阻塞，Phase A/D 照常交付。
- Commit：无（环境操作）。

**执行结果（2026-10-09 实查）**：

| 项 | 结果 |
|---|---|
| Docker 引擎 | ✅ 已运行（3 容器 healthy：tea-backend-1 / tea-db-1 / tea-frontend-1） |
| `/actuator/health` | ✅ `{"status":"UP"}` |
| `POST /api/v1/ai/chat` | ❌ **超时**——容器到 DashScope **TLS 握手被中途掐断**（`SSLHandshakeException: Remote host terminated the handshake`） |

**根因链（已实测定位，非推测）**：

```
Docker daemon.json 注入宿主代理 host.docker.internal:9674
  → 9674 无监听（代理进程未运行）
  → 容器出网被拒
```
但**清空代理后仍失败**，进一步实测：
- 宿主机到 DashScope：完整 TLS 握手 ✅ 成功（Tls13，`New-Object SslStream` 实测）
- 容器内 TCP 443：✅ connected（`nc -zv` 实测）
- 容器内 DNS：✅ 正常解析
- **容器内 TLS 握手：❌ `unexpected eof while reading`**（openssl 实测，对多个 IP 均如此）

**结论**：容器出网 TLS 被环境级中间设备拦截（非配置问题，非代码问题）。
清空代理的尝试已**完整回滚**（`git diff docker-compose.yml` 为空），容器恢复原始配置。

**影响**：T05（Judge 全量）/ T06（Judge 校准）**阻塞**，需换网络环境或在宿主直接跑评测器（改 `--base-url` 指向宿主启动的后端）。
**未做任何冒充完成的事**——T05/T06 状态为「阻塞」，非「完成」。

**T04 ADR-018：Graph 引入暂缓（F-9）**

- Action：新建 `docs/ADR/ADR-018.md`，格式对齐 ADR-017（Status/Date/Context/Decision/Consequences/Rejected）。

```markdown
# ADR-018：Spring AI Alibaba Graph 引入暂缓

- **Status**: Accepted
- **Date**: 2026-10-09

## Context
语雀《HR 招聘全流程 workflow-agent 实战》+ gitee hr-recruitment-agent 精读后，
需判断是否引入 Graph 编排。实测发现教材三条说法与真实行为不符（见 research 文档 §10）。
tea 现状：五专家单请求单专家路由 + RAG + 记忆 + Trace；评测 v2 已达标。

## Decision
**暂缓引入 Graph 编排**（StateGraph/子图/HITL/Checkpoint）。理由：
1. 四维甄别 0/4：无内生需求、无用户要求、无竞品压力、团队自用不成立。
2. 业务闭环无「多步有状态 AI 编排」环节；冲泡流程是前端状态机，且 HITL 与
   「零点击闭环」硬冲突（AGENTS.md §13 禁止加手动确认按钮）。
3. 引入 = 第二套状态模型（OverAllState vs AiChatVo），增加认知负担。

**但采纳三个不依赖 Graph 的低成本件**：成本闸门、结构化输出、工具缓存（T08-T10）。

## Consequences
- 无 Graph 代码落地；ai 域不加 graph 包。
- 三个低成本件独立 commit，可单独回滚。
- 触发重评条件（满足任一重新评估）：
  1. 出现真实的多步有状态 AI 流程需求；
  2. 前端明确要求断点续传/人工审批（当前禁止）；
  3. 时间旅行作为产品功能而非调试用途。

## Rejected
- 全量引入 Graph（四维未过）。
- LlmRoutingAgent 替换 AgentOrchestrator（架构级替换，现状无痛点）。
- 多 agent 接力流水线（H9 已判砍，延续）。
```

- Validation：`node scripts/verify-harness.cjs` ERRORS: []（ADR 编号连续性 + AGENTS §12 声明需同步改 `ADR-001~018`）。
- **注意**：`verify-harness.cjs` 校验 AGENTS.md 的 ADR 声明（当前 `ADR-001~017`）与实际目录。新建 ADR-018 后**必须同步改 AGENTS.md §12**，否则体检报漂移。
- Commit：`docs(adr): ADR-018 graph introduction deferred + AGENTS sync`

### Phase C 拿真数（依赖 T03）

**T05 Judge 全量实跑（F-4）**

- Action：
```bash
node scripts/eval-tea-ai.cjs --judge --delay 13000
```
  （50 条 × 2 次调用 = 100 次；限流 10/min；约 20 分钟）
- Validation：报告 `judgeCoverage > 0.9`；四维分（resultQuality/processQuality/safetyStability/efficiency）与 pass^3 全量产出。
- Commit：`docs(eval): v3 judge full run report`

**T06 Judge 校准（F-5）**

- Action：`node scripts/calibrate-judge.cjs --judge` → 输出人工标注 vs 机评一致率。
- Validation：一致率 ≥85% → Judge 可用，写入 ITERATIONS.md；<85% → 调 `docs/ai-eval/judge-prompts/result-quality.md` 后重跑（**不降阈值迁就**）。
- Commit：`docs(eval): judge calibration result`

**T07 迭代记录 v3**

- Action：`docs/ai-eval/ITERATIONS.md` 增 v3 行（含 judge 口径四维分 + pass^3 + 归因），更新 STAR 模板数字。
- **红线**：数字取自报告，不编。若 v3 低于 v2，如实记录并归因（这是**评测体系第一次真正生效**的证据，反而是加分项）。
- Commit：`docs(eval): v3 iteration record`

### Phase D 低成本件（独立，可穿插）

**T08 AI 成本闸门（F-6）**

- 文件：`backend/src/main/java/com/tea/ai/service/AiChatService.java`（第 79 行 `chat()` 方法入口）。
- Action：
  1. `application.yml` 增 `tea.ai.max-calls-per-session: 10`。
  2. `AiChatService` 构造器注入 `@Value("${tea.ai.max-calls-per-session:10}") int maxCalls`。
  3. 新组件 `AiCallQuota`（`com/tea/ai/service/`）：`ConcurrentHashMap<Integer, AtomicInteger>` 按 **sessionId** 计数（`userId == null` 游客会话不计数，维持现状游客可用性）。
  4. `chat()` 内：`resolveSession` 之后、`dispatch` 之前判断；超限 → 抛 `BadGatewayException("本轮对话已达上限")`（**复用既有降级语义**，前端 teaAI.ts 已有 502 降级分支，不动前端）。
- Validation：新增 `AiCallQuotaTest`（边界：第 N 次通过 / 第 N+1 次抛 / 游客不计数）；`mvn -o test` 全绿。
- Commit：`feat(ai): per-session call quota (tea.ai.max-calls-per-session)`
- **注意**：不动 `teaAI.ts` 降级承重墙（AGENTS.md §3）。

**T09（已砍）结构化输出（F-7）**

- **砍因**：Q1 拍板——tea **无「文本解析 LLM 输出」的代码**。
  `ScoreAggregatorNode` 式正则是**课程项目的问题**，不是 tea 的。
- 依据：AGENTS.md §5 最小实现 —— 只解决被要求的问题，不写不存在问题的代码。
- 若将来 tea 出现「LLM 自由文本 → 结构化字段」的解析点，届时单独立项。

**T10（已砍）工具缓存（F-8）**

- **砍因**：Q3 实证不利。用户条件「有利就可以」→ 实测命中率：

```
原始 query 层：50 次调用 / 去重 50 → 命中率约 0.0%
关键词层    ：102 次调用 / 去重 101 → 命中率约 1.0%
"铁观音怎么泡？" → ["铁观音怎么泡"]     ← 整句做 key
"铁观音产地在哪" → ["铁观音产地在哪"]   ← 同实体不同 key
```

- 根因：`splitKeywords` 对无连接词短句不切分，同实体不同问法产生不同 key → key 高度离散。
  要提升命中率须改切分逻辑 = 动刚修好的 RAG 承重墙（LIB-002/003 长句召回），**风险 > 收益**。
- 结论：**不引入 Caffeine / Spring Cache 依赖**。

## Trade-offs

| 取舍 | 选择 | 理由 |
|---|---|---|
| 判分语义 | judge 未跑计 0（失败响亮） | 「静默满分」比「显得低分」危险得多 |
| v1/v2 历史数字 | 不改，只加口径标注 | 真实数字是红线；掩盖水分 = 编造 |
| 成本闸门计数维度 | 按 sessionId（非 userId） | 用户换话题开新会话应重置；按 userId 会误伤 |
| 结构化输出 | **砍**（Q1 无落点） | 不为不存在的问题写代码 |
| 工具缓存 | **砍**（Q3 命中率 0-1%） | 用户条件「有利就可以」→ 实证不利则不引入依赖 |
| Graph | 暂缓 + ADR 记录 | 四维 0/4；留触发条件防重复论证 |

## Rollback Strategy

- 每个 T 独立 commit，`git revert <commit>` 单点回滚。
- T01/T02 只动脚本 + 文档，删除即回滚。
- T08/T10 动后端代码，独立 commit；配置默认值保守（闸门默认 10 次、缓存 TTL 5min），出问题改配置即可，不必回滚代码。
- T04 ADR-018 是纯文档；回滚时须同步回退 AGENTS.md §12 的 ADR 声明（否则 verify-harness 报漂移）。
- 无数据库迁移，无 Flyway 改动。

## Open Questions（已全部拍板，2026-10-09）

| # | 问题 | 用户拍板 | 落地 |
|---|---|---|---|
| Q1 | T09 结构化输出：tea 是否真有「文本解析 LLM 输出」代码？ | **没有** → **砍 F-7** | T09 标已砍 |
| Q2 | T08 成本闸门默认 10 次/会话？ | **可以** | T08 按 10 实现，配置化 |
| Q3 | 引入 Caffeine 依赖？ | **有利就可以** → 实证命中率 0-1% → **不利，砍 F-8** | T10 标已砍，不引入依赖 |
| Q4 | Docker 由谁启动？ | **可以**（用户操作） | T03 执行 |

## 实际任务清单（拍板后）

| 任务 | 对应 F | 依赖 | 状态 |
|---|---|---|---|
| T01 判分语义锁死 | F-1 | 无 | ✅ 完成（单测 23/23 绿） |
| T02 报告口径标注 | F-2 | 无 | ✅ 完成（`programOnly` / `judgeCoverage` 落地） |
| T03 环境启动 | F-3 | 用户操作 Docker | ⚠️ 部分完成（容器 UP，但容器出网 TLS 被拦） |
| T04 ADR-018 + AGENTS 同步 | F-9 | 无 | ✅ 完成 |
| T05 Judge 全量实跑 | F-4 | T03 可用网络 | ❌ **阻塞**（容器 TLS 被拦） |
| T06 Judge 校准 | F-5 | T05 | ❌ **阻塞**（同上） |
| T07 迭代记录 v3 | F-4/F-5 | T05/T06 | ❌ 阻塞 |
| T08 AI 成本闸门 | F-6 | 无 | ✅ 完成（26/26 绿，后端全量 209/209 绿） |
| ~~T09 结构化输出~~ | ~~F-7~~ | — | **已砍（Q1）** |
| ~~T10 工具缓存~~ | ~~F-8~~ | — | **已砍（Q3）** |

### 下一步（阻塞项解锁方案）

T05/T06 需要能直连 DashScope 的网络。两个可选路径：

1. **修容器出网**（推荐先试）：启动宿主代理客户端使 9674 恢复监听，或临时移除 daemon.json 的 `proxies` 段后重启 Docker 引擎。
2. **宿主直跑**：从宿主启动后端（`cd backend && mvn spring-boot:run`），评测器默认 `--base-url http://localhost:18080` 需改为宿主端口（如 `--base-url http://localhost:8080`），绕开容器网络。

判定：路径 2 风险更低（不动全局 daemon.json，不依赖代理进程）。

## Not Doing

- **Graph 编排实现**（StateGraph / 子图 / HITL / Checkpoint / 时间旅行）——ADR-018 暂缓。
- `LlmRoutingAgent` 替换 `AgentOrchestrator`。
- 多 agent 接力流水线（H9 延续）。
- 改 v1/v2 历史评测数字本身（只加口径标注）。
- 新增付费 AI API。
- 前端主流程改动 / `teaAI.ts` 降级逻辑改动。
- 数据库表结构改动 / Flyway 迁移。
