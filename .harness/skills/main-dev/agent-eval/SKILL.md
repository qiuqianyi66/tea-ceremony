---
name: agent-eval
description: 切片协作质量评估——按 agent-eval-baseline 两层维度（通用 G1-5 / tea 专项 T1-6）验收切片产物，0 分必附证据并沉淀 AGENTS.md §13。流水线阶段 6 评审后、每批收尾必跑。
type: executable
last-reviewed: 2026-10-29
verification: node scripts/agent-eval.cjs <切片名>
---

# Agent Eval（协作质量评估）

## 触发
- 每个切片/每批完成后（评审通过后、提交前）；用户要求"评估/复盘/打基础"时。

## 工作流
1. 跑自动检查：`node scripts/agent-eval.cjs {切片名}`（三件套/评审分级/commit 规范/契约登记/迁移成对）。
2. 人工打分：抽 3-5 条真实会话（含用户纠正过的轮次），按 `docs/agent-eval-baseline.md` G1-5/T1-6 给 0/1/2 分；0 分必附证据。
3. 归因：0 分是行为问题 → AGENTS.md §13 加一行；规则缺失 → 补规则；连续两次同类 0 分 → 升级硬规则（§0/红线）。
4. 落盘：评分表 + 证据写 `changes/{切片}/eval.md`；证据回填 `docs/agent-eval-baseline.md` 证据表。
5. 收敛：同规则连续 3 个切片无违规 → 标记已验证，压缩进基线不重复记录。

## 红线
- 评估是收敛证据链，不是追责；0 分禁止掩盖、禁止"全是 2 分"走过场。
- 只按基线维度检查，不新增未要求检查项（最小实现）。

## 自检
- [ ] `agent-eval.cjs` 全绿或失败项已归因
- [ ] G/T 两层维度全覆盖
- [ ] 0 分均有证据（哪一轮、说了什么、沉淀到哪条规则）
- [ ] eval.md 已落盘

## 下一步
评估通过 → 提交（英文 conventional）→ push → 下一片需求分析。

## 确定性入口

- 切片评分：`node scripts/agent-eval.cjs <切片>`
- 七维评测：`node scripts/eval-harness.cjs <切片> --verify`（不传 `--verify` 则代码正确性维记 0）
- 评测集结构校验（改 case/考点前必跑）：`node scripts/validate-eval-cases.cjs`
- 跑评测：`node scripts/eval-tea-ai.cjs`
- judge 校准（人工标注 vs 机评一致率，阈值 85%）：`node scripts/calibrate-judge.cjs`
- 历史基线 diff（扫 `docs/ai-eval/reports/*.json`）：`node scripts/eval-baseline-diff.cjs`
- 失败 case 提回归样本：`node scripts/eval-extract-regression.cjs`
- RAG 命中率诊断（A8 步骤①②机械化）：`node scripts/diagnose-rag.cjs`

## 踩坑（真实教训）

- **未判的judge 考点必须计 0，不能计中性 1**：原实现按中性计 1 让 v2 报 0.96，改计 0 后同批 dry-run 只有 0.19——98 考点中 77 个从未被判。报告必须显式输出 `programOnly` 与 `judgeCoverage` 两个口径。
