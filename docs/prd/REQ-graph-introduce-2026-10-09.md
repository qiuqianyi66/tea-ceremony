---
name: req-graph-introduce
description: Spring AI Alibaba Graph 引入需求分析（2026-10-09）——基于语雀文档 + gitee 仓库精读与实测，判断 tea 引入 Graph 的必要性、范围边界、F 编号验收与阻塞项。含多角色质询与实证发现的 P0 缺陷。需求确认后进方案设计。
status: draft
owner: yanha
date: 2026-10-09
last_updated: 2026-10-09
---

# REQ：Spring AI Alibaba Graph 引入需求分析（2026-10-09）

## 0. 结论先行

1. **Graph 编排本身：暂缓，不引入。** tea 现状（五专家单请求单专家路由 + 评测已达标 v2 0.96）**没有必须由 Graph 解决的需求**。引入属「为技术而技术」，过不了四维甄别的「自由维」与「伪需求」门槛。
2. **但实测发现两个 P0 缺陷，与 Graph 无关，必须立刻修**：
   - **P0-A 评测分数虚高**：v2 的 0.96 是在 `judge off` 下跑出的，98 个考点中 **77 个是 judge 考点（占 78.6%）**。工作区 `eval-core.cjs` 已改为「未跑 judge 计 0」，重跑 dry-run → **0.19**。v2 的 0.96 是 HEAD 版「中性计 1」的产物，**不能写进简历**。
   - **P0-B 环境阻塞**：Docker 引擎未运行，评测无法 live 跑。
3. **课程里真正值得搬的是 3 个低成本高收益件**（`ModelCallLimiterHook` 成本闸门 / `outputType` 结构化输出 / `ToolCacheInterceptor` 缓存），**可独立于 Graph 先行**。

> 顺序建议：**先修 P0-A/P0-B（保住已有成果）→ 再做 1 个低成本件（成本闸门）→ Graph 编排暂缓**。

> **拍板后修订（2026-10-09）**：Q1 确认 tea 无文本解析 LLM 输出代码 → **F-7 砍**；
> Q3 经实证缓存命中率 0-1% → **F-8 砍**（证据见 §7 D-3）。低成本件只剩 **F-6 成本闸门** 一项。

## 1. 目标与范围

### 1.1 目标

- 判断 Spring AI Alibaba Graph 引入 tea 的必要性，给出做/砍/降级结论与依据。
- 顺带固化精读过程中实测发现的缺陷，纳入需求。
- 产出可执行的 F 编号任务 + Given-When-Then 验收，供后续方案设计。

### 1.2 做（范围边界内）

| 簇 | 内容 |
|---|---|
| C1 缺陷修复（P0） | 评测判分真实性修复、Judge 校准实跑、评测环境解锁 |
| C2 低成本迁移件 | 成本闸门 Hook、结构化输出、工具缓存 |
| C3 Graph 决策 | 产出「暂缓」结论 + 触发重评的条件（不实现） |

### 1.3 不做（明确排除）

- **Graph 编排实现**（StateGraph/子图/HITL/Checkpoint 落地）——本次结论为暂缓。
- **`LlmRoutingAgent` 替换 `AgentOrchestrator`**——语义上是「选一个执行」，但属架构级替换，且现状无痛点。
- **多 agent 接力流水线**——H9 已判砍，延续不做。
- 新增依赖（Graph 零新增依赖，但也不引入）。
- 前端主流程改动。

## 2. 现状基线（2026-10-09 实查，非推测）

### 2.1 AI 能力现状

| 能力 | 状态 |
|---|---|
| 五专家 | LIBRARIAN/ADVISOR/TASTER/BREWER/MENTOR + 透明代理回落 |
| 路由 | `AgentOrchestrator`：显式 agent 枚举 / 文化关键词粗分 / null 回落 |
| RAG | `CultureSearchService`，pgvector + ILIKE 混合检索 |
| 记忆 | `ChatMemoryService` 会话记忆，历史锚定 ≤20 条（COMPLEX 收紧至 5） |
| 复杂度路由 | T09 已落地，三档配置化 `tea.ai.complexity.*` |
| Prompt 版本化 | `PromptService` + `agent_prompts` 表 |
| 运行时技能 | ADR-017 `AgentSkillRouter`，4 领域文本子指令注入 |
| Trace | ADR-016 `ai_eval_traces` 四层 JSONB |
| 计量 | `ai_usage_logs` 表（**无消费端**，`AiUsageLogger` 只写不读） |
| 降级 | 502 → 前端规则引擎（承重墙，不可动） |
| 限流 | `RateLimitFilter`，AI 面 10/min |

### 2.2 评测体系现状

| 项 | 状态 |
|---|---|
| 评测集 | 50 条 / 6 文件 / typical 30、edge 12、adversarial 8 |
| 考点总数 | **98 个**，其中 **judge 77 个（78.6%）** / program 21 个（21.4%） |
| 评测器 | `eval-tea-ai.cjs` + `eval-core.cjs`（纯函数，单测 17/17 绿） |
| Judge | 骨架完成（`judge-prompts/result-quality.md` + `calibrate-judge.cjs`），**校准未实跑** |
| 报告 | ITERATIONS.md 记 v1 0.82 → v2 0.96 |

### 2.3 环境

- **Docker 引擎未运行**（`docker ps` → npipe 连接失败），后端容器起不来，评测无法 live。
- 工作区有 9 个未提交改动（`AiChatService`/`TraceRecorder`/`eval-core.cjs` 等）。

## 3. 实测发现的缺陷（本轮核心产出）

### 3.1 P0-A：评测分数虚高（最严重）

**证据链**：

1. `docs/ai-eval/reports/run-v2c.log`：`judge off`，整体 0.96，pass^3 48/50。
2. 98 个考点中 77 个 `check: judge`（`grep` 统计）。
3. **HEAD 版** `eval-core.cjs` 的 judge 分支：
   ```js
   // judge 考点在评测器中走 LLM 评委（--judge）；此处保持中性 1（由外部回填）
   if (!result.judgeScores || result.judgeScores[p.name] === undefined) { ... }
   if (wsum === 0) return 1 // 无已判考点 → 中性
   ```
   → **未跑 judge 时，77 个 judge 考点被计为「中性」，不拉低分**。
4. 工作区（未提交）版已改为「未回填/UNKNOWN/判 0 一律计 0」。
5. **实测验证**：`node scripts/eval-tea-ai.cjs --dry-run` → **整体 0.19，pass^1 0/50**。

**结论**：v2 的 0.96 意味着「program 考点（21 个）几乎全对」，**不代表 78.6% 的 judge 考点达标**。
ITERATIONS.md 的简历 STAR「任务完成率 82%→96%」**当前不可信**，须在 `--judge` 实跑后重算。

**影响**：这是简历素材的数字来源。数字不真实 = 违反 REQ-ai-project §5「真实数字才写，跑不出来不编」。

### 3.2 P0-B：评测环境阻塞

Docker 引擎未运行 → 后端容器起不来 → `eval-tea-ai.cjs` 无法 live 跑（baseUrl `localhost:18080`）。
`--judge` 全量约 20 分钟 + 每条 2 次调用，限流 10/min 下需 `--delay 13000`。

### 3.3 P1：计量表无消费端

`AiUsageLogger.save()` 只写 `ai_usage_logs`，全项目**无读取方**。
REQ §2.2 缺口 G-7 仍成立。评测的「效率成本」维度（`aggregate` 里 `efficiency` 字段）依赖 `tokensIn/tokensOut/latencyMs` 回填，但无消费端则无法做成本报表。

## 4. 必要性判断：Graph 引入（多角色质询）

按 AGENTS.md §2「关键决策先用多角色质询」。五角色各提一个反对意见：

| 角色 | 反对意见 | 是否成立 |
|---|---|---|
| **PM** | tea 的业务闭环（入席→选茶→备器→煮水→冲泡→品鉴→成长）里，**没有一个环节是「多步有状态 AI 编排」**。冲泡流程是前端状态机 + 参数计算，不是 LLM 编排。 | ✅ **成立**。无需求牵引 |
| **架构师** | 引入 Graph = 引入第二套状态模型（OverAllState vs 现有 AiChatVo/DTO）。现状已稳定且有 ArchUnit 分层门禁，双模型增加认知负担。 | ✅ **成立** |
| **UX** | 用户感知不到 Graph。HITL「等用户确认水已沸」前端已有零点击闭环（AGENTS.md §13 明令禁止加手动确认按钮），Graph 的 HITL 反而是**回退**。 | ✅ **成立，且是硬冲突** |
| **开发者** | 课程项目零测试、含真 bug（`experience_scorer` 无入边永不执行 / `PASS_THRESHOLD=0`）。照抄会把缺陷带进来；自研则需重写配套的「节点可达性」测试体系。 | ✅ **成立** |
| **分析师** | 评测 v2 已 0.96（虽含水分），简历故事已成立。Graph 引入**不产生新的可评测指标**，投入产出比低。 | ✅ **成立** |

### 4.1 四维甄别

| 维度 | 判定 | 说明 |
|---|---|---|
| 自由维（自己想做？） | ❌ | 是外部课程输入，非 tea 内生需求 |
| 用户维（用户要吗？） | ❌ | 无用户反馈要求多步 AI 编排 |
| 竞品维（竞品有吗？） | ⚠️ 弱 | 同类茶道 App 无此需求 |
| 伪需求（团队自己会用吗？） | ❌ | tea 单用户自托管，无团队使用压力 |

**四维 0/4 → 砍**（REQ-quality-backlog §1.3：新功能立项四维甄别未过不扩功能面）。

### 4.2 降级方案：只取低成本件

Graph **整体砍**，但课程里的独立件**不依赖 Graph 运行时**，本可单独迁移。逐项实证筛选：

| 件 | 是否依赖 Graph | 实证结论 | 判定 |
|---|---|---|---|
| `ModelCallLimiterHook` 思路（成本闸门） | ❌ 不依赖，用 `@Value` + 计数即可 | tea 计量表**无消费端、无调用上限**（`AiUsageLogger` 只写不读）→ 真实缺口 | **做（F-6）** |
| `outputType` 结构化输出 | ❌ 不依赖 | **tea 无「文本解析 LLM 输出」代码**，无对应落点 | **砍（Q1）** |
| `ToolCacheInterceptor` 思路（工具缓存） | ❌ 不依赖 | **实证命中率 0-1%**（§7 D-3），无收益 | **砍（Q3）** |
| StateGraph / 子图 / HITL / Checkpoint | ✅ 依赖 | 四维 0/4 | **砍** |
| `LlmRoutingAgent` | ✅ 依赖 | 架构级替换，现状无痛点 | **砍** |

## 5. 需求清单（F 编号 + Given-When-Then）

### C1 缺陷修复（P0，先做）

| # | 任务 | Given-When-Then 验收 |
|---|---|---|
| **F-1** | **评测判分真实性修复**：确认 `eval-core.cjs` 工作区版「judge 未跑计 0」语义，补单测锁死该行为 | Given 工作区版已改语义；When 补单测「judge 未回填 → 该考点 0 分」且「program 考点不受影响」；Then `node --test scripts/tests/eval-core.node-test.cjs` 全绿（现 17/17，新增后 ≥19） |
| **F-2** | **评测报告与 ITERATIONS 标注水分**：区分「program-only 分」与「含 judge 分」 | Given 当前报告只有单一 overall；When 报告新增 `programOnlyScore` 字段（只算 program 考点）+ `judgeCoverage`（已判 judge 考点占比）；Then dry-run 报告显示 programOnly 分与 judgeCoverage=0，ITERATIONS.md 顶部加注「v1/v2 数字为 judge off 下的 program-only 口径，含 judge 全量分待 F-4」 |
| **F-3** | **评测环境解锁**：Docker 引擎启动 + 后端容器 healthy | Given Docker Desktop 已安装（`D:\docker\Docker Desktop.exe`，引擎 29.8.2）；When 启动引擎并 `docker compose up -d backend`；Then `curl localhost:18080/actuator/health` UP，`POST /api/v1/ai/chat` 非 502 |
| **F-4** | **Judge 全量实跑**：`--judge` 跑通 50 条，产出真实四维分 | Given 容器 healthy + F-1/F-2 已合；When `node scripts/eval-tea-ai.cjs --judge --delay 13000`；Then 报告含 `judgeCoverage > 0.9`，四维分与 pass^3 全量产出，写入 ITERATIONS.md v3 |
| **F-5** | **Judge 校准实跑**：一致率 ≥85% | Given F-4 完成；When `node scripts/calibrate-judge.cjs --judge`；Then 输出一致率，≥85% 则 Judge 可用，<85% 调 prompt 重跑 |

### C2 低成本迁移件（P1，F-1~F-5 之后）

| # | 任务 | Given-When-Then 验收 |
|---|---|---|
| **F-6** | **AI 成本闸门**：单会话 LLM 调用次数上限，超限返回友好提示而非无限调用 | Given `application.yml` 新增 `tea.ai.max-calls-per-session`（默认 10）；When 同一 sessionId 内第 11 次调用；Then 返回既有降级语义（不 500），`ai_usage_logs` 记录，单测覆盖边界 |
| **F-7** | ~~结构化输出替代正则~~ → **已砍（Q1 拍板）** | ~~Given 现有正则解析；When 改 BeanOutputConverter；Then 单测断言~~ → **tea 无「文本解析 LLM 输出」代码（实证：tea 侧无 ScoreAggregatorNode 式正则，那是课程项目的问题）。不写不存在问题的代码** |
| **F-8** | ~~工具结果缓存~~ → **已砍（Q3 实证不利）** | ~~Given ADR-012 Caffeine；When 同参二次检索；Then 缓存命中~~ → **实证命中率 0-1%，无收益反增依赖与失效风险，见 §7 D-3** |

### C3 Graph 决策（P2，只出结论）

| # | 任务 | Given-When-Then 验收 |
|---|---|---|
| **F-9** | **Graph 暂缓决策记录**：写入 ADR-018 或本 REQ 结论节，附触发重评条件 | Given 本 REQ 四维甄别 0/4；When 记录「暂缓」结论 + 触发条件；Then 文档可查，后续会话不重复论证 |

**Graph 触发重评条件**（满足任一则重新评估）：
1. 出现**真实的多步有状态 AI 流程**需求（如「一次请求内 AI 自主完成选茶→算参→评分→给建议」）。
2. 需要**断点续传/人工审批**且前端明确要求（当前前端禁止加手动确认按钮，故不成立）。
3. 需要**时间旅行回放**作为产品功能（非仅调试用）。

## 6. 影响分析

| 项 | 影响面 | 风险与缓解 |
|---|---|---|
| F-1/F-2 判分语义改动 | 评测器 + 报告 + ITERATIONS | 改动在工作区未提交，需先确认语义再提交；改后 v1/v2 历史数字须重新标注口径，**不顺手改历史数字本身** |
| F-3 Docker 启动 | 本地环境 | 需用户启动 `D:\docker\Docker Desktop.exe`；端口 8080 占用 → 沿用 `18080:8080` 映射 |
| F-4 Judge 全量 | AI key 费用 | 50 条 × 2 次调用 = 100 次；用 qwen-turbo；限流 10/min 下约 20 分钟；**手动跑不挂 CI** |
| F-6 成本闸门 | `AiChatService` | 只加计数与阈值判断，**不动降级承重墙**（502 → 前端规则回复逻辑不变） |
| F-8 缓存 | `CultureSearchTool` + Caffeine | 引入 Caffeine 依赖需走 `pom.xml`；缓存 key 必须含完整参数，防串味 |
| Graph 暂缓 | 无代码 | 零风险 |

## 7. 优先级与决策

建议顺序：**F-1 → F-2 → F-3 → F-4 → F-5 → F-6/F-7/F-8 → F-9**。

| # | 决策 | 我的建议 | 用户拍板（2026-10-09） |
|---|---|---|---|
| **D-1** | `eval-core.cjs` 工作区改动（judge 未跑计 0）是否保留？ | **保留**。这是正确性修复——「失败响亮」优于「静默满分」。但须同步修 ITERATIONS 口径标注（F-2），否则历史数字误导 | ✅ 采纳建议（保留） |
| **D-2** | v1/v2 历史数字如何处理？ | **不删不改**，加口径标注（F-2）。真实数字是红线，掩盖水分等于编造 | ✅ 采纳建议（只标注） |
| **D-3** | Graph 是否引入？ | **暂缓**（四维 0/4）。只取不依赖 Graph 的低成本件 | ✅ 暂缓 |
| **D-4** | F-6/F-7/F-8 本轮做吗？ | **做**，但排在 F-1~F-5 之后。它们是真实缺口（G-7 计量无消费端 / 解析脆弱 / 省 token） | ⚠️ **部分修正**：F-7 砍（Q1 无落点）；**F-8 砍（实证命中率 0-1%，不利）**；仅 F-6 做 |
| **D-5** | 是否立 ADR-018 记录 Graph 暂缓？ | **建议立**。避免后续会话重复论证（AGENTS.md §5：架构级决策须 ADR） | ✅ 立 |
| **D-6** | Judge 全量跑不跑？（约 20 分钟 + 100 次调用） | **跑**。不跑则 78.6% 考点从未被验证，评测体系不成立 | ✅ 跑（Q4 Docker 已获授权） |
| **D-7**（新增） | Q3：引入 Caffeine 依赖？ | 用户答「有利就可以」→ **实证后判定：不利，砍**（见下） | ❌ 砍 |

### 7.1 D-7 判定依据：缓存实证（2026-10-09）

用户条件「有利就可以」→ 需先证明是否有利。写探针复刻 `CultureSearchService.splitKeywords`，
用评测集 50 条 input 统计两个落点的命中率：

```
=== 缓存落点实证（评测集 50 条） ===
原始 query 层：50 次调用 / 去重 50 → 命中率约 0.0%
关键词层    ：102 次调用 / 去重 101 → 命中率约 1.0%

被 ≥2 条 input 共用的关键词 1 个：  10 × 2

=== 真实场景：同一实体的不同问法（关键词层是否命中） ===
  "铁观音怎么泡？"     → ["铁观音怎么泡"]
  "铁观音产地在哪"     → ["铁观音产地在哪"]
  "铁观音和绿茶的区别" → ["铁观音","绿茶的区别"]
  "介绍一下铁观音"     → ["介绍一下铁观音"]
```

**结论**：两个落点命中率均 ≈0-1%。

根因：`splitKeywords` 对**无连接词的短句不切分**（`"铁观音怎么泡？"` 整体作为一个 token），
同一实体的不同问法产生**不同 key**，导致缓存 key 高度离散。
要让缓存生效就得改切分逻辑——那是动 RAG 承重墙（刚修好的 LIB-002/003 长句召回），**风险远大于收益**。

**判定：不利 → 砍 F-8。** 不引入 Caffeine 依赖。
（若将来真有重复查询场景，正确做法是缓存**实体级结果**而非 query 级，届时再议。）

## 8. 需求确认

- [x] D-1~D-6 拍板（2026-10-09）
- [x] **Q1 拍板：tea 无「文本解析 LLM 输出」代码 → F-7 砍**（用户确认"没有"）
- [x] **Q2 拍板：成本闸门默认 10 次/会话 → 通过**（用户"可以"）
- [x] **Q3 拍板：Caffeine 引入条件"有利就可以" → 实证命中率 0-1%，不利 → F-8 砍**
- [x] **Q4 拍板：Docker 由用户启动 → 通过**（用户"可以"）
- [x] F-1~F-9 范围确认（F-7/F-8 已砍，实际 F-1~F-6 + F-9）
- [x] 确认后：出方案设计（`docs/plans/PLAN-graph-decision-2026-10-09.md`）

## 9. 不做什么（Not Doing）

- Graph 编排实现（StateGraph / 子图 / HITL / Checkpoint / 时间旅行）。
- `LlmRoutingAgent` 替换 `AgentOrchestrator`。
- 多 agent 接力流水线（H9 延续）。
- **不引入 Caffeine / Spring Cache 依赖**（F-8 已砍，实证不利）。
- **F-7 结构化输出**（Q1 确认无落点，已砍）。
- 前端主流程改动。
- 修改 v1/v2 历史评测数字本身（只加口径标注）。

## 10. 附：实证依据索引

| 结论 | 依据 |
|---|---|
| Graph 教材可信度低 / 三条实测推翻 | `docs/research-spring-ai-alibaba-graph-2026-10.md` §10 |
| 课程规范代码提炼 | 同上 §11 |
| 考点 77/98 为 judge | `grep -c 'check: judge' docs/ai-eval/cases/*.yaml` |
| v2 报告 judge off | `docs/ai-eval/reports/run-v2c.log` |
| HEAD 版中性计 1 | `git show HEAD:scripts/eval-core.cjs` |
| 改后 dry-run 0.19 | `node scripts/eval-tea-ai.cjs --dry-run` 实测 |
| 单测 17/17 | `node --test scripts/tests/eval-core.node-test.cjs` |
| Docker 未运行 | `docker ps` → npipe 连接失败 |
| 限流 10/min | `RateLimitFilter.java:41` `@Value("${tea.ratelimit.ai-max:10}")` |
| 计量无消费端 | `AiUsageLogger` 全项目仅 `save()`，无读取方 |
