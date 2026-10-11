---
name: retro
description: retro 人读审查页——面向人核对任务收尾回顾的 6 类环境扫描。机器侧权威在 .harness/skills/main-dev/retro/SKILL.md。
status: active
owner: yanha
date: 2026-10-11
last_updated: 2026-10-11
---

# retro 人读审查页

> 面向人核对。机器侧权威在 `.harness/skills/main-dev/retro/SKILL.md`，本页只做翻译与核对。

## 它管什么

- 任务收尾（功能/bug/重构合并后、会话结束前）扫 6 类找**环境改进点**：Navigation / Automated checks / Coding standards / Global AGENTS.md / Tool economy / No-ops。
- 核心分叉：**机械错误 → 加确定性检查**（脚本/lint/CI job）；**判断错误 → 补规则**。默认「写检查优于写规则」。
- 只改环境（脚本/规则/导航指针），**不改业务代码**。

## 为什么建这个技能（而不是在 AGENTS.md 堆规则）

- 三层语义红线：回顾流程是**按需动作**，不是常驻规则。§13 只收沉淀结果，不收过程。
- 「实现端上下文压力最大、review 端最小」这条判断需要一整套动作配合（先跑检查、按 6 类扫、候选排序），塞进规则会膨胀成无效条文。
- 来源：把「这次怎么又踩坑」从口头复盘固化成结构化动作，tea 已有 verify-harness / audit-redlines / audit-wiki-drift 三个机械化门禁，retro 让它们先跑而不是重造。

## 何时该用 / 不该用

| 该用 | 不该用 |
|---|---|
| 一个切片/功能/bug 修复合并后 | 任务进行中（那是 debug，走 00-bug-diagnose） |
| 会话结束、要开新会话前 | 纯文档小改、交付前最后验证 |
| 这次过程明显卡过、返工过 | 只想改业务代码时 |

## 审查要点（人怎么核对它生效了）

1. 是否先跑了三个脚本（`verify-harness` / `audit-redlines` / `audit-wiki-drift`），而非直接进 6 类扫。
2. 机械错误是否全部落到「写什么脚本/挂什么 CI」，而不是又写一条规则。
3. 候选是否 ≤3 项且按严重度排序——贪多等于没做。
4. 有没有动业务代码（本技能只动环境）。
5. 经验证据是否 ≥3 条才谈晋升 §13，否则只记 `docs/plans/patterns.md` 候选。

## 怎么知道它在生效

- SKILL.md frontmatter：`type: flow`（判断流程，不跑脚本）。
- main-dev README 已登记一行。
- 落地后跑 `node scripts/verify-harness.cjs` 回到 `ERRORS: []`，即环境改进没破坏治理一致性。
