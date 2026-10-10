---
name: plan-ai-capability-2026-10-10
description: AI 能力建设执行方案（2026-10-10）——五阶段 20 任务到代码行：安全边界修复 / 知识注入 / 评测基线 / SFT 微调 / 缓存。含风险评分、取舍、回滚、预算护栏。
status: draft
owner: yanha
last_updated: 2026-10-10
date: 2026-10-10
---

# PLAN：AI 能力建设（2026-10-10）

> 上游需求：`docs/prd/REQ-ai-capability-2026-10-10.md`（F-A~F-E + D-1~D-5）
> 本 PLAN 为 **Controlled Track**（见 `.agents/skills/plan-control/SKILL.md` §8）——跨模块 + 推翻既有决策 + 涉及付费。
> 关联 ADR：**ADR-020**（SFT 微调决策，需新建）

## Goal

把 AI 茶灵从「评测暴露 15 条失败」推进到「安全边界可信 + RAG 真能命中 + 评测有统计意义 + 微调跑通闭环」。

产出（可验证）：
1. `CHA-003`/`CHA-005` 由失败转通过（安全风险清除）
2. `culture_chunks` 从 0 → 覆盖 8 张文化表（RAG 命中率 > 0）
3. pass^3 有统计意义 + judge 一致率 ≥85%
4. **一个专家**的 SFT 微调模型在留出集优于 base（或记录失败原因）
5. 缓存命中率可观测 + 输入成本有下降证据

## Context

### 当前基线（实测，2026-10-10）

```
main = 5981126（PR #41-#48 全 merged）| 工作区干净
评测：v5 overall 0.80 / judgeCoverage 0.96 / pass^1 35/50
      默认路径 18 条 → 0.79 | 专家路径 32 条 → 0.81
数据：teas 66 / people 21 / regions 19 / poems 25 / teawares 6 / processes 6 / etiquettes 14
      但 culture_chunks 0 / tea_relations 0 / agent_prompts 0 / tasting_records 1 / users 4
调用：704 次 / 输入 158,712 token / 输出 73,638 token（平均 225 / 105）
缓存：隐式缓存自动跑但需 ≥1024 token 才命中（当前 136-225 < 1024）
```

### 相关文件（已实读）

| 文件 | 作用 |
|---|---|
| `src/services/teaAI.ts` L258 | `AI_SYSTEM_PROMPT`（**F-A 修改目标**；承重墙文件） |
| `backend/.../agent/{Advisor,Taster,Brewer,Mentor,Librarian}Agent.java` | 五专家 `SYSTEM_PROMPT` |
| `backend/.../culture/service/CultureSearchService.java` | RAG 检索（**F-B 目标**） |
| `backend/src/main/resources/db/migration/V2__culture_seed.sql` | `culture_chunks` 表定义 |
| `scripts/eval-tea-ai.cjs` | 评测器（A 阶段刚改） |
| `docs/ADR/ADR-012.md` | 语义缓存已规划未落地（**F-E2 依据**） |
| `docs/prd/REQ-ai-capability-2026-10-10.md` | 本 PLAN 的上游需求 |

### 待推翻的既有决策

- `docs/plans/PLAN-final-convergence-2026-10-09.md` L224「模型训练/SFT/RL 只出概念文档」
- `docs/prd/REQ-ai-project-2026-10-09.md` L117「不做模型训练/SFT/RL」
- → ADR-020 记录变更理由 + 同步更新两处原文

## Risk Assessment

```
Risk = Impact + Scope + Uncertainty + Irreversibility（各 0-3）
```

| 阶段 | Impact | Scope | Uncertainty | Irrev. | Score | Level |
|---|---|---|---|---|---|---|
| Phase 1 安全边界 | 2（用户可见 + 合规） | 1（1 文件） | 0（病因已实测） | 1（可 revert） | **4** | MEDIUM |
| Phase 2 知识注入 | 2（RAG 全链路） | 2（后端 + 数据） | 1（回填管线新写） | 1（表可清空重填） | **6** | MEDIUM |
| Phase 3 评测基线 | 1（仅评测可信度） | 1（脚本） | 1（judge 一致率未知） | 1 | **4** | MEDIUM |
| **Phase 4 SFT 微调** | 3（模型行为 + 花钱） | 2（外部平台 + 后端接线） | 3（**微调效果不可预知**） | **2（花钱不可逆）** | **10** | **HIGH** |
| Phase 5 缓存 | 1（成本） | 1（后端） | 1（命中率未知） | 1 | **4** | MEDIUM |

**总体 HIGH（由 Phase 4 拉高）** → Controlled Track，Phase 4 单独走审批门。

**Phase 4 风险的具象依据**：
- **花钱不可逆**：百炼按训练 token 计费，训练完不退
- **效果未知**：微调可能让模型在**非茶领域退化**（灾难性遗忘）
- **B 端不可控**：训练时长、队列、失败重试均由平台决定

**缓解**：D-5 预算护栏 + 先单专家 + 留出集含通用样本 + 可回滚（模型名可配置）

## Confidence Assessment

```
confidence:
  level: MEDIUM
  basis: 病因已实测（v5 归因 / DB 盘点 / 官方文档）；Phase 1-3 文件已读
  unknowns:
    - Phase 4 微调效果（无法预知，须实验）
    - 百炼 SFT 具体计费单价（D-5 待用户给预算）
    - judge 一致率是否达标（未跑过校准）
```

→ MEDIUM：Phase 1-3 可直接推进；Phase 4 须先完成 D-5 预算确认。

## Approach

```
Phase 1 安全边界 ──→ Phase 2 知识注入 ──→ Phase 3 评测基线 ──→ Phase 4 SFT ──→ Phase 5 缓存
  L0 半天            L2 1-2 天            L0/L1 1 天          L3 + 付费        L2 1 天
  修 prompt          填 chunks            跑 pass^3          单专家验证       前缀/语义缓存
       │                    │                    │                 │
       └────────────────────┴────────────────────┘                 │
              产物同时是 Phase 4 的语料来源                          │
         （修 prompt 的「正确答案」= 高质量 SFT 样本）                │
                                                                   │
                     Phase 3 的 pass^3 基线 = Phase 4 的对比前提 ────┘
```

**关键洞察（决定顺序）**：
- Phase 1/2 的**产物同时是 Phase 4 的语料**——不是"先做一堆再微调"，而是**同一份工作两个用途**
- Phase 3 的基线是 Phase 4 的**对比前提**——没有可信基线，无法证明微调有效

## Tasks（到代码/文件层面）

### Phase 1 安全边界（P0，L0）

**T01 修 `AI_SYSTEM_PROMPT`**
- Input：`src/services/teaAI.ts` L258 的 `AI_SYSTEM_PROMPT`
- Action：补安全红线段——明确「涉功效（减肥/治病/养生）须说明非药物、需配合饮食运动；禁引经据典暗示疗效」
- Output：prompt 含安全段
- Validation：`CHA-003`/`CHA-005` 评测由失败转通过（重跑 `--judge`）

**T02 安全回归锁**
- Input：`src/services/__tests__/teaAI.spec.ts`
- Action：加单测断言「prompt 文本含安全约束关键词」
- Validation：`vitest` 全绿 + 断言可红（故意删安全段应报错）

**T03 五专家 prompt 同步**
- Input：`{Advisor,Taster,Brewer,Mentor,Librarian}Agent.java` 的 `SYSTEM_PROMPT`
- Action：评估是否需同步安全约束（专家路径不走前端 prompt，**必须各自有**）
- Validation：抽查专家对功效类提问的回复

### Phase 2 知识注入（P0，L2）

**T04 `culture_chunks` 回填管线（骨架）**
- Action：新建 `backend/.../culture/service/ChunkBackfillService.java` + 端点（或 CLI）
- 依据：`V2__culture_seed.sql` 的 `culture_chunks` 表结构（已存在）
- Validation：跑一次后 `culture_chunks` 非空

**T05 八表 → chunks 映射**
- Action：把 teas/people/regions/poems/teawares/processes/etiquettes/relations 各表内容切成 chunk 并嵌入
- 注意：embedding 需调 DashScope embedding API（**会产生费用，计入 D-5 预算**）
- Validation：8 表均有对应 chunks

**T06 `tea_relations` 填充**
- Action：从现有数据推导关系（茶↔产区、茶↔工艺、茶↔人物）
- Validation：`tea_relations` 非空且可检索

**T07 RAG 命中率可观测**
- Action：评测报告加 `ragHitRate` 字段
- Validation：报告含该字段且 > 0

### Phase 3 评测基线（P1，L0/L1）

**T08 pass^3 实跑**
- Action：`node scripts/eval-tea-ai.cjs --judge --iterations 3 --delay 13000`（约 60 分钟）
- Validation：报告含 pass^3 + 噪声范围

**T09 judge 一致率校准**
- Action：`node scripts/calibrate-judge.cjs --judge`（需先人工标注样本）
- Validation：一致率 ≥85% 或记录差距

**T10 无记录场景修正**
- Action：改 taster/mentor prompt——无记录时**也给通用可执行建议**，不只索要记录
- Validation：`TAS-001/003/005/006`、`MEN-001/004/005` 改善

### Phase 4 SFT 微调（P3，L3 + 付费）—— **需审批门**

**T11 语料构建**
- Action：从 704 条调用 + 开源茶文化数据合成 `{instruction, input, output}`；抽检 10%
- Validation：≥1k 条，格式符合百炼 SFT 要求

**T12 预算确认（D-5）** ← **阻塞点**
- Action：用户给预算上限
- Validation：有明确数字

**T13 单专家微调（mentor）**
- Action：百炼平台 SFT-LoRA 微调 mentor
- Validation：留出集优于 base

**T14 效果评估**
- Action：同评测集跑 base vs 微调模型
- Validation：有对比数据；退化则**不上线**

**T15 模型接线**
- Action：`application.yml` 加模型名配置，可切换
- Validation：切换后降级链不变

### Phase 5 缓存（P2，L2）

**T16 公共前缀扩容**
- Action：把固定 prompt + 知识库摘要做到 ≥1024 token，触发隐式缓存
- Validation：`cached_tokens > 0`（百炼响应含该字段）

**T17 语义缓存（ADR-012 落地）**
- Action：embedding 相似度匹配 + Redis 存储 + TTL
- 依据：ADR-012「M3 落地语义缓存」
- Validation：相似问题命中缓存，`ai_usage_logs` 标记

**T18 缓存可观测**
- Action：加命中率指标
- Validation：报告/metrics 可见

### 收尾

**T19 ADR-020 + 同步上游**
- Action：写 ADR-020（SFT 决策）+ 更新 `PLAN-final-convergence` L224 与 `REQ-ai-project` L117
- Validation：`verify-harness` ERRORS: []

**T20 活文档同步**
- Action：更新 `docs/plans/TODO-PRIORITY.md` + 新建 HANDOFF
- Validation：状态可追溯

## Trade-offs

| 取舍 | 选择 | 理由 |
|---|---|---|
| 微调 vs RAG 填数据 | **先 RAG 后微调** | 两者痛点不同：RAG 治「不知道」，微调治「不稳定/贵」。当前 RAG 表是空的 |
| 单专家 vs 五专家微调 | **单专家先验证** | 省预算；失败可弃 |
| 全参 vs LoRA | **LoRA**（百炼支持的高效微调） | 成本低一个数量级 |
| 立刻做缓存 vs 排后面 | **排后面** | 当前输入 <1024 门槛，先要改架构（前缀扩容）才有得缓存 |
| 显式 vs 隐式缓存 | **先试隐式**（零代码） | 自动生效；不够再上显式 |
| 自建评测器 vs promptfoo | **自建**（延续） | 不新增依赖；评测器是简历故事 |

## Rollback Strategy

| 阶段 | 回滚方式 | 成本 |
|---|---|---|
| Phase 1 | `git revert` 单 commit | 零 |
| Phase 2 | `culture_chunks` 表可清空重填（无外部依赖） | 低（重跑嵌入有费用） |
| Phase 3 | 脚本改动 revert | 零 |
| **Phase 4** | **模型名配置切回 base**（不改代码） | 中（训练费不退） |
| Phase 5 | 缓存开关关闭 | 零 |

**Phase 4 特别说明**：训练费用**不可退**。缓解 = 先单专家 + 预算护栏 + 留出集验证。

## Open Questions

| # | 问题 | 阻塞什么 | 建议 |
|---|---|---|---|
| **OQ-1** | 微调预算上限？ | T12 → Phase 4 全体 | 需用户给数字 |
| OQ-2 | 先做单专家还是五专家？ | T13 | 建议单专家（mentor） |
| OQ-3 | 是否接受 Phase 4 效果可能失败？ | Phase 4 战略 | 建议接受（记录失败也是产出） |
| OQ-4 | 语义缓存（T17）是否本轮做？ | Phase 5 | 建议与 Redis（ADR-012 M3）一起 |

## Not Doing

- **RL / DPO / 全参微调**——只做 SFT-LoRA
- **训练全新模型**——只微调现有 qwen
- **多 agent 接力流水线**（H9 判砍延续）
- **前端主流程改动**（除必要接线）
- **引入 promptfoo / DeepEval**
- **真实用户拉新运营**（Q1 单列）
