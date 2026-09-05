# 3D 视觉增强（茶席质感 + 空间纵深）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为「一盏茶」冲泡页 3D 夜色暖光茶席增加茶席质感（木桌纹理 / 茶席布褶皱 / 陶壶表面凹凸）与空间纵深（后方虚化茶柜与挂轴 / 地面暖光反射），贴近用户选定的「夜色暖光·炭火煮茶」氛围图。

**Architecture:** 全部使用程序化 `CanvasTexture`（零外部素材、不新增依赖）：木纹、布褶高度图、陶土颗粒、挂轴、暖光斑均在运行时由 Canvas 2D 绘制成 `THREE.CanvasTexture`，绑定到现有场景材质（`map` / `bumpMap` / 透明平面）。新增背景元素：后方茶柜、挂轴、炭炉下方地面暖光斑。

**Tech Stack:** Vue3 + TresJS 5.8.3 + Three.js r185（`CanvasTexture` / `MeshStandardMaterial` bumpMap / `MeshBasicMaterial` 透明光斑）

**Spec:** `3D_SPEC.md`（夜色暖光·炭火煮茶基调）+ 用户选定增强方向（茶席质感 + 空间纵深，2026-09-05）

## Global Constraints

- **TresJS 5 坑**：Tres 元素 `rotation` 只读属性，一律传 `[x,y,z]` 数组字面量；`position`/`scale` 用 `THREE.Vector3` 实例。
- **零外部素材**：所有纹理程序化生成（Canvas → CanvasTexture），不新增 npm 依赖、不引用外部图片 URL。
- **最小改动**：只动 `src/components/three/TeaBrewSceneInner.vue` 内部视觉，不碰 BrewView 状态机 / 手势 / 音频 / 评分逻辑。
- **CI 不受影响**：headless（CI/E2E）不挂载 3D，本次视觉增强不涉及 CI 变更。
- **性能**：纹理 128~512px，仅生成一次；不引入逐帧大开销（动画仍由 `useLoop` 驱动）。

---

## 执行状态（2026-09-05，全部完成）

- **Task 1（程序化纹理）** ✅：5 个纹理函数已实现（woodTex/fabricBump/potBump/scrollTex/warmGlowTex）。
- **Task 2（茶席质感）** ✅：木桌 `:map="woodTex"`（#4a3626）、茶席布 `:bump-map="fabricBump" :bump-scale="0.06"`、陶壶 5 处 `:bump-map="potBump" :bump-scale="0.05"`。
- **Task 3（空间纵深）** ✅ **方案调整**：原计划「3D 茶柜/挂轴/暖光斑」改为「实景背景图」——新增 `src/assets/tearoom-bg.jpg`（image_gen 生成、贴合夜色暖光·炭火煮茶基调，含木格栅/油灯/挂轴/炭火暖光）作为 `scene.background`，并**移除 3D 墙面**（被不透明墙面盖住导致背景不可见）。背景图本身即提供茶柜/挂轴/暖光纵深，效果更直接。
- **Task 4（force3d 截图通道）** ✅ **方案调整**：截图脚本 `scripts/screenshot-brew3d.cjs` 改用「非 headless UA + `navigator.webdriver=false`」绕过 headless 检测（不新增 query 参数），真实浏览器视角捕获 3D 背景。
- **Task 5（验证收尾）** ✅：`npm run type-check` 通过；E2E 5/5 通过（29.9s）；headed 截图验证背景茶室氛围正常显示（heating/steeping）。
- **关键坑**：`scene.background` 直接赋值不显示 → 根因是**不透明 3D 墙盖住背景**；移除墙 + `onRender` 每帧强制设置背景解决。SwiftShader（headless 软渲染）下背景纹理不上传属环境限制，真实浏览器 / headed 正常；CI 的 E2E 走 headless 回退 CSS 插画，不受影响。

---

### Task 1: 程序化纹理工具函数

**Files:**
- Modify: `src/components/three/TeaBrewSceneInner.vue`（在 `makeSoftCircleTexture` 函数后新增纹理生成函数）

**Interfaces:**
- Consumes: 无（纯函数，使用 `document.createElement('canvas')` + `THREE.CanvasTexture`）
- Produces: `woodTex: THREE.CanvasTexture`、`fabricBump: THREE.CanvasTexture`、`potBump: THREE.CanvasTexture`、`scrollTex: THREE.CanvasTexture`、`warmGlowTex: THREE.CanvasTexture`（供 Task 2/3 使用）

- [ ] **Step 1: 新增木纹纹理**

```ts
function makeWoodTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  // 底色：深胡桃木
  ctx.fillStyle = '#4a3626'
  ctx.fillRect(0, 0, size, size)
  // 木纹年轮条纹（水平）
  let y = 0
  while (y < size) {
    const l = 24 + Math.random() * 60
    const g = ctx.createLinearGradient(0, y, 0, y + l)
    g.addColorStop(0, 'rgba(255,235,200,0.10)')
    g.addColorStop(0.5, 'rgba(255,235,200,0.20)')
    g.addColorStop(1, 'rgba(40,26,16,0.25)')
    ctx.fillStyle = g
    ctx.fillRect(0, y, size, l)
    y += l + Math.random() * 26
  }
  // 纵向细丝 + 噪点
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 60},${28 + Math.random() * 30},${14 + Math.random() * 20},${0.04 + Math.random() * 0.08})`
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 6 + Math.random() * 26)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 1)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
```

- [ ] **Step 2: 新增茶席布褶皱高度图（bumpMap）**

```ts
function makeFabricBumpTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)
  // 随机皱纹（深浅灰模拟高度）
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const len = 20 + Math.random() * 80
    const v = 90 + Math.random() * 90
    ctx.strokeStyle = `rgba(${v},${v},${v},0.5)`
    ctx.lineWidth = 1.5 + Math.random() * 3
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * len, y + (Math.random() - 0.5) * len * 0.4, x + (Math.random() - 0.5) * len, y + (Math.random() - 0.5) * len * 0.4)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}
```

- [ ] **Step 3: 新增陶土颗粒凹凸（bumpMap）**

```ts
function makePotBumpTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 1600; i++) {
    const v = 110 + Math.random() * 110
    ctx.fillStyle = `rgba(${v},${v},${v},0.25)`
    ctx.beginPath()
    ctx.arc(Math.random() * size, Math.random() * size, 0.6 + Math.random() * 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}
```

- [ ] **Step 4: 新增挂轴纹理（绢布底 + 竖排「一盏茶」+ 轴杆）**

```ts
function makeScrollTexture(): THREE.CanvasTexture {
  const w = 256
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  // 绢布底
  const g = ctx.createLinearGradient(0, 0, w, 0)
  g.addColorStop(0, '#d8cdb2')
  g.addColorStop(0.5, '#efe6cf')
  g.addColorStop(1, '#d3c7a8')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // 绢纹噪点
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${160 + Math.random() * 60},${150 + Math.random() * 50},${120 + Math.random() * 40},${0.05})`
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1)
  }
  // 上下轴杆
  ctx.fillStyle = '#4a2f1a'
  ctx.fillRect(8, 0, w - 16, 18)
  ctx.fillRect(8, h - 18, w - 16, 18)
  // 竖排题字「一盏茶」
  ctx.fillStyle = '#2e2418'
  ctx.font = 'bold 64px "KaiTi","STKaiti","SimSun",serif'
  ctx.textAlign = 'center'
  ctx.fillText('一盏茶', w / 2, 150)
  ctx.font = '28px "KaiTi","STKaiti","SimSun",serif'
  ctx.fillStyle = '#4a3a28'
  ctx.fillText('· 茶 室 ·', w / 2, 230)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
```

- [ ] **Step 5: 新增炭火暖光斑（地面反射光）**

```ts
function makeWarmGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,150,70,0.55)')
  g.addColorStop(0.4, 'rgba(255,110,40,0.22)')
  g.addColorStop(1, 'rgba(255,90,30,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}
```

- [ ] **Step 6: 生成并导出纹理常量**

在 `softCircleTex` 之后新增：

```ts
const woodTex = makeWoodTexture()
const fabricBump = makeFabricBumpTexture()
const potBump = makePotBumpTexture()
const scrollTex = makeScrollTexture()
const warmGlowTex = makeWarmGlowTexture()
```

- [ ] **Step 7: 验证**

Run: `npm run type-check`
Expected: PASS（无类型错误）

- [ ] **Step 8: Commit**

```bash
git add src/components/three/TeaBrewSceneInner.vue
git commit -m "feat: 3D 程序化纹理工具（木纹/布褶/陶土凹凸/挂轴/暖光斑）"
```

---

### Task 2: 茶席质感应用

**Files:**
- Modify: `src/components/three/TeaBrewSceneInner.vue`（模板材质绑定）

**Interfaces:**
- Consumes: `woodTex`、`fabricBump`、`potBump`（Task 1 产出）
- Produces: 桌面/茶席布/陶壶的质感材质

- [ ] **Step 1: 木桌应用木纹**

```html
<TresMesh :position="tablePos">
  <TresBoxGeometry :args="[4.4, 0.16, 2.2]" />
  <TresMeshStandardMaterial :color="'#4a3626'" :map="woodTex" :roughness="0.65" :metalness="0.02" />
</TresMesh>
```

- [ ] **Step 2: 茶席布应用褶皱**

```html
<TresMesh :position="clothPos" :rotation="[-Math.PI / 2, 0, 0]">
  <TresPlaneGeometry :args="[3, 1.3]" />
  <TresMeshStandardMaterial :color="'#cbb68a'" :roughness="0.9" :bump-map="fabricBump" :bump-scale="0.06" :side="THREE.DoubleSide" />
</TresMesh>
```

- [ ] **Step 3: 陶壶应用表面凹凸（壶身/壶盖/壶钮/壶嘴/壶把）**

仅对陶壶（茶色 `#8a6b48`）材质加 `:bump-map="potBump" :bump-scale="0.05"`（白瓷盖碗保持光洁）。

- [ ] **Step 4: 验证**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/three/TeaBrewSceneInner.vue
git commit -m "feat: 3D 茶席质感（木桌纹理/布褶/陶壶凹凸）"
```

---

### Task 3: 空间纵深元素

**Files:**
- Modify: `src/components/three/TeaBrewSceneInner.vue`（模板新增背景元素）

**Interfaces:**
- Consumes: `scrollTex`、`warmGlowTex`（Task 1 产出）
- Produces: 后方茶柜、挂轴、炭炉暖光斑

- [ ] **Step 1: 新增坐标常量**

```ts
const cabinetPos = new THREE.Vector3(-3.2, 1.55, -2.2)   // 后方茶柜
const shelfPos = new THREE.Vector3(0, 1.75, -2.15)       // 柜内格栅
const scrollPos = new THREE.Vector3(2.4, 2.6, -2.35)     // 挂轴
const glowPos = new THREE.Vector3(-1.15, 0.012, 0)       // 炭炉正下方地面光斑
```

- [ ] **Step 2: 新增后方茶柜（柜体 + 格栅 + 内部暗色）**

```html
<!-- 后方茶柜：暖光背景的深色木柜 -->
<TresGroup :position="cabinetPos">
  <TresMesh>
    <TresBoxGeometry :args="[2.6, 2.6, 0.7]" />
    <TresMeshStandardMaterial :color="'#2c2116'" :roughness="0.85" :metalness="0.05" />
  </TresMesh>
  <TresMesh :position="shelfPos">
    <TresBoxGeometry :args="[2.1, 0.08, 0.1]" />
    <TresMeshStandardMaterial :color="'#3a2b1c'" :roughness="0.8" />
  </TresMesh>
</TresGroup>
```

- [ ] **Step 3: 新增挂轴（墙右侧）**

```html
<TresMesh :position="scrollPos" :rotation="[0, 0, 0]">
  <TresPlaneGeometry :args="[1.1, 2.2]" />
  <TresMeshBasicMaterial :map="scrollTex" :tone-mapped="false" :side="THREE.DoubleSide" />
</TresMesh>
```

- [ ] **Step 4: 新增炭炉暖光斑（地面反射光）**

```html
<TresMesh :position="glowPos" :rotation="[-Math.PI / 2, 0, 0]">
  <TresPlaneGeometry :args="[2.6, 2.6]" />
  <TresMeshBasicMaterial :map="warmGlowTex" :transparent="true" :depth-write="false" :blending="THREE.AdditiveBlending" />
</TresMesh>
```

- [ ] **Step 5: 空间纵深微调（镜头/墙面色相贴合暖光氛围）**

将墙面 `#241a12` 微调为 `#2a1f14`、地面 `#1a140f` 微调为 `#1e1710`，略暖略亮以承接暖光反射。

- [ ] **Step 6: 验证**

Run: `npm run type-check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/components/three/TeaBrewSceneInner.vue
git commit -m "feat: 3D 空间纵深（茶柜/挂轴/炭火暖光斑）"
```

---

### Task 4: force3d 截图通道 + 视觉验证

**Files:**
- Modify: `src/views/BrewView.vue`（isHeadless 增加 `?force3d=1` 强制通道）
- Modify: `scripts/screenshot-brew3d.cjs`（URL 带 `?force3d=1`）

**Interfaces:**
- Consumes: 无
- Produces: 新的 HEATING/STEEPING 截图

- [ ] **Step 1: BrewView 增加 force3d 调试参数**

将 `isHeadless` 改为：

```ts
// headless（CI/E2E 无 GPU）下默认不挂载 3D，回退 CSS 插画；`?force3d=1` 可强制挂载（截图/调试用）
const isHeadless = computed(
  () => typeof navigator !== 'undefined' && (navigator.webdriver === true || /HeadlessChrome/i.test(navigator.userAgent)) && new URLSearchParams(location.search).get('force3d') !== '1',
)
```

- [ ] **Step 2: screenshot 脚本 brew 页带 force3d**

在截图脚本 `await page.waitForURL('**/brew')` 后追加 `await page.goto(base + '/brew?force3d=1')`（或选茶前对 brew 路由拼接参数；具体按脚本现状处理，确保进入 brew 时 URL 带 `force3d=1`）。

- [ ] **Step 3: 起 dev + 截图验证**

```bash
npm run dev -- --port 5174   # tea-testing 侧（5173 被主仓库 dev 占用）
node scripts/screenshot-brew3d.cjs   # 需 preview:4173 + root base build；或临时改用 dev URL
```

预期：HEATING 截图显示木纹桌面、布褶、陶壶颗粒、后方茶柜与挂轴、炭炉暖光斑；STEEPING 显示水流注入。

- [ ] **Step 4: 目视检查**（Read 截图，确认质感/纵深合理、无穿模）

---

### Task 5: 验证与收尾

**Files:**
- 全量验证 + 交付

- [ ] **Step 1: 全量本地验证**

```bash
npm run type-check
# 清 4173/5173 残留后
$env:GITHUB_ACTIONS="true"; npm run test:e2e
```

Expected: type-check PASS；E2E 5 用例全过（headless 回退 CSS，不受 3D 影响）

- [ ] **Step 2: 提交剩余改动**

```bash
git add -A
git commit -m "chore: 3D 视觉增强截图与调试通道"
```

- [ ] **Step 3: push + PR + CI**

```bash
git push -u origin feature/3d-tea-visual
gh pr create --base main --head feature/3d-tea-visual --title "feat: 3D 视觉增强（茶席质感 + 空间纵深）" --body-file ...
```

Expected: CI 7 项全绿（E2E 1m 左右）

- [ ] **Step 4: merge + 主仓库同步**

```bash
gh pr merge --squash
cd C:/Users/yanha/Desktop/tea && git pull origin main
```

## Self-Review

1. **Spec coverage**：茶席质感（木纹/布褶/陶壶凹凸）→ Task 2；空间纵深（茶柜/挂轴/暖光反射）→ Task 3；验证 → Task 4/5。覆盖用户选定的两个方向。
2. **Placeholder scan**：无 TBD/TODO；纹理函数与材质绑定均为完整代码。
3. **Type consistency**：`woodTex`/`fabricBump`/`potBump`/`scrollTex`/`warmGlowTex` 在 Task 1 定义、Task 2/3 消费，命名一致；`THREE.SRGBColorSpace`、`THREE.AdditiveBlending` 均为 Three.js r185 现有 API。
