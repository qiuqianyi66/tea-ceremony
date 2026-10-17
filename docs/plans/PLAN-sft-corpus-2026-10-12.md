---
name: plan-sft-corpus-2026-10-12
description: T11 SFT 语料构建完成——真实数据实测与合成补齐、241 条语料、抽检与拆分。训练量级待拍板。
status: active
owner: yanha
date: 2026-10-12
last_updated: 2026-10-12
---

# PLAN-sft-corpus-2026-10-12：T11 SFT 语料构建（完成）

> 上游：`docs/plans/PLAN-ai-capability-2026-10-10.md` Phase 4 T11｜预算：OQ-1 已拍板 B 档 ¥1,000（训练费；语料构建零花费）。

## 1. 结论

**语料 241 条已构建完成**（真实 54 + 合成 267，去重后 241）。训练 216 / 留出 25（90/10），抽检 21 条。
管道全零花费（合成走 yg-gateway / CodeBuddy 积分，未花官方 DeepSeek/DashScope 余额）。

## 2. 真实数据实测（与方案假设的差异）

- 方案预估语料来源 704 条真实调用——**实测 ai_eval_traces 1568 条中 897 条是 judge 评委调用**（T08 评测产生），203 条过短（评委"0/1"输出），**真实去重茶问答仅 54 条**。
- ai_usage_logs 1236 条仅元数据（无内容）；ai_messages 表 0 条。真实对话数据远少于预期。

## 3. 合成补齐（267 条）

| 来源 | 数量 | 方式 |
|---|---|---|
| 规则问题库 | 217 | 8 主题矩阵组合（推荐 87/品鉴 34/冲泡 23/成长 23/健康 12/安全 12/知识 18/闲聊 8） |
| 评测 case 问题 | 50 | docs/ai-eval/cases/*.yaml 用户输入（含边界诱导） |
| 回答生成 | 267 | 调后端 `/api/v1/ai/chat` agent=mentor（yg-gateway 免费），delay 7s 守限流，断点续跑；266 成功 1 失败（已补跑） |

质量抽查（前 3 条 + 抽检 21 条）：回答真实具体、符合 mentor 人设（先肯定再建议、知识库未命中显式标注、安全边界拒绝），未见幻觉/编造。

## 4. 产物（scripts/sft/）

| 文件 | 说明 |
|---|---|
| `raw-traces.csv` | ai_eval_traces 全量导出（1.15MB，可复现；不提交） |
| `corpus-real.jsonl` | 真实层 54 条（6 agent 去重） |
| `corpus-syn.jsonl` | 合成层 267 条 |
| `corpus-final.jsonl` | 合并去重 241 条（messages 格式） |
| `corpus-train.jsonl` / `corpus-eval.jsonl` | 90/10 拆分 |
| `corpus-sample-10pct.jsonl` | 抽检 21 条（人工复核清单） |
| `build-corpus.py` / `gen-questions.py` / `gen-syn-corpus.py` / `merge-corpus.py` | 全管道脚本（可复用扩量） |

## 5. 量级说明与选项（训练前拍板）

- **当前 241 条**：低于 PLAN 最小闭环 500 条。可跑验证性 LoRA（约 ¥300-500），但样本代表性弱一档。
- **扩到 500+**：脚本可复用，再跑 ~260 条合成 ≈ 55 分钟后台（零花费）；建议扩后再训练。
- **训练按钮**（T13）：需百炼控制台确认 mentor 目标模型 LoRA 单价后执行；训练前语料构建已零花费闭环。

## 6. 待办

1. [ ] 用户拍板：241 条直接训练（A 档预算） or 先扩到 500+（B 档预算）再训练
2. [ ] T13 单专家微调（LoRA，mentor）
3. [ ] T14 留出集对比（T08 pass³ 基线 0.87 为对照——注意该基线为 gateway 非生产模型口径，正式对照需 DashScope 通义基线）

## 决策记录

> **已拍板（2026-10-17）：241 条直接训练（A 档），不先扩到 500+。**
> 理由：扩 500+ 要多花 2-3 天合成 + 更多训练费，而收益无对照验证；先用 241 跑通闭环（训练 → 部署 → T14 留出集对比）再决定是否扩量。
> T13 启动前置仍缺：百炼控制台确认 mentor 目标模型 LoRA 单价 + 用户给预算上限（见 `PLAN-open-items` §2）。
