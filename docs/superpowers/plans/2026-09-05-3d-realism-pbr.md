# 3D 真实感基础包（PBR 阴影/IBL/物理材质 + 比例构图修正）Implementation Plan

> **For agentic workers:** 按 AGENTS.md §3.6 七步闭环执行；任务经用户 2026-09-05 批准（方案 A，含比例修正与构图微调）。

**Goal:** 消除冲泡页 3D 茶席的「塑料感/浮空感/比例失调」：开启软阴影与环境反射（IBL）、ACES 电影级色调映射、釉面/玻璃物理材质、修正盖碗合盖巨球与公道杯/品茗杯比例、拉远构图让整套茶席入镜、茶汤高光、柔光蒸汽与炉火辉光。

**Architecture:** 零新增 npm 依赖、零外部素材。IBL 用 three 内置 `RoomEnvironment` + `PMREMGenerator.fromScene` 程序化生成；阴影用单个主方向光 PCFSoft；材质升级为 `MeshPhysicalMaterial`（clearcoat/transmission）；全部改动限定在 3D 视觉层两个组件。

**Tech Stack:** Vue3 + TresJS 5.8.3 + Three.js r185（PMREMGenerator / RoomEnvironment / PCFSoftShadowMap / ACESFilmicToneMapping / MeshPhysicalMaterial）

**Spec:** `3D_SPEC.md` + 用户批准的方案 A（2026-09-05）

## Global Constraints

- **TresJS 5 坑**：rotation 一律传 `[x,y,z]` 数组字面量；position/scale 用 Vector3。
- **零新增依赖/零外部素材**：不 npm install、不引外部贴图/HDR/模型。
- **最小改动**：只动 `src/components/three/TeaBrewScene3D.vue` 与 `TeaBrewSceneInner.vue`（外加本计划文档与截图）；不碰 BrewView 状态机/手势/音频/评分、不碰 useBrewAnimation 时序契约。
- **headless 不受影响**：BrewView 在 headless 不挂载 3D（CSS 回退），transmission/阴影只在真实浏览器运行；E2E 不回归。
- **性能**：仅 1 盏投影方向光（PointLight 不投影，避免 6 pass）；shadow mapSize 2048；IBL 只生成一次后 dispose PMREMGenerator。
- **另一会话脏文件不碰**：backend/requirements.txt、backend/seeds/culture_seed.py、vite.config.ts、.codex/ 不 add 不提交。

## 现状证据（截图 + 源码）

| 缺口 | 证据 | 本计划处理 |
|---|---|---|
| 无阴影，茶具浮空 | renderer 未开 shadowMap，无 cast/receive | Task 1 |
| 无环境反射，白瓷像塑料/紫砂死黑/玻璃磨砂 | 无 scene.environment | Task 2 |
| 影调发灰 | 未开色调映射 | Task 1 |
| 环境光 0.55 过平 | AmbientLight 0.55 | Task 2 降到 0.22，IBL 补环境光 |
| 盖碗合盖变巨球、加热时盖子悬空 | 盖球 R1.0≈碗口、lid 行程 0.3 过大 | Task 4 |
| 公道杯偏小（世界半径 0.126 vs 盖碗 0.288） | fairnessScale 0.28 | Task 4 |
| 品茗杯偏小 | teacupScale 0.3 | Task 4 |
| 一套器具挤不下画面 | fov42 相机 z5.6 过近 | Task 4 |
| 玻璃是 opacity0.35 假透明 | Standard+transparent | Task 3 transmission |
| 白瓷无釉面高光 | Standard roughness0.35 | Task 3 clearcoat |
| 茶汤平圆柱无高光 | roughness0.2 | Task 3 降到 0.06+env |
| 蒸汽硬圆点、炉火无辉光 | size0.16 单点、无 glow | Task 5 |

---

### Task 1: 渲染管线 — 软阴影 + ACES 色调映射

**Files:** TeaBrewScene3D.vue（TresCanvas）、TeaBrewSceneInner.vue（灯光/投影配置）

- [ ] 1.1 TresCanvas 开 `:shadows="true"`；onMounted 经 useTresContext 取 renderer，设 `shadowMap.type = PCFSoftShadowMap`、`toneMapping = ACCESFilmicToneMapping`、`toneMappingExposure = 1.08`（命令式设置，规避 TresJS prop 名不确定性）。
- [ ] 1.2 主方向光 `cast-shadow`，用 ref 在 onMounted 命令式收紧阴影正交相机（near0.5/far18/左右上下 ±3、mapSize 2048、bias -0.0002、normalBias 0.02），target 置于 (0,1.2,0) 并加入 scene。
- [ ] 1.3 桌面/桌腿/茶席布/地面 receive-shadow；全部茶具 mesh cast-shadow；透明体（水流/蒸汽/火焰/光斑）不投影。
- [ ] 1.4 验证 type-check。

### Task 2: IBL 程序化环境反射 + 灯光重平衡

**Files:** TeaBrewSceneInner.vue

- [ ] 2.1 `import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'`；onMounted 用 `PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture` 设 `scene.environment`，`scene.environmentIntensity = 0.55`，随后 `pmrem.dispose()`。
- [ ] 2.2 AmbientLight 0.55→0.22；主光 1.3→1.6（暖 #fff0dd）；rim 0.5 保持；炉火光 PointLight 不投影，intensity 上限 2.2→3.0。
- [ ] 2.3 各材质 envMapIntensity：紫砂 0.55、木桌 0.35、布 0.2。
- [ ] 2.4 验证 type-check + headed 截图：白瓷/玻璃出现环境反光，紫砂不再死黑。

### Task 3: 物理材质（釉面 / 真玻璃 / 茶汤高光 / 黑釉）

**Files:** TeaBrewSceneInner.vue

- [ ] 3.1 盖碗碗身+碗盖：`TresMeshPhysicalMaterial` clearcoat 0.9 / clearcoatRoughness 0.18 / roughness 0.24 / envMapIntensity 0.9（保留青花瓷 map，颜色 #f5f1e8 供异步贴图 watch 匹配）。
- [ ] 3.2 公道杯身/嘴/把：Physical，transmission 0.95 / thickness 0.25 / ior 1.45 / roughness 0.06 / envMapIntensity 1.2，**移除 transparent+opacity0.35**，DoubleSide 保留。
- [ ] 3.3 品茗杯黑釉：Physical clearcoat 0.7 / clearcoatRoughness 0.3 / roughness 0.16 / envMapIntensity 1.0。
- [ ] 3.4 三处茶汤（盖碗/公道杯/品茗杯）：roughness 0.2→0.06、envMapIntensity 0.7，保留颜色联动与透明。
- [ ] 3.5 验证截图：瓷有釉光、玻璃透折射、茶汤面有高光斑。

### Task 4: 比例/衔接/构图修正

**Files:** TeaBrewSceneInner.vue

- [ ] 4.1 碗盖：球 R 1.0→0.82、thetaLength PI/3→PI/2.4（更扁的盖形）；lidPosition 行程改 `0.92 - 0.18*steep`（开盖只抬一点，合盖盖沿与碗口齐平）。
- [ ] 4.2 公道杯 scale 0.28→0.40、位置 (0.55,1.19,0.25)→(0.68,1.19,0.22)；品茗杯 scale 0.3→0.37、位置微调为 (1.2,1.19,0.55)/(1.5,1.19,0.05)/(1.2,1.19,-0.42)；壶/炉 x -1.15→-1.25（水流中点由 computed 自动跟随）。
- [ ] 4.3 相机 camPos (0,2.4,5.6)→(0,2.35,6.7)，lookAt (0,1.35,0)→(0,1.3,0)，fov 42→40；截图迭代到「壶+盖碗+公道杯+三杯同框、UI 不遮主体」。
- [ ] 4.4 验证截图：合盖不再是巨球、整套茶席比例协调、同框。

### Task 5: 蒸汽柔光 + 炉火辉光（sprite，不引入后处理）

**Files:** TeaBrewSceneInner.vue

- [ ] 5.1 蒸汽 PointsMaterial size 0.16→0.22、opacity 上限不变；粒子起始 x 偏向器具区（-0.2..0.6）。
- [ ] 5.2 炉火中心加 additive Sprite（warmGlowTex，scale 1.1），onRender 随 flameTargetIntensity 脉动透明度/缩放；桌面炉下加暖光斑平面（修正 glowPos 到桌面 y1.192）。
- [ ] 5.3 火焰加内层焰心（#ffd28a 小 Cone ×5，scale0.6，更快脉动）。
- [ ] 5.4 验证截图：炉火有辉光溢出、蒸汽更柔。

### Task 6: 全量验证与收尾

- [ ] 6.1 `npm run type-check` / `npm run build` / `npm run test`（37 用例不回归）。
- [ ] 6.2 dev :5174 + `node scripts/screenshot-brew3d.cjs` 截 heating/steeping/done 三阶段，Read 截图逐项核对 Task 1-5 效果，必要时迭代参数。
- [ ] 6.3 `$env:GITHUB_ACTIONS="true"; npm run test:e2e`（5/5，headless CSS 回退不受影响）。
- [ ] 6.4 分 commit 提交（仅本任务文件）；**push/PR 前向用户请示**。

## Self-Review

1. **Spec coverage**：批准的 A 档 7 项 → Task 1（阴影/影调）、Task 2（IBL/灯光）、Task 3（材质层级）、Task 4（比例构图）、Task 5（液面以外的蒸汽/炉火 + 液面在 3.4），全覆盖。
2. **约束扫描**：无新依赖（RoomEnvironment 属 three 自带 addons）；不改状态机/动画时序；headless 路径不变；只 1 盏投影光符合阴影性能预算。
3. **风险点**：transmission 在 SwiftShader 下不可用——但 headless 不挂载 3D，无影响；ACES 会压暗背景贴图，用 exposure 1.08 + 截图校准。
