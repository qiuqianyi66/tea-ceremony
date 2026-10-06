---
name: design-taste
description: 前端设计质量——taste-skill Vue 化：Design Read + 三拨盘 8/6/4 + 62 项 Pre-Flight 逐项全检 + anti-slop 红线。tea 专属 19（设计门禁核心 #13）。
---

# Design Taste

## 触发
- 任何前端 UI 改动/新页面；设计门禁强制 6 步。

## 工作流
1. **Design Read（强制先行）**：页面类型/受众/vibe/倾向体系 + 三拨盘（DESIGN_VARIANCE 8 / MOTION_INTENSITY 6 / VISUAL_DENSITY 4），未输出禁止写码。
2. **视觉方向**：一句话 + 4-6 色令牌 + 字体角色。
3. **对照简报评审** → 实现（禁模板手感）。
4. **critique**：层级/清晰/情感。
5. **audit（红线 #13）**：Pre-Flight **62 项逐项勾选，不可抽检**（taste-skill §14 移植 Vue 化；任一项不可诚实勾选即不算完成，重点：hero 适配/CTA 对比度/eyebrow 计数/动效动机/真实图片）+ 设计审计 9 条。
6. 未过审计不得提交。

## anti-slop 红线（taste 移植，Vue 化）
- 禁 Inter 默认 / AI 紫渐变 / 三等分卡片 / em-dash / Jane Doe / 玻璃拟态装饰 / emoji 图标。
- 禁 `h-screen`（用 min-h-[100dvh]）；禁手绘 SVG 图标；图标一个库一个家族。

## 自检
- [ ] Design Read 先于代码
- [ ] 三拨盘明确（非默认值）
- [ ] Pre-Flight 关键项通过
- [ ] 无 AI 默认痕迹
