---
name: plan-t15-c6-triage-2026-10-13
description: T15 C6 低优先四维甄别决定表——K17-K22 / P1-5/6/7/9/10 逐项做/砍/降级，附依据与解锁条件。推荐由用户拍板后实施。
status: active
owner: yanha
date: 2026-10-13
last_updated: 2026-10-13
---

# T15 C6 低优先四维甄别决定表（2026-10-13）

> **状态更新（2026-10-17 复核）**：决定表「做」的 4 项中 **K17 / K21 / P1-5 / P1-6 已完成**（K17 `scripts/eval-extract-regression.cjs`；K21 `session-handoff/SKILL.md:17-18`；P1-5 `LibrarianAgent.java:104-106`；P1-6 `AiUsageSummaryService`），**只剩 P1-10**（= PLAN-open-items A1）。

> 来源：`PLAN-final-convergence-2026-10-09.md` T15；定义：K17-K22 见 `PLAN-harness-research-2026-10.md`，P1-5/6/7/9/10 见 `TODO-PRIORITY.md` D 区。
> 四维甄别：自由（自用价值）/ 用户（真实需求）/ 竞品（差异化）/ 伪需求（不该做）。

## 决定表

| 项 | 定义 | 四维甄别依据（实测） | 推荐 | 理由 / 解锁条件 |
|---|---|---|---|---|
| K17 | Trace→回归样本约定：评测 bad case 转回归样本 | 自由高（防评测回归，评测体系 v3 已跑通）；用户=自己；竞品无关；非伪需求 | **做** | 最小版可离线（已存 trace 作断言样本）；等评测 v6 需求（F-V1~V5）live 批落地后并入 |
| K18 | eval 历史基线自动 diff | 价值中；当前评测手动跑、ITERATIONS 已记录 v1/v2/v3 | **降级** | 随 K19 cron 节奏落地后一起做；当前手动 diff 够用 |
| K19 | 每周 cron（原 ID 13364196800514）：verify 重跑 + eval 报告 | cron 实测已不存在（list 0 任务）；eval live 需 AI key（DashScope 欠费 OQ-2） | **降级** | 解锁：AI 恢复后可建 verify-only cron（无需 key）；eval 报告随 OQ-2 解决 |
| K20 | 结果度量：AI 提交占比（从今起带标记） | 需先立提交标记约定（AGENTS.md 无定义）；收益主观 | **降级** | 需要时再做；避免为度量改提交流程 |
| K21 | HANDOFF 分级（L3 强制写 / L0 不写） | session-handoff 技能已有触发条件（会话结束/换 agent/切片交接），缺 Modification Level 分级 | **做** | 小改：技能触发条件补 L 级映射（L2+ 强制 / L0 不写） |
| K22 | 润化包 8 子项（G24 ①-⑧） | 发布卫生类，多数已被 P1 深化覆盖 | **降级** | 真发布时逐项核对 |
| P1-5 | 审计员风险标记：LibrarianAgent 无来源输出加 ⚠ | 用户价值中（AI 回答可追溯性）；竞品差异化小 | **做** | 后端最小版：无来源加"⚠ 无来源"标记；前端展示可选 |
| P1-6 | ai_usage_logs 消费端：每日统计 + 预算告警 | 预算管控有价值，但 AI key 未配（502 降级）无数据可看 | **降级** | 解锁：AI_DASHSCOPE_API_KEY 生效后做 |
| P1-7 | 前端优化 P-O 系列（RAG 引用展示 / Web Vitals / 性能） | 部分已做（PR #61：对比度/触控/loading 空态）；剩余依赖 AI 引用数据 | **降级** | P-O4 随 AI 引用数据落地；P-O1~O3 可穿插 |
| P1-9 | HTTPS：证书挂载 → 443 | 需域名 + 证书，当前公网是裸 IP（42.121.125.4），无域名 | **降级** | 解锁：用户申请域名后做 |
| P1-10 | OPTIMIZATION_PLAN 残留核对（限流/熔断/gunicorn 等旧栈项 vs 新栈） | 文档核对类，零风险防旧文档误导 | **做** | 逐项映射：新栈消解 / 旧栈保留 / 已过时标注 |

## 汇总

- **做（4 项）**：K17、K21、P1-5、P1-10
- **降级（7 项）**：K18、K19、K20、K22、P1-6、P1-7、P1-9
- **砍（0 项）**：无纯伪需求，均保留价值

## 实施顺序建议（拍板后）

1. P1-10 OPTIMIZATION 核对（纯文档，最快）
2. K21 HANDOFF 分级（技能小改 + README 路由表同步）
3. P1-5 审计员风险标记（后端最小版，L2 需测试）
4. K17 Trace→回归样本（并入评测 v6）

> 决定表为推荐，最终做/砍/降级由用户拍板；未拍板项不实施。

## 决策记录

> **已照准（2026-10-17）**：决定表按推荐执行（做 4 / 降级 7 / 砍 0）。其中 K17、K21、P1-5、P1-6 已完成（证据见 `docs/plans/PLAN-open-items-2026-10-17.md` §4），P1-10 已于 2026-10-13 完成（`docs/OPTIMIZATION_PLAN.md` §五）。**本表全部落地，关闭。**
