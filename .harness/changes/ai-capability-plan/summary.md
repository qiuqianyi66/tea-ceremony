---
last_updated: 2026-10-10
status: active
owner: yanha
---

# ai-capability-plan 变更记录

> 目录：`.harness/changes/ai-capability-plan/`。本切片无数据库迁移，故无 db-migrations.sql / rollback.sql（按 m1-ai 惯例在顶部注明）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | ai-capability-plan（AI 能力建设立项：需求 + 方案 + 决策） |
| 分支 | `docs/ai-capability-plan`（基于 main `5981126`） |
| 需求来源 | 用户 2026-10-10 指令「总结上下文 + 规划优先级方案（plan-control）」+ 同意 SFT 微调预算 |
| 类型 | docs |
| 涉及范围 | 治理文档（新增 REQ/PLAN/ADR-020/HANDOFF；更新 AGENTS/工程结构/CONTEXT/TODO-PRIORITY + 两处被推翻原文）。无代码、无前端、无部署、无数据 |

## 二、需求与方案

### 需求描述

把 2026-10-10 会话实测发现的四类问题（安全风险 / RAG 表空 / 评测噪声 / 缓存吃不到）整理为可执行工程，并**推翻**「不做 SFT」的既有决策。

### 验收标准（Given-When-Then）

- **Given** 新会话读交接，**When** 开工，**Then** 能直接从 Phase 1 开始（无需重新调研）
- **Given** `verify-harness.cjs`，**When** 跑，**Then** ERRORS: []（ADR 声明同步至 020）
- **Given** 被推翻的两处原文，**When** 阅读，**Then** 有 ADR-020 引用（不自相矛盾）

### 技术方案

- 新建 `docs/prd/REQ-ai-capability-2026-10-10.md`（F-A~F-E + D-1~D-5）
- 新建 `docs/plans/PLAN-ai-capability-2026-10-10.md`（五阶段 20 任务，Controlled Track）
- 新建 `docs/ADR/ADR-020.md`（SFT 决策，含 Supersedes + Rejected）
- 新建 `docs/HANDOFF-2026-10-10c-execution.md`（恢复指针）
- 更新：`AGENTS.md` §12 ADR 声明 019→020；`.harness/rules/工程结构.md` 同；`CONTEXT.md` ADR 索引加 020；`docs/plans/TODO-PRIORITY.md` 加「活跃计划」段；**同步两处被推翻原文**（`PLAN-final-convergence` L224、`REQ-ai-project` L117）

### 风险评分（plan-control §6）

```
Phase 1-3/5：Impact 1-2 / Scope 1-2 / Uncertainty 0-1 / Irrev 1 → 4-6 MEDIUM
Phase 4 SFT：Impact 3 / Scope 2 / Uncertainty 3 / Irrev 2 → 10 HIGH（花钱不可逆）
总体 HIGH → Controlled Track；Phase 4 单独走审批门
```

## 三、影响分析

- **影响面**：所有后续 AI 相关会话（新的执行母本）。
- **兼容性**：与 `PLAN-final-convergence` 互补（后者 T01-T15 多已完成）；本 PLAN 接续未完成项。
- **回滚路径**：`git revert` 单 commit（纯文档）。
- **契约变化**：无。
- **承重墙确认**：未触及降级链 / 3D 状态机 / 同步逻辑。
- **决策变更留痕**：ADR-020 含 `Supersedes` 段 + 两处原文已同步，避免文档自相矛盾。

## 四、自检清单

- [x] 十阶段 Gate：L0 文档，轻量路径
- [x] `verify-harness.cjs` ERRORS: []（ADR **20** 个 / CI 13 job / AGENTS.md 250 行）
- [x] `audit-redlines.cjs` ERRORS: []
- [x] `audit-wiki-drift.cjs` ERRORS: []
- [x] `add-doc-meta.cjs` 元信息 111/111
- [x] 被推翻决策有 ADR 留痕 + 原文同步（非静默变更）
- [x] 数据库迁移：无（已在顶部注明）
- [x] 观测期：纯文档，不适用
