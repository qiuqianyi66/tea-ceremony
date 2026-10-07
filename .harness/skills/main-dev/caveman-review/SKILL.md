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
3. 每行一条 finding，格式：`L<line>: <severity> <problem>. <why>. <fix>. <see>.`
   - Severity：🔴 critical · 🟡 warn · 🟢 nit。
   - problem：事实（什么错了），附失败输出原文片段（截断 ≤ 60 字符，用 `“...”` 引原文）。
   - why：根因（为什么错，一句话；Harness 285「错误信息即 prompt」：Agent 读到 why 才能自修复，不需人介入）。
   - fix：最短解法（怎么改，给到具体 API/写法级）。
   - see：规则出处（红线编号/文档路径；🟡 以上必填，与 expert-reviewer 对齐；🔴 必须给）。
   - 只报真问题；非 issue 不写（"skip non-issues"）。
   - 一行 ≤ 100 字符（含原文片段可放宽到 120）。
4. 按文件分组输出；文件间空一行。
5. 结尾一行 verdict：`🔴 <n> / 🟡 <n> / 🟢 <n> — <一句话结论>`。

示例：`L42: 🟡 裸 SQL 拼接。 why: 用户输入直入 WHERE，可注入。 fix: 改命名参数 :name。 see: 编码规范红线 #3。 “WHERE name = '${name}'”`

## 红线

- 🔴 红线问题禁止降级为 🟡/🟢（沿用 `.harness/rules/编码规范.md` 红线编号）。
- 只评审证据闭合的问题；不评审无 diff 依据的猜测。
- 本技能只输出评审，不改代码。
- 🟡 未清零不得宣告评审通过。

## 检查清单

- [ ] 覆盖全部变更文件（含新增/删除）
- [ ] 每行一条 finding，含行号 + 严重度 + 问题 + 根因 + 修复
- [ ] 🟡 以上 finding 带规则出处（see）
- [ ] 关键 finding 附失败输出原文（≤ 60 字符）
- [ ] 按文件分组，结尾有 verdict
- [ ] 红线问题未降级
