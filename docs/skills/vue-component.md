---
last_updated: 2026-10-06
status: active
owner: yanha
---

# vue-component — 人读审查页

> 面向人的审查页。模型执行规则见 `.agents/skills/vue-component/SKILL.md`。

## 它管什么

一盏茶前端 Vue 3 组件的生成规范：组件类型、模板结构、Props/Emits、状态与副作用管理。

**定义性约束**：Vue 3 Composition API + `<script setup lang="ts">`，Props/Emits 必带类型，**禁止 Options API、禁止 `any`**。

## 何时该用 / 何时不该用

**该用**：新建页面 / 组件、修改 Vue 组件、重构组件结构。

**不该用**：纯样式微调（走设计/样式流程）、与 Vue 无关的逻辑。

## 审查要点（人过一遍时核对）

- [ ] `<script setup lang="ts">`，无 Options API、无 `any`
- [ ] Props / Emits 均带类型声明
- [ ] 组件 ≤ 200 行（超了应拆分）
- [ ] 业务状态走 Pinia（`src/stores/`），局部状态用 ref/reactive；样式用 Tailwind，无自定义 CSS 文件
- [ ] 副作用在 onMounted / onUnmounted 管理，无泄漏
- [ ] 触控目标 ≥ 44px；状态五态齐全（hover/disabled/loading/error/empty）
- [ ] 图标用 lucide 一族，无手绘 SVG 路径、无 emoji 当图标
- [ ] 通过设计审计（对比度、动效禁令、AI 紫渐变等禁令项）

## 怎么知道它在生效

- 组件过 `npm run type-check` + `npm run build`（AGENTS.md §11）
- 新页面在移动端触控审计（`scripts/audit-touch.cjs`）无告警
- UI 改动有改前/改后截图，差异可描述

## 对应文件

- `.agents/skills/vue-component/SKILL.md`
- 相关规范：AGENTS.md §6、`DESIGN_SPEC.md`
