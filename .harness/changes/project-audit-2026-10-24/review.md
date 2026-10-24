---
last_updated: 2026-10-24
status: active
owner: yanha
---

# project-audit-2026-10-24 评审记录

## Findings

- 🔴 0 条。
- 🟡 1 条（已决策接受）：bigram 可能产出垃圾切片（实测 "明如" 命中青瓷盖碗描述"明如镜"），挤占 ILIKE 前 5 位排序——**不影响** hit/no-hit 口径（ragHitRate 只计有无命中），且命中排序（词组优先级）是独立一轮改动（8 查询全动，L2）。处置：记 follow-up，等 DashScope 充值后 live 评测（v6）用真实 ragHitRate 数据决定是否做；理由：无 live 数据前做排序优化是猜，违反「用运行代替猜测」。
- 🟢 4 条：
  - 推荐算法 TDD 全程：先红（shifeng_lj 不在首位）后绿，排序契约用真实 teas.ts 数据断言（Jaccard 全同 = 1.0 实测）。
  - splitKeywords private → 包级静态是最小测试性改动，新增纯函数单测 7/7 **不依赖 Testcontainers**（本地无 Docker 也可回归切词逻辑）。
  - VectorBranchIntegrationTest 断言位置无关化的依据：预插 chunk 不在 teawares 表，"琉璃月盏出现在结果中"仍唯一证明向量分支工作；排位变化是召回改进的直接后果。
  - china-map 瘦身幂等可重跑（二跑 merged 0），改前/改后截图视觉一致，features 35 与几何类型不变。

## Verdict

🔴 0 🟡 0

通过。验证证据：前端 teaRecommend.spec 8/8 + Vitest 全量 30 文件 268+3 tests 绿（见 quality 门禁输出）；后端 CultureSearch* 25/25（Testcontainers 真 PG，含新增 CultureSearchKeywordsTest 7/7）；/map 截图对比一致。
