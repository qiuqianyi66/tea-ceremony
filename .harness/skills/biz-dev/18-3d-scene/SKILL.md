---
name: 3d-scene
description: 3D 茶席场景——TresJS/Three 维护，只做视觉层不改状态机，资源按需加载 + KTX2。当改动茶席 3D 场景、资源加载或视觉参数时用。tea 专属 18。
type: executable
last-reviewed: 2026-10-29
verification: node scripts/verify-gardens.cjs && node scripts/verify-pavilion.cjs
---

# 3D Scene

## 触发
- 3D 场景维护（茶席/茶园/茶亭）；three/ 组件改动。

## 工作流
1. 视觉层约束：`src/components/three/` 只做视觉，状态机在 store（3D_SPEC.md）。
2. 禁直接创建 renderer（统一 TresJS）。
3. 资源：KTX2 压缩纹理；按需加载（禁首屏全量）；PWA 缓存 /3d/ 含 ktx2|wasm|js。
4. 验证：`node scripts/verify-gardens.cjs`（期望 ERRORS: []）+ `verify-pavilion.cjs`。
5. 性能：合批/实例化（大量茶树），LCP 预算内。

## 红线
- three/ 只做视觉层（#14）；禁直接创建 renderer（#14）。

## 自检
- [ ] 状态机未在 three/ 实现
- [ ] TresJS 统一 renderer
- [ ] 资源按需 + KTX2
- [ ] verify-gardens/pavilion 通过

## 确定性入口

- 茶园四园：`node scripts/verify-gardens.cjs`（期望 `ERRORS: []`）
- 茶亭：`node scripts/verify-pavilion.cjs`
- 古茶园地形/茶行/遮阴树：`node scripts/verify-field.cjs`
- 晴雨最终视觉（晴天全景 → 雨天全景）：`node scripts/verify-final.cjs`
- 氛围层（云影/晨雾/动物）：`node scripts/verify-garden-ambient.cjs`
- OrbitControls 状态与拖拽：`node scripts/verify-controls.cjs`
- 冲泡页 3D 截图（HEATING/STEEPING）：`node scripts/screenshot-brew3d.cjs`
- 纹理转 KTX2：`node scripts/convert-3d-ktx2.cjs`
- 拉取 PBR 纹理：`node scripts/dl-textures.cjs`
- 冲泡页探针（3D canvas / 报错 / 主线程卡死）：`node scripts/probe-brew.cjs`
