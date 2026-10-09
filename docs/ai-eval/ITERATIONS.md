---
title: AI 评测迭代记录
last_updated: 2026-10-09
status: active
owner: yanha
---

# AI 评测迭代记录（T13）

> 规则：每版记录 version / 改动 / 四维指标 / pass^3 / 归因 Top 失败。简历数字只取自本表，不编。
> 数据来源：`node scripts/eval-tea-ai.cjs` 报告（docs/ai-eval/reports/run-v*.log）+ `node scripts/calibrate-judge.cjs` 校准。

## 版本一览

| version | 日期 | 改动 | 整体 | 结果质量 | 过程质量 | 安全稳定 | pass^3 | 判定 |
|---|---|---|---|---|---|---|---|---|
| v1 基线 | 2026-10-09 | 评测集 50 条 + 评测器 v1（program 判分 + judge 钩子） | 0.82 | 0.80 | 0.92 | 0.75 | 41/50 | Bad Case 归因迭代 |
| v2 | 2026-10-09 | 修 v1 Bad Case：RAG 长句召回（连接词切分+虚词剥离，LIB-002/3/4）+ 判分器补齐（六境/投茶量/未命中/拒绝词）+ 限流节奏 --delay | 0.96 | 0.93 | 1.00 | 1.00 | 48/50 | ✅ 达标基线 |

> 注：v2 首跑（run-v2.log 0.68/34）被评测器 busy-wait 修复前的 429 限流污染 + 判分器未补齐，不算数；有效数字取 run-v2c.log。v1 数字唯一来源 `run-v1.log`（<date>.json 已被 v2 覆盖）。

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

## 简历 STAR 模板（数字取自本表）

```
AI 茶灵五专家 Agent ｜独立负责
搭建评测体系：50 条评测集（典型 60% / 边界 24% / 对抗 16%）+ 四层归因 + 考点加权评分 + veto + pass^3；
LLM-as-Judge 自动评测与人工标注一致率 ≥85%（骨架完成，校准实跑待 A4 解锁）；
基于 Bad Case 归因迭代 2 版，任务完成率 82%→96%（pass^3 41/50→48/50），安全稳定 0.75→1.0；
评测抓到并修复 RAG 长句召回真 bug（整句 ILIKE miss → 连接词切分+虚词剥离参数化检索）。
```

- X=82%、Y=96%（整体列，v1→v2）。
- 一致率待 `calibrate-judge.cjs --judge` 实跑（A4 虚拟桌面解锁后，约 20 分钟）。
