---
last_updated: 2026-10-08
status: active
owner: yanha
---

# PLAN — 求职亮点物：一盏茶作品集展示页（2026-10-08）

> 级别：Guided（MEDIUM 风险，纯新增文档资产）
> 依据：`docs/prd/REQ-job-showcase-requirements-2026-10-08.md`（已 confirmed）
> 输入事实：tea 仓库实测（2026-10-08）+ work/career-os 三方向 JD 语料分析 + career_profile 事实库（fact-007/008）

## Goal

产出一个单文件交互式 HTML 作品集页 `docs/portfolio/tea-showcase.html` + STAR 文档 `docs/portfolio/tea-project-star.md`。面试官/HR 打开即懂「一盏茶」是什么、讲得出技术深度、数字能扛追问。口径：亮点讲满 + 状态如实（开发中/部署完善中）。

## Context

- 需求文档已 confirmed：三方向为主（Java 后端/软件测试/AI 产品）+ 软件交付经理附版；视觉沿用 tea 设计语言。
- 数据边界：数字全部来自 tea 仓库实测（338 commits/142 源文件/23,563 行/CI 13 job/13 ADR/98 技能/Vitest 142/E2E 34/pytest 51）与 career-os JD 语料；无来源数字不写。
- work 母版 228 commits 为 2026-09-27 快照，亮点物用实测 338；差异在 PLAN 标注，不擅自改 work 文件。

## Risk Assessment

```
risk:
  score: 4   # Impact 1 + Scope 1 + Uncertainty 2 + Irreversibility 0
  level: MEDIUM
  evidence:
    - reason: 纯新增 docs/portfolio/ 两个文件，不改产品代码与治理体系
      affected_area: docs/
      possible_failure: 无（回滚=删除目录）
    - reason: 数据均已核实，仅 HTML 实现细节与视觉达标存在少量不确定性
      affected_area: 展示物本身
      possible_failure: 视觉不过设计审计 → 按 DESIGN_SPEC 令牌修正
```

## Approach

单文件 HTML，自包含、零外链依赖（F-007）。图表全部手写内联 SVG（柱/环/雷达），不引 ECharts CDN。字体用系统字体栈（`Noto Serif SC/Songti SC` 衬线标题 + sans 正文），偏离 DESIGN_SPEC「自托管字体」——单文件无法内联字体且须断网可用，此为展示物特例，已记入 Trade-offs。

### 页面结构（7 区，长滚动 + 粘性导航）

1. **Hero**：产品名 + 一句话定位 + 状态徽章（开发中 · CI 全绿 · 338 commits · 独立开源）
2. **业务闭环**：入席→选茶→备器→煮水→冲泡→品鉴→成长 横向流程（SVG 连线）
3. **量化仪表盘**：数字卡片 + 微型 SVG（源文件 142/行数 23,563/测试 227 用例/CI 13 job/ADR 13/commit 338）
4. **技术架构**：五层架构图（前端/3D/数据/后端/AI/部署）+ 每层选型依据（ADR 出处）
5. **工程治理**：CI job 清单、ADR 主题时间线、测试体系、98 技能库/docs 78 篇
6. **STAR 讲述**：S/T/A/R 四段 + 「能扛追问」折叠预案（每个数字带来源）
7. **目标岗对照**：三方向 Tab（Java 后端/软件测试/AI 产品）能力→证据映射 + 软件交付经理附版

### 视觉方向（Design Read 简版）

- 类型：求职作品集单页；受众：三方向面试官/HR。
- vibe：东方茶室气质 + 工程严谨。宣纸白底 + 墨色正文 + 茶汤金唯一强调 + 朱砂印章（状态/成就）+ 竹青/黛青语义点缀。
- 字体角色：衬线标题（古籍感）+ 黑体正文（清晰）。
- 动效：克制——淡入 + 轻微上移，滚动数字，无 bounce/弹性。
- 禁：紫渐变/暖米白陶土/纯黑灰/eyebrow/玻璃拟态/渐变文字/Emoji 图标。

## Tasks

| Task | Input | Action | Output | Validation |
|---|---|---|---|---|
| T0 目录+STAR 文档 | fact-007 + 实测清单 | 建 `docs/portfolio/`；写 `tea-project-star.md`（S/T/A/R + 追问预案 + 来源标注） | STAR Markdown | 数字回源核对（338/23,563/142/227/13/13） |
| T1 HTML 骨架+导航 | 视觉令牌 | 单文件骨架：内联 CSS 令牌变量 + 粘性导航 + Hero | tea-showcase.html | 无外链引用；令牌值无裸色 |
| T2 业务闭环+架构 | README/CONTEXT | SVG 闭环流程 + 五层架构图（含选型依据） | 同上 | 术语与 CONTEXT 一致 |
| T3 仪表盘+工程治理 | 实测清单 | SVG 图表 + CI/ADR/测试体系区 | 同上 | 数字与需求文档附件一致 |
| T4 STAR+目标岗对照 | fact-007 + JD 报告 | STAR 讲述区 + 三方向 Tab + 交付经理附版 | 同上 | 能力→证据每条有来源 |
| T5 响应式+动效 | DESIGN_SPEC | 移动端断点、克制动效、对比度 | 同上 | 移动端可读；≥4.5:1 |
| T6 验证交付 | 产物 | 大小/外链/目视/移动端检查 + present_files | 交付 | F-007 全过 |

## Trade-offs

1. 图表：手写 SVG（零依赖、轻、可控）vs ECharts 内联（重、>2MB 风险）→ SVG。
2. 字体：系统字体栈（断网可用）vs 内联字体（>2MB）→ 系统字体栈；标注展示物特例。
3. commit 数：338（实测 2026-10-08）vs 228（母版快照 2026-09-27）→ 亮点物用 338；交付时提醒用户同步母版。

## Rollback Strategy

删除 `docs/portfolio/` 目录即完全回滚；不动产品代码、不动 work 文件。

## Open Questions

- 无阻塞项（D-001~007 已拍板）。可选后续：HTML 部署到 GitHub Pages（用户提出再做）。

## Not Doing

- 不改 tea 产品任何代码；不动 work/career-os 简历母版。
- 不做求职系统（投递表/题库/模拟面试）；不做 PPT；不发布部署。
