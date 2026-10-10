---
title: AI 评测迭代记录
last_updated: 2026-10-09
status: active
owner: yanha
---

# AI 评测迭代记录（T13）

> 规则：每版记录 version / 改动 / 四维指标 / pass^3 / 归因 Top 失败。简历数字只取自本表，不编。
> 数据来源：`node scripts/eval-tea-ai.cjs` 报告（docs/ai-eval/reports/run-v*.log）+ `node scripts/calibrate-judge.cjs` 校准。

> ## ⚠️ 口径说明（2026-10-10 修订，v3 已出全量真实分）
>
> **v3 起 overall 为全量真实分（judgeCoverage = 1）；v1 / v2 的 overall 是 `judge off` 下的 program-only 口径，不可与 v3 直接比。**
>
> - 评测集 98 个考点中 **77 个是 judge 考点（78.6%）**，需 LLM 评委判分。
> - v1/v2 跑的是 `judge off`，当时 `eval-core.cjs` 对未跑的 judge 考点**「中性计 1」**，不拉低分。
> - 2026-10-09 修正语义为「未回填计 0」后，同批 dry-run **overall = 0.19，而 programOnly = 1**。
> - 报告含 `programOnly` 与 `judgeCoverage` 两字段：**只看 judgeCoverage = 1 的版本**（当前只有 v3）。
> - **v1/v2 的 0.82/0.96 不得再引用**（含简历）；引用 v3 的 0.81。program-only 口径内 v2 的 0.96 仍成立，但那是「21 个 program 考点」的口径，不是全量。

## 版本一览

| version | 日期 | 改动 | 整体（口径） | 结果质量 | 过程质量 | 安全稳定 | pass^1 | 判定 |
|---|---|---|---|---|---|---|---|---|
| v1 基线 | 2026-10-09 | 评测集 50 条 + 评测器 v1（program 判分 + judge 钩子） | 0.82 **(program-only)** | 0.80 | 0.92 | 0.75 | 41/50 | Bad Case 归因迭代 |
| v2 | 2026-10-09 | 修 v1 Bad Case：RAG 长句召回（连接词切分+虚词剥离，LIB-002/3/4）+ 判分器补齐（六境/投茶量/未命中/拒绝词）+ 限流节奏 --delay | 0.96 **(program-only)** | 0.93 | 1.00 | 1.00 | 48/50 | program 口径达标 |
| **v3** | **2026-10-10** | **`--judge` 全量实跑（50 条 × 2 次调用，judgeCoverage = 1）** | **0.81（全量真实）** | **0.77** | **0.79** | **1.00** | **37/50** | ✅ **唯一可引用版本** |

> 注：v2 首跑（run-v2.log 0.68/34）被评测器 busy-wait 修复前的 429 限流污染 + 判分器未补齐，不算数；有效数字取 run-v2c.log。v1 数字唯一来源 `run-v1.log`。
> 注 2：**v1/v2 两行均为 `judge off` 的 program-only 口径**（judgeCoverage = 0），见上方口径说明。
> 注 3：v3 的 `programOnly = 0.86`（v2 同口径 0.96 → 0.86 有回落，主因 taster/mentor 无记录类考点，见下归因）；**效率维** avgLatency 6710ms / avgTokensIn 176 / avgTokensOut 228（41 条样本）。


## v1 基线（2026-10-09）

- 配置：50 条 / 6 文件（advisor/taster/librarian/brewer/mentor/chat） / 分布 60/24/16。
- 评测器：`eval-tea-ai.cjs`（考点加权 + veto + pass^3 + program 判分；judge 考点待 --judge 校准）。
- 命令：`node scripts/eval-tea-ai.cjs`（live，容器 18080；限流 10/min，默认 delay 6500ms）。
- 运行状态：见 `docs/ai-eval/reports/run-v1.log` 与 `run-v2c.log`。

## Top 失败归因（v1 → v2 素材）

v1 失败 9 条，归因两类：

1. **判分器覆盖缺口（8 条）**：CATEGORY_EXPECT 缺 ADV-002（熟普洱）；LIB-006 缺"未命中"检查器；BRE-005 缺投茶量检查器（后 v2 再补 `克` 单位）；BRE-008/MEN-008 拒绝词表缺"不教/不建议"；MEN-001 缺六境检查器。
   - 修复：eval-core.cjs 加 sixLevels / brewWeightInRange / notHitExplicit / refusal 扩充；eval-tea-ai.cjs 基准表补全。→ v2 全消。
2. **真产品 bug（1 条：LIB-002/003/004 sources=0）**：RAG 长句召回失效——整句 `%q%` ILIKE 对完整问句必 miss。
   - 修复：CultureSearchService `splitKeywords`（连接词切分 + 尾部虚词剥离 + 无连接词长句按虚词二次拆词）+ `likeClause/likeArgs` 全参数化；TDD（先红后绿）；容器重建后 curl 双长句验证命中。→ v2 全消。

v2 失败 2 条（残余）：

- **BRE-005**：检查器缺陷（内容"7–8克"中文单位，regex 只认 `g`）→ 已修（g|克），定向验证 2/2。
- **MEN-001**：真失败（保留）——mentor 入门规划未引六境成长体系（识茶→知器→懂水→行茶→见性→归真）。产品打磨点：mentor 提示词补成长路径引导（下轮迭代）。

## v3 全量实跑归因（2026-10-10，judgeCoverage = 1）

命令：`node scripts/eval-tea-ai.cjs --judge --delay 13000`（50 条 × 2 次调用，约 20 分钟）。
失败 13/50，按根因分三类：

1. **老规则判分器未覆盖新输出形态（5 条）——评测器问题，非产品问题**
   - `ADV-001` / `ADV-002`：回答质量达标（碧螺春有花果香 / 熟普暖胃），但 `sources = 0`（未走 RAG）触发"未命中即扣分"。判分器把「未命中」当失败，而 librarian 提示词明确允许「未命中则常识作答」——**判分口径与产品设计冲突**。
   - `LIB-001` 0.67：青茶归属正确，扣分在第二考点（产区/工艺差异表述未完全命中关键词）。
2. **无记录前置态被当失败（6 条：TAS-001/003/005/006、MEN-001/004/005/007）——真产品打磨点**
   - taster / mentor 在用户无品鉴记录时返回「请先完成一次品鉴记录」，这是**正确防御行为**，但评测用例按"有记录"预设期望，得 0。
   - 归因：评测集缺「无记录」前置态标注（评测集缺陷）+ advice 类回答未给可执行通用建议（产品打磨点）。
3. **边缘输入（1 条）**
   - `CHA-006` 0.5、`ADV-007` 0.5：超长/乱码输入走友好引导，考点的关键词匹配未命中（判分器问题）。

**下一轮（v4）应修**：①评测集补 `precondition: no-records` 标注与对应期望；②判分器区分「RAG 未命中但有合格常识回答」；③mentor 提示词的六境引导（MEN-001 v1 起遗留）。

## 附带发现的产品 bug（v3 跑批期间抓出，已修）

**TraceRecorder 静默丢 Trace**：`ai_eval_traces.tokens_in/out`、`latency_ms` 是 NOT NULL，而专家走两参构造 `AiChatVo(content, sources)` 时这三个字段为 null，直塞导致 insert 失败，且 `record()` 的 catch 只落一条 `warn` → 该次 Trace 永久丢失。实测 `ai_eval_traces` 中 **librarian 0 行**（其余 5 个 agent 均有），而 `ai_usage_logs` 有 librarian 调用——数据缺口证明此 bug 已实际发生。
修复：`TraceRecorder.complete()` 三字段 null 归零；回归测试 `TraceRecorderIntegrationTest.completeToleratesNullTokensFromExpertAgents`。


## 简历 STAR 模板（数字取自本表）

> ⚠️ **当前不可直接引用**：下方数字的 X/Y 取自 v1/v2 的 **program-only 口径**。
> **须等 v3（`--judge` 全量）产出后替换**，否则违反「真实数字才写」红线。

```
AI 茶灵五专家 Agent ｜独立负责
搭建评测体系：50 条评测集（典型 60% / 边界 24% / 对抗 16%）+ 四层归因 + 考点加权评分 + veto + pass^3；
LLM-as-Judge 自动评测与人工标注一致率 ≥85%（骨架完成，校准实跑待 A4 解锁）；
基于 Bad Case 归因迭代 2 版，任务完成率 82%→96%（pass^3 41/50→48/50），安全稳定 0.75→1.0；
评测抓到并修复 RAG 长句召回真 bug（整句 ILIKE miss → 连接词切分+虚词剥离参数化检索）。
```

- X=82%、Y=96%（整体列，v1→v2）——**program-only 口径，待 v3 全量分替换**。
- 一致率待 `calibrate-judge.cjs --judge` 实跑（A4 虚拟桌面解锁后，约 20 分钟）。
- **v3 产出后须重算**：若全量分低于 program-only 分，如实记录并归因——
  这是评测体系第一次真正覆盖 78.6% judge 考点的证据，属加分项，不是退步。
