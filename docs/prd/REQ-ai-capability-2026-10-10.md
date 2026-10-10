---
name: req-ai-capability-2026-10-10
description: AI 能力建设需求分析（2026-10-10）——从「修 prompt 安全边界」扩展到「知识注入 + 评测基线 + SFT 微调 + 缓存」四层。含 F 编号 + Given-When-Then + 范围边界 + 影响分析 + 决策点 D-1~D-5。
status: draft
owner: yanha
last_updated: 2026-10-10
date: 2026-10-10
---

# REQ：AI 能力建设（prompt 安全 / 知识注入 / 评测基线 / SFT 微调 / 缓存）

> 依据：2026-10-10 会话实测（v5 全量实跑 15 条失败归因 + DB 数据盘点 + 百炼缓存/微调官方文档）。
> 上游：`docs/prd/REQ-ai-project-2026-10-09.md`（评测体系）、`docs/plans/PLAN-final-convergence-2026-10-09.md`（T01-T15）。
> **本 REQ 需要推翻上游两处「不做」决策**（见 §范围边界）。

## 一、为什么现在做（实测驱动，非推测）

### 事实 1：v5 评测暴露安全风险

`node scripts/eval-tea-ai.cjs --judge --delay 13000` → overall 0.80 / judgeCoverage 0.96 / pass^1 35/50。

失败 15 条中，**11 条是 prompt/产品逻辑问题，0 条是「模型知识不够」**：

| 失败类型 | 条数 | 例 |
|---|---|---|
| **安全边界被削弱** | 2 | `CHA-003`「茶可助消脂」引《本草纲目》→ 夸大功效（**veto 考点**）；`CHA-005` 同类 |
| 无记录时不答问题 | 7 | `TAS-001/003/005/006`、`MEN-001/004/005` 统一回「请先完成记录」 |
| 未命中未明示 | 1 | `LIB-006`（带 system prompt 后回答更自信，不再说「知识库未命中」） |
| judge 非确定性 | ~4 | `ADV-008` 0→0.5、`CHA-004/008` 波动 |

**关键**：`CHA-003` 的考点 `不夸大功效` 标了 `veto: true`——一旦触发，整条用例判 0。这是**真实安全风险**，不是分数问题。

### 事实 2：RAG 知识库是空的（最被忽视的短板）

```
teas          66 ✅      culture_chunks   0 ❌  ← RAG 向量表
tea_people    21 ✅      tea_relations    0 ❌
tea_regions   19 ✅      agent_prompts    0 ❌  ← prompt 版本表
tea_poems     25 ✅
teawares       6 ✅       tasting_records  1
tea_processes  6 ✅       users            4
tea_etiquettes 14 ✅
```

`culture_chunks = 0` 意味着 **RAG 检索永远命中不了**——这正是 v3/v4/v5 反复出现「知识库未命中，以下为常识回答」的**根因**。不是模型不行，是**没东西可检索**。

### 事实 3：缓存当前吃不到（推翻前一版判断）

实测数字（本地 DB）：

```
调用 704 次 | 输入 158,712 token | 输出 73,638 token
平均每次：输入 225 / 输出 105        ← 输入是输出的 2.14 倍
带 system prompt 实测单次：输入 136 token
```

百炼官方文档（[上下文缓存](https://help.aliyun.com/zh/model-studio/context-cache)）：

| 模式 | 命中价 | 需改代码 | 最低 token |
|---|---|---|---|
| **隐式缓存** | 输入单价 **20%** | ❌ 自动生效、无法关闭 | **1024** |
| 显式缓存 | 输入单价 **10%** | ✅ 需 `cache_control` 标记 | 1024 |

**当前每次输入 136-225 token < 1024 → 隐式缓存命中不了。**
`qwen-turbo` 在隐式缓存支持列表中（[官方模型列表](https://help.aliyun.com/zh/model-studio/context-cache)）。

→ 所以「省 token」不是「实现缓存」（它已自动在跑），而是**把公共前缀做到 1024+ 才能吃到 20% 折扣**，或改用显式缓存。

### 事实 4：语义缓存已规划未落地

`docs/ADR/ADR-012.md` 已定案：
> **AI 语义缓存**：对 AI 问答/荐茶请求，先用 embedding 相似度匹配 Redis 中的历史响应，命中则直接返回，降低 LLM 调用成本。
> **M3** 落地语义缓存与限流。

但 `grep cache` 在 `backend/.../ai/` 零命中——**未实现**。语义缓存省掉**整次调用**（100%），比省 token 狠。

## 二、功能需求（F 编号 + Given-When-Then）

### F-A 安全边界（P0）

| # | 需求 | Given-When-Then |
|---|---|---|
| F-A1 | `AI_SYSTEM_PROMPT` 补安全红线 | **Given** 提问涉功效（减肥/治病/养生承诺），**When** 调 chat，**Then** 明确「非药物、需配合饮食运动」，不得引经据典暗示疗效；`CHA-003`/`CHA-005` 由失败转通过 |
| F-A2 | 安全边界回归锁 | **Given** 修改 prompt，**When** 跑单测，**Then** 有断言锁「功效类提问不得出现『可助消脂/能减肥』类断言」 |

### F-B 知识注入（P0）

| # | 需求 | Given-When-Then |
|---|---|---|
| F-B1 | `culture_chunks` 填充 | **Given** 现有 8 张文化表（teas/people/regions/poems/teawares/processes/etiquettes），**When** 跑回填管线，**Then** `culture_chunks` 非空且覆盖 8 表 |
| F-B2 | RAG 命中率可观测 | **Given** 一次评测跑批，**When** 看报告，**Then** 含 RAG 命中率字段（当前只能看 `sources` 长度间接推断） |
| F-B3 | `tea_relations` 填充 | **Given** 关系表为空，**When** 回填，**Then** 茶与产区/工艺/人物的关系可检索 |

### F-C 评测基线（P1）

| # | 需求 | Given-When-Then |
|---|---|---|
| F-C1 | pass^k 可信 | **Given** `--iterations 3`，**When** 跑全量，**Then** 报告给出 pass^3 与单次噪声范围（当前单次噪声 ±3 条） |
| F-C2 | judge 一致率校准 | **Given** `calibrate-judge.cjs --judge`，**When** 跑，**Then** 输出机评 vs 人评一致率，≥85% 达标 |
| F-C3 | 无记录场景修正 | **Given** taster/mentor 无品鉴记录，**When** 提问，**Then** 给通用可执行建议而非只索要记录 |

### F-D SFT 微调（P3，需预算）

| # | 需求 | Given-When-Then |
|---|---|---|
| F-D1 | 语料构建 | **Given** 704 条调用记录 + 开源茶文化数据，**When** 合成，**Then** 产出 `{instruction, input, output}` 三元组数据集（≥1k 条），格式符合百炼 SFT 要求 |
| F-D2 | 单专家验证微调 | **Given** 数据集就绪，**When** 微调 mentor（失败最多），**Then** 在留出集上优于 base 模型；**未达标则记录失败原因，不强行上线** |
| F-D3 | 微调模型接入 | **Given** 微调模型部署成功，**When** 切流量，**Then** `application.yml` 可配置模型名切换，降级链不变 |

### F-E 缓存（P2）

| # | 需求 | Given-When-Then |
|---|---|---|
| F-E1 | 公共前缀扩容 | **Given** 固定前缀 <1024 token，**When** 优化，**Then** 固定部分 ≥1024，隐式缓存可命中（20% 单价） |
| F-E2 | 语义缓存落地 | **Given** ADR-012 已规划，**When** 实现，**Then** 相似问题命中缓存直接返回，`ai_usage_logs` 标记 `cached=true` |

## 三、影响分析

- **业务影响**：F-A 是安全修复；F-B 让「AI 茶灵懂茶」从口号变事实；F-C 让简历数字可信；F-D 是能力建设。
- **技术影响**：F-B 需 embedding 管线（`culture_chunks` 表已存在，V2 迁移已建）；F-E2 需 Redis（ADR-012 已决策，M2/M3 未落地）。
- **承重墙**：`teaAI.ts` 降级链 / 502 语义 / 无 key 规则降级——**全部不动**。
- **契约**：F-D3 若切模型，`api-contract.md` 的 `/api/v1/ai/chat` 响应结构不变（模型名不出现在契约）。

## 四、范围边界

### 做什么
- F-A 安全边界（L0）、F-B 知识注入（L2）、F-C 评测基线（L0/L1）、F-D 微调（L3）、F-E 缓存（L2）

### 不做什么
- **不做 RL / DPO / 全参微调**——只做 SFT-LoRA（百炼支持的高效微调）
- **不做多 agent 接力流水线**（H9 判砍延续）
- **不做前端主流程改动**（除必要接线）
- **不引入 promptfoo / DeepEval**（自建评测器延续）
- **不训练全新模型**——只微调现有 qwen 系列

### ⚠️ 需推翻的上游决策（本 REQ 的核心变更）

| 文档 | 原文 | 变更为 |
|---|---|---|
| `docs/plans/PLAN-final-convergence-2026-10-09.md` L224 | 模型训练 / SFT / RL：**只出一页概念文档**（能讲清训练数据长什么样） | SFT 微调**实际执行**（用户 2026-10-10 拍板 + 愿意承担预算） |
| `docs/prd/REQ-ai-project-2026-10-09.md` L117 | **不做模型训练/SFT/RL**：文章要求"了解原理"即可 | 同上 |

**理由（需写 ADR-020）**：
1. **用户拍板**：2026-10-10 明确「可以百炼微调，我愿意花费」。
2. **能力建设**：`REQ-ai-project` L23 自评「AI 特有：懂概念/懂原理/**会评测**/能做 Demo」——微调是 agent 工程的必备技能，原决策把它排除在外是**能力缺口**。
3. **有真实用途**：F-A 的「安全边界固化」正是微调的典型场景（把 prompt 里的叮嘱变成权重里的本能）。

## 五、决策点（待用户确认）

| # | 决策 | 建议 | 理由 |
|---|---|---|---|
| **D-1** | 执行顺序 | **A → B → C → D → E** | A 是安全风险且产物即微调语料；C 是 D 的基线前提 |
| **D-2** | 微调范围 | **单专家先验证**（mentor，失败最多） | 省预算 + 证明流程；达标再推广 |
| **D-3** | 是否写 ADR-020 | **写** | 推翻既有决策需留痕（§4 架构级改动） |
| **D-4** | 缓存策略 | **先 F-E1（前缀扩容，零成本）**，F-E2 语义缓存与 Redis 一起做 | ADR-012 已把语义缓存排在 M3 |
| **D-5** | 微调预算上限 | 待用户给具体数字 | 百炼按训练 token 计费，需预算护栏 |

## 六、验收（整体）

- **F-A**：`CHA-003`/`CHA-005` 评测通过；单测锁死
- **F-B**：`culture_chunks` 非空；RAG 命中率可观测且 >0
- **F-C**：pass^3 有统计意义；judge 一致率 ≥85%
- **F-D**：单专家微调模型在留出集优于 base；可配置切换
- **F-E**：缓存命中率可观测；输入成本有下降证据

## 七、风险

| 风险 | 缓解 |
|---|---|
| 微调后模型在**非茶领域**能力退化 | 留出集须含通用对话样本；退化则回滚 |
| 微调成本超预算 | D-5 预算护栏 + 先单专家 |
| 数据合成质量差（LLM 生成语料有幻觉） | 人工抽检 10%；低质样本剔除 |
| 缓存导致回答陈旧 | 语义缓存加 TTL + 相似度阈值保守 |
| **推翻既有决策引发不一致** | ADR-020 + 同步更新两处原文 |
