---
name: caveman-review
description: 轻量代码评审输出风格——一行一条 finding + 严重度分级，省 token。当用户要求 caveman 风格评审、一行式评审、或评审需压缩输出时触发。
---

# Caveman Review

## 触发条件

- 用户要求 "caveman 评审" / "一行式 review" / "轻量评审" / "省 token 的评审"。
- 评审场景但输出要求极简（非完整 6 维报告）。

## 与 expert-reviewer 边界

- 完整评审（6 维 + 🔴🟡🟢🔵 分级表 + 处置）仍走 `expert-reviewer`（流水线阶段 6 硬门禁）。
- 本技能**只换输出格式**，不改评审维度、不改红线、不降评审深度。
- 流水线必经评审（每切片收尾）默认仍用 expert-reviewer；caveman-review 是用户点名或需要极简输出时的格式变体。

## 流程

1. 确认评审范围：`git diff`（本地改动）或 MR/分支范围（评审前先读 `changes/summary.md` 变更清单）。
2. 覆盖**全部变更文件**，不遗漏新增/删除/改名文件。
3. 每行一条 finding，格式：`L<line>: <severity> <problem>. <fix>.`
   - Severity：🔴 critical · 🟡 warn · 🟢 nit。
   - 只报真问题；非 issue 不写（"skip non-issues"）。
   - 一行 ≤ 80 字符；problem 说清事实，fix 给最短解法。
4. 按文件分组输出；文件间空一行。
5. 结尾一行 verdict：`🔴 <n> / 🟡 <n> / 🟢 <n> — <一句话结论>`。

## 红线

- 🔴 红线问题禁止降级为 🟡/🟢（沿用 `.harness/rules/编码规范.md` 红线编号）。
- 只评审证据闭合的问题；不评审无 diff 依据的猜测。
- 本技能只输出评审，不改代码。
- 🟡 未清零不得宣告评审通过。

## 检查清单

- [ ] 覆盖全部变更文件（含新增/删除）
- [ ] 每行一条 finding，含行号 + 严重度 + 问题 + 修复
- [ ] 按文件分组，结尾有 verdict
- [ ] 红线问题未降级
