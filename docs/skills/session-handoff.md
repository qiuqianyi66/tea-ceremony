---
name: session-handoff
description: session-handoff 人读审查页——面向人核对会话交接标准化（已复核/未复核分栏、commit hash 带复核命令、下次第一步具体到命令）。机器侧权威在 .harness/skills/main-dev/session-handoff/SKILL.md。
status: active
owner: yanha
date: 2026-10-10
last_updated: 2026-10-10
---

# session-handoff 人读审查页

> 面向人核对。机器侧权威在 `.harness/skills/main-dev/session-handoff/SKILL.md`，本页只做翻译与核对，不复制规范正文。

## 它管什么

- 把"凭印象写交接"变成结构化、可校验的 HANDOFF。
- 强制五段：一句话现状 / 仓库状态带复核命令 / 已复核 vs 未复核分栏 / 下次第一步具体到命令 / 关键设计决策。
- 把 AGENTS.md §13 四条交接血泪教训（快照叠加、阻塞项假断言、裸编号跨文档、交接不可叠加）固化为硬门。

## 何时该用 / 不该用

| 该用 | 不该用 |
|---|---|
| 会话结束 / 关窗口前 | 会话内继续推进 |
| 上下文将爆（同一问题连续两次修正失败） | 同 agent 同上下文 |
| 换 agent / 换机器 / 跨日继续 | 纯文档小改 |
| 切片完成要交下一个接手人 | |

## 审查要点（人怎么核对它生效了）

1. commit hash 是否带复核时间+复核命令（`git log -1 --format=%h` 现场跑，不抄上一份）。
2. 已复核 / 未复核是否分两栏；未复核栏里有没有"据上一份交接"这种转抄。
3. 阻塞项是否全在未复核栏（不是当事实写在现状里）。
4. 下次第一步是否具体到命令+文件；跨文档编号是否带文档前缀（禁裸 P0-3）。
5. 有无密钥/token/用户数据泄露。

## 怎么知道它在生效

- SKILL.md frontmatter：`type: flow`。
- main-dev README 阶段 10 一行已登记。
- `docs/HANDOFF-YYYY-MM-DD-*.md` 新文件符合五段结构；旧 HANDOFF 保留不删。
