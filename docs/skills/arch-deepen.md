---
name: arch-deepen
description: arch-deepen 人读审查页——面向人核对浅模块深化扫描（Ousterhout 深模块视角，主动找重构机会）。机器侧权威在 .harness/skills/main-dev/arch-deepen/SKILL.md。
status: active
owner: yanha
date: 2026-10-10
last_updated: 2026-10-10
---

# arch-deepen 人读审查页

> 面向人核对。机器侧权威在 `.harness/skills/main-dev/arch-deepen/SKILL.md`，本页只做翻译与核对，不复制规范正文。

## 它管什么

- 从 Ousterhout《A Philosophy of Software Design》的深模块视角，主动找"接口窄+实现薄"的浅模块。
- 产出 `docs/architecture/deepen-YYYY-MM-DD.md` 报告，最多 5 条高杠杆机会；**只出报告不改代码**。
- 与专家分工：expert-reviewer 查现有代码有没有错，quality-audit 查规范有没有破，本技能找架构摩擦点。

## 何时该用 / 不该用

| 该用 | 不该用 |
|---|---|
| 用户要求"架构体检 / 找重构机会 / 降低 AI 导航成本" | 单点 bug 修复（走 trouble-shooting） |
| V4 生产级收敛期定期架构回顾 | 新功能开发（走 request-analysis） |
| 新模块上线满 1 个月回看是否退化 | 分层方向违规（ArchUnit 已机械管） |

## 审查要点（人怎么核对它生效了）

1. 是否真用 Grep 扫信号清单（`interface ApiResponse` 重复数、`code: 'OK'` mock 散落数），而不是空对空列教科书术语。
2. 每条候选是否过三问：调用方被迫懂内部 / 接口能变宽 / 不碰承重墙。
3. 高杠杆机会是否 ≤5 条；贪多等于没报。
4. 是否误报了薄 Controller / 薄 Repository / 带 null 兜底的转换函数（这些是正确设计）。
5. 报告行号是否当次 Grep 实测，不抄上次报告。

## 怎么知道它在生效

- SKILL.md frontmatter：`type: flow`（不跑脚本，是判断流程，不强制 verification）。
- main-dev README 阶段 6-7 一行已登记。
- 跑过一次后 `docs/architecture/deepen-*.md` 有真实文件产出。
