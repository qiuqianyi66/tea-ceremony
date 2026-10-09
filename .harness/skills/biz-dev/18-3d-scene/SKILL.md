---
name: 3d-scene
description: 3D 茶席场景——TresJS/Three 维护，只做视觉层不改状态机，资源按需加载 + KTX2。tea 专属 18。
type: executable
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
