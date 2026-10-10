---
last_updated: 2026-10-10
status: active
owner: yanha
---

# eval-fidelity 变更记录

> 目录：`.harness/changes/eval-fidelity/`。本切片无数据库迁移，故无 db-migrations.sql / rollback.sql（按 m1-ai 惯例在顶部注明）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | eval-fidelity（评测保真度：A 阶段） |
| 分支 | `fix/eval-fidelity`（基于 main `24c5fed`） |
| 需求来源 | 用户 2026-10-10 拍板选项 C（B → A）；v4 实测发现的两个有效性缺陷 |
| 类型 | fix |
| 涉及范围 | 评测器（scripts/）；无前端、无后端、无部署、无数据 |

## 二、需求与方案

### 需求描述

1. **F-A1 对齐真实调用**：评测请求须与真实前端一致——带 `AI_SYSTEM_PROMPT`。
2. **F-A2 可达性分账**：报告须区分「前端可达路径」与「后端-only 路径」的分数。

### 验收标准（Given-When-Then）

- **Given** 评测发起被评测调用，**When** 构造 body，**Then** `messages[0].role === 'system'` 且内容 = `teaAI.ts` 的 `AI_SYSTEM_PROMPT`（抽取而非复制）。
- **Given** 抽取失败（源文件缺失/改名），**When** 启动评测器，**Then** 打印告警，不静默发空 prompt。
- **Given** judge 调用，**When** 构造 body，**Then** **不带**茶灵 system prompt（评委是独立裁判，带人设会污染判分）。
- **Given** 报告，**When** 输出，**Then** 含 `reachability.frontendReachable` 与 `backendOnly` 两段分数。

### 技术方案

- `eval-core.cjs` 新增 `extractSystemPrompt(source)`：正则抽取模板字面量；未找到返回 `''`（调用方告警）。
- `eval-tea-ai.cjs`：模块加载时从 `src/services/teaAI.ts` 抽取 prompt（**抽取而非复制**，杜绝两份漂移）；`callChat` 加 `opts.withSystemPrompt`（默认 `true` = 被评测调用；judge 传 `false`）；新增 `reachabilitySplit(runs)`。
- 报告 `config.systemPrompt` 记录 prompt 来源，便于日后核对。

### 为什么不直接把 prompt 抄进评测器

抄一份会出现**两份 prompt 漂移**（前端改了评测不改 → 测的又不是真实调用）。抽取则始终与产品同源。这与 v4 的六境基准错误是同一类问题的预防（那份基准就是"凭记忆手抄"抄错的）。

## 三、影响分析

- **影响面**：仅评测脚本，不影响运行时（生产代码零改动）。
- **分数会变**：带上真实 system prompt 后，透明代理路径（`chat.yaml` 9 条）行为与原评测不同——v3/v4 的裸调结果不再可比。这是**修正**，不是退步。
- **专家路径不受影响**：`BaseExpertAgent` 只用 `lastUserMessage(req)` + 自己的 `SYSTEM_PROMPT`，忽略前端 messages——故 system prompt 只对透明代理路径生效（已实读代码确认）。
- **回滚路径**：`git revert` 单 commit。
- **契约变化**：无。
- **承重墙确认**：未触及 `teaAI.ts` / 降级链 / 状态机。

## 四、自检清单

- [x] 十阶段 Gate：L0/L1（评测脚本，无产品行为变更）
- [x] 编码规范红线零违反（`audit-redlines.cjs` ERRORS: []）
- [x] 单测 26 → 29 全绿（新增 `extractSystemPrompt` 3 例，含「能抽取真实 teaAI.ts」）
- [x] 附带修复：v4 遗留的六境单测仍用旧词 `行茶/见性/归真` → 改产品实际值 + 加回归锁
- [x] `verify-harness.cjs` ERRORS: []
- [x] 数据库迁移：无（已在顶部注明）
- [x] 观测期：脚本改动，v5 全量实跑验证
