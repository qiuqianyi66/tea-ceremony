---
last_updated: 2026-10-06
status: active
owner: yanha
---

# caveman-review 人读审查页

> 面向人核对。AI 编码助手评审前先读 `SKILL.md`，人审查本页即可。

## 它管什么

代码评审的**输出格式**：一行一条 finding + 严重度（🔴/🟡/🟢），按文件分组，结尾 verdict。目的是评审输出省 token。

## 何时该用与不该用

- 该用：用户点名 caveman 风格 / 一行式 / 轻量评审。
- 不该用：默认流水线评审（阶段 6 走 expert-reviewer 完整 6 维）；本技能不改评审深度，只换格式。

## 审查要点

1. 与 expert-reviewer 边界清晰：不降级评审维度，不改红线。
2. 格式强制：`L<line>: <severity> <problem>. <why>. <fix>. <see>.`（问题 / 根因 / 修复 / 规则出处；285「错误信息即 prompt」三要素 + why 增强）、按文件分组、结尾 verdict。
3. 关键 finding 附失败输出原文（截断 ≤ 60 字符）；🟡 以上必带 see（规则出处）。
4. 🔴 禁降级（红线沿用编码规范）。
5. 覆盖全部变更文件。

## 怎么知道它在生效

- 评审输出为一行一条 finding，每行含行号 + 严重度 + 问题 + 根因 + 修复 + 规则出处。
- 关键 finding 附失败输出原文片段。
- 输出结尾有一行 verdict。
- 未触发时（默认流程）评审输出为 expert-reviewer 完整表格。
