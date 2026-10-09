---
name: quality-audit
description: quality-audit 人读审查页——面向人核对四性审计门禁（规范性/维护性/安全性/可扩展性）。机器侧权威在 .harness/skills/main-dev/quality-audit/SKILL.md。
status: active
owner: yanha
date: 2026-10-09
last_updated: 2026-10-09
---

# quality-audit 人读审查页

> 面向人核对。机器侧权威在 `.harness/skills/main-dev/quality-audit/SKILL.md`，本页只做翻译与核对，不复制规范正文。

## 它管什么

- 质量四性审计：规范性（红线/架构/风格）、维护性（治理一致性/文档/死代码）、安全性（越权/密钥/输入/面收敛）、可扩展性（契约/配置/迁移/增量演进）。
- 四批检查 → 修复清单 → 分批独立提交 → 逐批验证 → 最终主门禁全绿。

## 何时该用 / 不该用

| 该用 | 不该用 |
|---|---|
| 用户点名"质量审计 / 四性审计 / 规范性检查 / 安全审计" | 单点 bug 修复（走 trouble-shooting） |
| 大提交 / 发布前的质量门 | 新功能开发（走 request-analysis） |
| 需求文档中质量四性验收重头的落地 | 纯文档小改（直接改） |

## 审查要点（人怎么核对它生效了）

1. 四批是否各自产出修复清单（`.harness/changes/<feat>/quality-audit.md`，格式 `L<file:line>: <严重度> <问题>. <根因>. <修复>.`）。
2. 高危是否清零；中低危是否排期（不允许"全修完再交"的虚假完成，也不允许高危带病提交）。
3. 每批是否独立 commit、批间可回退、修复是否只动审计命中的违规（无顺手重构）。
4. 最终是否重跑主门禁：`audit-redlines.cjs` + `verify-harness.cjs` 全绿。
5. 审计是否引用红线编号而非重复定义红线内容（技能规范 §2 禁止）。

## 怎么知道它在生效

- SKILL.md frontmatter：`type: executable` + `verification: node scripts/audit-redlines.cjs && node scripts/verify-harness.cjs`。
- main-dev README 阶段 6-7 一行已登记（README 不列 = 不存在）。
- verify-harness 技能计数：.harness/skills 33 个（main-dev 9 / biz-dev 19 / trouble-shooting 5）。
