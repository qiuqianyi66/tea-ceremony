---
last_updated: 2026-10-07
status: active
owner: tea-harness
---

# docs/plans — 迭代计划层

> 285 Harness「docs/plans」（current-sprint / backlog）的 tea 对应物。放迭代计划与待办清单。
> 目录约定见 `.harness/rules/工程结构.md` §六。

## 放什么

| 文件 | 内容 | 示例 |
|---|---|---|
| `PLAN-<主题>-<YYYY-MM>.md` | 一次迭代/工程单的执行计划（现状/下一步/验证级别/依赖） | `PLAN-harness-research-2026-10.md` |
| `TODO-PRIORITY.md` | 全景待办优先级（P0/P1/P2） | 根级同名文件 |
| `environment-review.md` | 每周环境审查清单（30 分钟，285 固化） | 当前活跃 |
| 其他 | 冲刺计划、里程碑清单 | — |

## 规则

1. 每个计划文档头部带 frontmatter：`last_updated / status / owner`。
2. `status` 取值：`active`（进行中）/ `draft`（草拟）/ `deprecated`（已过期）。
3. 计划闭合后标记 `status: deprecated` 或在文档内标注结果，不删除（留档）。
4. 既有根级 `PLAN-harness-research-2026-10.md`、`TODO-PRIORITY.md` 保持原位；新计划类文档入本目录。
