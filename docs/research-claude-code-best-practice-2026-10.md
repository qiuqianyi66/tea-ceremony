---
last_updated: 2026-10-16
status: active
owner: yanha
---

# claude-code-best-practice 精读与一盏茶增量对照（2026-10-16）

> 来源：[shanraisshan/claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice)（67k★，v2.1.300，2026-10-16 全库 30+ 文件通读）。本文只记对 tea 治理的**增量价值**，已覆盖内容不重复。配套通用模板见 `claude-code-template/`（独立于本仓库，git-ignored）。

## 1. 一句话结论

该仓库最值钱的是三套模式：**Command→Agent→Skill 三层编排、完整工程结构规范（memory/rules/settings 加载层级）、防 AI 退化治理机制**。对 tea 的增量是三条方法论，运行时特性全部不吸收。

## 2. 吸收的增量（三条方法论）

| # | 方法论 | 原文来源 | tea 落地 |
|---|---|---|---|
| 1 | **最轻机制优先**：同任务多机制可选时先直接答 → 再技能 → 再委派；能用轻的不用重的 | 选择矩阵 Skill→Agent→Command | 已写入 AGENTS.md §2（任务机制从最轻开始） |
| 2 | **行为禁令式措辞**：规则写成"禁止 X"确定性语句，靠 harness 层 enforce，不靠模型自觉 | Why-Harness 报告 | 与 tea 现有禁令风格一致，维持不漂移 |
| 3 | **上下文污染是第一嫌疑**：质量下滑先查会话长度/夹带内容，非怀疑模型变笨（实测日常波动 ±8-14%，"变笨"多为上下文污染+偶发基建 bug） | LLM 逐日退化报告 | 已由用户偏好层覆盖（长会话主动提示开新会话），不重复写入 |

## 3. 可借鉴机制 vs tea 现状对照

| 原仓库机制 | tea 对应物 | 差距/结论 |
|---|---|---|
| 每日自动 drift 巡检（官方文档 ↔ 本地 best-practice 双向核对） | `verify-harness.cjs` + `audit-wiki-drift.cjs`（已挂 CI） | **已有，同构**，无缺口 |
| changelog 分层（`changelog/<category>/` 带日期+版本） | docs/ADR + CHANGELOG.md | 已有，tea 粒度更粗但够用 |
| best-practice 与 implementation 分目录（理论 vs 落地） | docs 分层（reference/plans/architecture） | 已有 |
| 一个文件一个 commit | §10 Git 规范 | 已有 |
| deny 权限不可覆盖兜底 | .harness 红线机械化（audit-redlines） | 理念同构，tea 用脚本 enforce |

**结论：治理机制层面 tea 无缺口，不新增机制**——原仓库的"活得好"源于它自己的治理，tea 已有等价物。

## 4. 明确不吸收（Not Doing）

- `.claude/` 文件体系（CLAUDE.md/rules/agents/commands/settings）——豆包无运行时，吸收即死文件。
- 94 命令 / 25 官方技能 / 33 hooks 事件全表——参考用，不常驻。仅用户点名配 Claude Code 项目时按需调出。
- MCP 服务器选型（playwright/context7/deepwiki）——豆包工具链已覆盖等价能力。
- 官方新特性（/goal、/loop、Agent Teams、cross-session messaging、worktrees）——运行时绑定，理念（目标驱动/定时巡检/钩子拦截/配置 AI 化）用豆包侧任务清单+定时任务近似。

## 5. 后续完善建议（tea 自行决定）

- 模板 `claude-code-template/` 已按"复制→改占位符→调权限"三步就绪，评审 0 阻断，可复用于任意项目配 Claude Code。
- tea 侧如需继续学习：按季度对照原仓库 `best-practice/` 字段速查（Claude Code 月发 27 版，字段演进快）。
- 若 tea 未来接入豆包之外的 agent 运行时，本模板作为现成配置基线。
