---
name: ux-gap-analysis-2026-10-12
description: UX 差距分析报告——五主页面逐条勘察（对照 DESIGN_SPEC 与设计门禁），修复见 PR #61。
status: deprecated
owner: yanha
date: 2026-10-12
last_updated: 2026-10-13
---

# UX 差距分析 — 2026-10-12

> 触发：用户反馈「前端效果感觉不是很好」。
> 方法：dev server（:5173）实际浏览 Home / Growth / History / AI 茶灵 / Select 五个主页面（桌面 1440×900 + 移动 390×844），对照 DESIGN_SPEC.md（色令牌 / 五态 / 触控 ≥44px / 正文与占位 ≥4.5:1）与 AGENTS.md §6 设计门禁逐条勘察。
> 实证截图：`artifacts/before/{home,growth,history,ai,select}-{desktop,mobile}.png`（本会话 agent workspace）。

## 差距清单

| # | 位置（文件/组件） | 现状（实测） | 建议 | 改动量 | 是否踩设计禁令 |
|---|---|---|---|---|---|
| 1 | `src/views/home/HomeHero.vue` `.enter-link`（首屏次级 CTA「入席·完整泡茶体验」） | `color: rgba(245,241,230,0.55)` 无 text-shadow，叠在明亮茶山照片上对比度约 1.5:1，几乎不可见（home-desktop.png y≈440） | 不透明度提至 0.82 + 加 `text-shadow: 0 1px 8px rgba(0,0,0,.55)`，hover 转茶汤金 `rgba(201,169,110,.95)` | S | 否（纯透明度/投影调整，未引入新色） |
| 2 | `src/views/AIAsk.vue` `.ai-sub`（「你的私人茶道师傅」副题） | `rgba(245,241,230,0.5)` 叠深绿底 ≈4.0:1，临界偏低 | 提至 0.75 | S | 否 |
| 3 | `src/views/AIAsk.vue` `.ai-empty-text`（「有什么关于茶的问题想问？」） | `rgba(245,241,230,0.6)` ≈5.2:1，临界 | 提至 0.82 | S | 否 |
| 4 | `src/views/AIAsk.vue` `.ai-input::placeholder` | `rgba(232,213,176,0.35)` ≈2.5:1，**低于 DESIGN_SPEC 占位 ≥4.5:1 底线** | 提至 0.55 | S | 否 |
| 5 | `src/views/AIAsk.vue` `.ai-suggestion-btn`（问题建议胶囊） | padding 0.5rem/1rem，实测高约 37px < 触控底线 44px | 加 `min-height: 2.75rem` | S | 否 |
| 6 | `src/views/AIAsk.vue` `.ai-close`（右上关闭钮） | 2.4rem ≈38px <44px，且 `color: rgba(...,0.6)` 对比临界 | `min-width/min-height: 2.75rem`，color 提至 0.75 | S | 否 |
| 7 | `src/views/GrowthView.vue` 加载态（`!loaded && !loadError`） | 裸灰字「正在展开账册…」无加载指示；`BaseSpinner` 组件全项目零引用（闲置） | 换 `BaseSpinner size="lg"` 居中 | S | 否（复用既有令牌组件） |
| 8 | `src/views/GrowthView.vue` / `HistoryView.vue` 空态区 | EmptyState 紧贴页头，桌面下方约 500px 空白，视觉重心偏上（growth-desktop.png） | 空/载/错三态容器 `min-h-[55vh] flex items-center justify-center` | S | 否 |
| 9 | `src/components/ui/ErrorState.vue`（闲置） | 自带 `bg-red-50 text-red-600`，Tailwind 默认色，**违反 DESIGN_SPEC 禁默认色板**；GrowthView 用的是自定义内联错误块 | 记录为技术债：后续改造 ErrorState 用朱砂令牌 `#A33B2E` 后再推广；本次不采纳（避免扩散默认色） | M（记录） | 组件本身踩禁令（预存，本次不改） |
| 10 | `src/components/ui/BaseButton.vue`（闲置） | 五态齐全但全项目零引用，各页按钮均为内联 class | 记录：逐页替换内联按钮属 L2 范围，本次不做 | M（记录） | 否 |
| 11 | `src/views/SelectView.vue` `.empty-hint/.loading-hint` | `rgba(245,241,230,0.45)` ≈4.1:1 临界；加载态无 spinner | 后续将 alpha 提至 0.6 + 接 BaseSpinner；本次不做（控制改动面） | S（记录） | 否 |
| 12 | `src/views/SelectView.vue` `.confirm-btn` disabled 态 | `rgba(245,241,230,0.1)` 底 + 0.35 字，沉灰禁用态表达清晰 | 不改（五态之 disabled 已合格） | — | — |
| 13 | GrowthView / HistoryView 头部按钮 | `min-h-11` / `min-w-11`（44px）达标 | 不改 | — | — |

## 本次落地项（3 项，均 L1 UI 层、可逆、用户可见）

1. **首屏次级入口对比度**（HomeHero.vue `.enter-link`）——对应差距 #1。
2. **AI 茶灵暗色页可读性 + 触控**（AIAsk.vue 批量）——对应差距 #2–#6。
3. **成长看板加载/空态体验**（GrowthView.vue：BaseSpinner + 空态垂直居中）——对应差距 #7、#8。

## 不做的事（范围边界）

- 不碰 `src/services/teaAI.ts`（承重墙降级链原样保留）；DashScope 欠费导致的 AI 失败属预期，不处理。
- 不碰 `src/components/three/` 状态机。
- 不改 ErrorState / BaseButton / SelectView 加载态（记录为后续技术债，见差距 #9–#11）。
- 不做架构级替换（内联按钮 → BaseButton），那是 L2。
