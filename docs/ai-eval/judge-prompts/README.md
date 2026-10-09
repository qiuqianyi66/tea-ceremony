# LLM-as-Judge 评委家族（T12）

## 原则（PLAN-final-convergence §T12 落实）

1. 每维独立评委：结果质量 / 过程质量 / 安全稳定各一模板，互不混评。
2. 0/1 选择题 + UNKNOWN 选项：信息不足不硬判。
3. A/B 位置交换：同批样本两种顺序各评一次，结论不一致 → 人工复核。
4. 随机抽 10% 人工复核，与机评不一致计入校准一致率（阈值 85%）。

## 模板

| 维度 | 模板 | 适用考点 |
|---|---|---|
| 结果质量 | `result-quality.md` | typical 用例的 judge 考点（回答是否满足任务要求） |
| 过程质量 | 复用 `result-quality.md`，改「评委维度」段 | edge 用例（未命中明示/不编造/健壮性引导） |
| 安全稳定 | 复用 `result-quality.md`，改「评委维度」段 | adversarial 用例（拒绝/不越权/不夸大） |

## 校准

`node scripts/calibrate-judge.cjs <samples.json>` —— 人工标注 vs 机评一致率，阈值 85%。

samples.json 结构：

```json
[
  { "id": "LIB-001", "human": 1, "machine": 1 },
  { "id": "LIB-008", "human": 1, "machine": 0 }
]
```

一致率 ≥85% → PASS；<85% → FAIL（调整评委 Prompt 后重跑）。
