# 3D 数字茶空间 MVP 规格

> 目标：把 BrewView 的 CSS 插画视觉替换为 Three.js 3D 真实感茶席场景
> 分支：`feature/3d-tea-space`
> 状态：MVP 先行，效果确认后再细化

## 1. 目标与验收

- 冲泡页主视觉变为 3D 场景：深色茶室氛围 + 木桌 + 盖碗 + 茶壶 + 炉火 + 蒸汽粒子
- 茶汤颜色随 `soupColor` 实时变化（冲泡浸泡阶段渐浓）
- 蒸汽强度随温度/阶段变化；HEATING 有炉火（光 + 火焰动画）
- DONE 出汤时茶壶倾斜 + 茶汤色水流
- **状态机 / 手势 / 按钮 / 音频 / 进度条全部不动**
- type-check / build / E2E 不回归

## 2. 范围（做 / 不做）

### 做
- 程序化建模（零素材依赖）：茶室墙面与木桌、盖碗（含碗内茶汤液面）、茶壶（壶身/盖/嘴/把）、炉（火焰）
- 灯光：暖色环境光 + 主方向光 + 炉火点光源（随温度增强）
- 粒子：蒸汽（CanvasTexture 软圆点，壶口/碗口上飘，强度随温度）；火焰脉动
- 阶段联动：watch `phase` / `soupColor` / `currentTemp` 驱动视觉
- 出汤动画：茶壶倾斜 + 细柱水流（`isPouringOut` / DONE）
- 组件化：`src/components/three/TeaBrewScene3D.vue`，挂载于 BrewView 背景层

### 不做
- 不下载外部 3D 模型（离线环境不可靠，先用程序化几何体）
- 不做模型/材质的照片级 PBR（先用 MeshStandardMaterial + 灯光，后续可补贴图）
- 不改数据层 / 状态机 / 音频
- 不做移动端性能专项优化（MVP 用 WebGL1 兼容 + 适中粒子数）

## 3. 组件接口

```ts
defineProps<{
  phase: BrewPhase
  soupColor: string      // 当前茶汤色
  currentTemp: number
  targetTemp: number
  isPouringOut: boolean
  infusion: number
}>()
```

## 4. 验证

- `npm run type-check` / `npm run build`
- Playwright 截图看效果（完整冲泡流程）
- E2E 完整流程回归（按钮/手势不变，应通过）
