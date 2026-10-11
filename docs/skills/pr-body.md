---
name: pr-body
description: pr-body 人读审查页——面向人核对 PR body 模板（最小可视化 Summary + before/after Evidence + 单向/双向门）。机器侧权威在 .harness/skills/main-dev/pr-body/SKILL.md。
status: active
owner: yanha
date: 2026-10-11
last_updated: 2026-10-11
---

# pr-body 人读审查页

> 面向人核对。机器侧权威在 `.harness/skills/main-dev/pr-body/SKILL.md`，本页只做翻译与核对。

## 它管什么

- 写 PR body 的模板，目标让 reviewer **不读 diff** 也能回答三问：改了什么、怎么证明它工作、合并风险多大。
- 三段骨架：**Summary**（选一种最小可视化：伪代码/调用树/文件树/diff 形状/Mermaid）→ **Evidence**（before/after 成对：截图/测试输出）→ **Merge Danger**（单向门/双向门 + Blast Radius 一词概括）。
- 是 commit message 的**可视化补充**，不是扩写。

## 为什么建这个技能（而不是在 AGENTS.md 堆规则）

- 三层语义红线：PR body 是**按需产出**（开 PR 时才有），不进常驻规则。
- 「不读 diff 也能判断」靠的是一套视图选择（逻辑→伪代码、调用链→调用树、UI→组件树带状态），是操作清单，不是一句红绳能表达。
- 项目有真实断点教训：pr-body 曾是**孤儿节点**（无前置指向），说明「什么时候写 PR body」本身就是需要沉淀的流程知识。

## 何时该用 / 不该用

| 该用 | 不该用 |
|---|---|
| 分支 push 远端、开 PR 时 | commit message（那是为什么改，这里是改了什么的可视化） |
| 破坏性/数据迁移 PR（必须写回滚） | 直接 push main（已禁） |

## 审查要点（人怎么核对它生效了）

1. Summary 是否选了**一种**可视化，而不是纯文字堆砌。
2. Evidence 的 Before/After 是否**成对**，禁止只写「已测试」不贴证据。
3. Door 是否标了 one-way/two-way；one-way 是否写了回滚方案。
4. Blast Radius 是否一词说清影响范围（`前端单组件` / `跨 3 个 api 文件` / `DB schema`）。
5. 是否用项目术语（`CONTEXT.md`/glossary），不发明新词。

## 怎么知道它在生效

- SKILL.md frontmatter：`type: flow`（判断流程，不跑脚本）。
- main-dev README 已登记一行（阶段 6，分支 push 开 PR 时）。
- 链路闭合：`expert-reviewer`（评审通过）→ `pr-body` → 合并后 `deploy-verify`。
