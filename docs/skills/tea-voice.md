---
name: tea-voice
description: tea-voice 人读审查页——面向人核对对外文本写作与去 AI 味。机器侧权威在 .harness/skills/main-dev/tea-voice/SKILL.md。
status: active
owner: yanha
date: 2026-10-10
last_updated: 2026-10-10
---

# tea-voice 人读审查页

> 面向人核对。机器侧权威在 `.harness/skills/main-dev/tea-voice/SKILL.md`，本页只做翻译与核对。

## 它管什么

- tea 所有**对外可见文字**：`docs/promotion/` 传播文案、README、官网、UI 文案、CHANGELOG 用户可见段。
- 用**项目自己的文案**当音准：`docs/promotion/posts.md` 是唯一范本。
- 写完后扫 8 条 AI 味（em dash 滥用 / 三连排比 / 空洞升华 / 虚假范围 / 模糊归因 / 同义换词 / 粗体滥用 / `-ing` 浅分析）。

## 为什么建这个技能（而不是在 AGENTS.md §2 堆规则）

- 三层语义红线：**操作细节进技能，不进常驻规则**。§2 只留一行指针。
- **通用去 AI 味清单对 tea 帮助有限**——真正有效的是从 tea 自己的文案反推的声音特征（短句成段 / 正反对照定义 / 动词主导 / 低音调）。
- 来源：humanizer（去 AI 味模式）+ design-aesthetics-book（风格选择思想），**重写为 tea 专属，非照搬**。

## 何时该用 / 不该用

| 该用 | 不该用 |
|---|---|
| 写/改传播文案、README、官网、UI 文案 | 代码注释、内部技术文档、commit message |
| 中文社区版、英文社区版重写 | 给用户的技术解释（走 §2 写作风格） |

## 审查要点（人怎么核对它生效了）

1. 改文案前是否真读了 `docs/promotion/posts.md`（不看范本 = 没在按 tea 声音写）。
2. 四特征是否齐：短句成段 / **正反对照**（"不是 X，是 Y"）/ 动词主导 / 低音调不吆喝。
3. 有没有"帮它说得更全面"——tea 说"不是百科、不是工具"是**刻意定位**，不是可优化的修辞。
4. 英文版是否**按英文社区重写**而非中文直译。
5. 8 条 AI 味是否逐条扫过（尤其 em dash、三连排比、空洞升华）。

## 怎么知道它在生效

- SKILL.md frontmatter：`type: flow`（判断流程，不跑脚本）。
- main-dev README 已登记一行。
- 下次改 `docs/promotion/posts.md` 时，产出与范本语气一致、无新增 AI 味。
