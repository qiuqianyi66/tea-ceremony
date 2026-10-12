---
name: req-ai-eval-v6-2026-10-12
description: 评测迭代 v6 需求——v3/v4 归因落地清单：评测集前置态标注、判分器「未命中但合格常识」口径、mentor 六境引导、judge 非确定性统计口径、T08/T09 充值后补跑条件。F 编号 + Given-When-Then + 边界 + 影响 + 8 维就绪度。
status: draft
owner: yanha
date: 2026-10-12
last_updated: 2026-10-12
---

# REQ-ai-eval-v6-2026-10-12：评测迭代 v6 需求

> 素材：`docs/ai-eval/ITERATIONS.md`（v3 失败 13 条归因 / v4 失败 13 条归因 / v5 当前 0.80）、`docs/plans/PLAN-ai-capability-2026-10-10.md` Phase 3（T08-T10）。
> 上游：`docs/prd/REQ-ai-capability-2026-10-10.md` F-C（评测基线）——本 REQ 是 F-C 的**迭代细化**，不重复立项；SFT（F-D）与缓存（F-E）已覆盖，不在本 REQ 范围。
> 约束：**本 REQ 只出需求文档，不实施**；实施分「离线批」与「充值后补跑批」（DashScope 2026-10-12 欠费，HTTP 400 Arrearage，live AI 调用全被拒）。

## 0. 一句话结论

v6 做 5 件事：F-V1~F-V4 离线可做（评测集标注 / 判分器口径 / 报告统计格式 / 后端 prompt 改动 + 单测），F-V5 是 T08/T09 的充值后补跑条件定义。目标：把 v3/v4 归因清单清零，给 v7 留下可信的 pass^3 基线。

## 1. 背景（实测证据，非推测）

- **T10 已完成**（PR #56，757c552）：taster/mentor 无记录时从「只索要记录」改为「通用建议 + 引导记录」；但**评测集仍按「有记录」预设期望** → 前置态标注缺口（F-V1）。
- **v3 归因**：判分器把「RAG 未命中」当失败，与 librarian「未命中则常识作答」的产品设计冲突。v4 F3 修了茶名→茶类映射（ADV-001/002 转通过），但 `sources=0` 自动扣分的规则本身未改（F-V2）。
- **MEN-001 自 v1 遗留**：后端 mentor 提示词无六境引导（六境此前只存在于前端；v4 F2 已把判分基准词修为产品实际值）。T10 本地验证残留失败被归因为 judge 口径偏严，「六境定义准确」待后端补引导后复核（F-V3）。
- **judge 非确定性**：pass^1 在 34-37 间波动（±3 条噪声）；`--iterations 3` 统计口径未实跑（T08 两次失败，根因 DashScope 欠费，非代码问题）（F-V4/F-V5）。

## 2. 功能需求（F 编号 + Given-When-Then）

| # | 需求 | 优先级 | 离线可做？ |
|---|---|---|---|
| F-V1 | 评测集补前置态标注 | P1 | ✅ |
| F-V2 | 判分器区分「RAG 未命中但有合格常识回答」 | P1 | ✅（dry-run + 单测） |
| F-V3 | mentor 提示词六境引导 | P1 | prompt 改动 + 单测 ✅；live 验收待充值 |
| F-V4 | judge 非确定性统计口径（pass^3 报告格式） | P1 | ✅ |
| F-V5 | T08 pass^3 / T09 judge 校准的充值后补跑条件 | P2 | 条件定义 ✅；执行待充值 |

验收标准：

- **F-V1**：Given 50 条评测用例，When 读 `docs/ai-eval/cases/*.yaml`，Then 每条带 `precondition` 字段（枚举 `no-records` / `has-records` / `n/a`）；`no-records` 用例的期望文本对齐 T10 后新行为（含实质通用建议 + 引导记录），不再把「只索要记录」判为失败。
- **F-V2**：Given librarian/chat 路径回答 `sources=0`，When 判分，Then 同时满足三条件（内容非空且不回声 + 无夸大功效/越界拒答 + 回答了用户问题）即判内容考点通过、不再因 `sources=0` 自动扣分；任一条件不满足才扣分。
- **F-V3**：Given 新用户问入门规划（MEN-001），When mentor 生成回答，Then 回复引用六境成长路径，六个境界名与 `src/data/constants.ts` 的 `TEA_LEVELS` 逐字一致（实现时从代码常量取值同步文案，不两处手写词表——防 v4 F2 基准漂移复发）；live 验收待充值后跑 MEN 子集。
- **F-V4**：Given `--iterations 3` 跑批，When 出报告，Then 报告含 pass^3 + 单轮 pass^1 序列 + 噪声范围（max−min）；`ITERATIONS.md` 只收录 pass^3（judgeCoverage=1 口径），单次波动值不写入简历数字。
- **F-V5**：Given DashScope 账户恢复（无 Arrearage），When 执行补跑命令，Then 产出 T08 全量 pass^3 报告 + T09 judge 一致率（≥85% 达标线沿用 F-C2）。补跑命令：`node scripts/eval-tea-ai.cjs --judge --iterations 3 --delay 7000`；前置：先一次 chat 探活确认不再返回 400 Arrearage。

## 3. 范围边界

### 做什么

F-V1 评测集标注、F-V2 判分器口径、F-V3 后端 mentor prompt、F-V4 报告统计格式、F-V5 补跑条件定义。

### 不做什么（明确排除）

1. **不 live 调用 AI**——DashScope 欠费期间一切真实评测/嵌入/微调调用必失败；本 REQ 只出文档。
2. **不改 `src/services/teaAI.ts`**——降级链承重墙；评测器 `extractSystemPrompt` 同源抽取逻辑不动。
3. **不改 `AI_SYSTEM_PROMPT` 文本**——Phase 1 安全边界已锁（PR #50）。
4. **不扩评测集用例数**——只补前置态标注与期望对齐，不加新 case。
5. **不引入 promptfoo / DeepEval**——自建评测器延续；不改 judge 一致率阈值（≥85% 沿用 F-C2）。
6. **不重复立项 SFT（F-D1~D3）/ 缓存（F-E1~E2）/ SSE（P2 暂缓）**——上游已覆盖或已暂缓。

## 4. 影响分析

- **影响面**：评测器 `scripts/eval-core.cjs` + `eval-tea-ai.cjs`、评测集 `docs/ai-eval/cases/*.yaml`、后端 `MentorAgent.java` prompt（L0 文案级）。
- **承重墙**：`teaAI.ts` 降级链 / 502 语义 / 无 key 规则降级——**不触及**。后端 mentor prompt 与前端 `AI_SYSTEM_PROMPT` 相互独立，无漂移耦合。
- **契约**：`.harness/wiki/api-contract.md` 不变（无端点/字段变更）。
- **数据**：无 Flyway 迁移；`ai_eval_traces` 结构不变（PR #43 的 null 归零修复保留）。
- **回滚**：全部为脚本 / YAML / prompt 文本，`git revert` 即回滚，零成本。
- **验证方式**：离线批跑现有 dry-run + 单测（v4 后 26+ 绿）；live 项显式标记「待充值」，不跑不计分。

## 5. 决策点（推荐答案自主收敛，用户不在场）

| # | 决策 | 推荐 | 理由 |
|---|---|---|---|
| D-v6-1 | F-V2「合格常识」判定口径 | 三条件机械化（非空不回声 + 安全合规 + 回答了问题） | 可程序判分，dry-run 即可验证，不新增 judge 主观分 |
| D-v6-2 | F-V3 六境词表来源 | 后端 prompt 文案人工对齐前端 `TEA_LEVELS` 代码常量一次 | 词表两处手写必漂移（v4 F2 教训）；六境是产品文案非 prompt 逻辑 |
| **OQ-2** | T08/T09 补跑 | 充值探活后执行 `--judge --iterations 3 --delay 7000` | 命令沿 PLAN T08 定义；delay 7000 对齐 PR #57 评委限流节奏修复 |

## 6. 8 维就绪度

| 维度 | 状态 | 说明 |
|---|---|---|
| 流程 | ✅ | 离线批（F-V1/V2/V4 + F-V3 prompt 与单测）→ 充值探活 → live 批（F-V3 验收 + T08/T09） |
| 状态 | ✅ | `precondition` 三值枚举；无状态机改动 |
| 权限 | ✅ | 无角色区分；离线脚本本地跑，后端 prompt 随后端 PR |
| 字段 | ✅ | `precondition` 枚举；期望值对齐 T10 新行为；六境词表从 `TEA_LEVELS` 取值 |
| 交互 | ✅ | 无前端 UI 改动 |
| 异常 | ✅ | 欠费 → live 步阻塞、离线步照常；judge UNKNOWN 分账沿用 v4 F4 |
| 数据 | ✅ | 无表 / 迁移变更 |
| 验收 | ✅ | F-V1~F-V5 全部 Given-When-Then，可测 |

**含糊点**：无遗留「待确认」项（D-v6-1/2 已按推荐值收敛；OQ-2 唯一外部依赖是 DashScope 充值，不阻塞离线批开工）。
