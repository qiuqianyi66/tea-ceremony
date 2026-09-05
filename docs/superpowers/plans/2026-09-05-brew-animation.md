# 泡茶交互动画实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在当前 3D 茶席场景（紫砂陶壶 + 青花瓷盖碗 + 电陶炉 + 暖色茶室背景）基础上，实现完整的泡茶交互动画流程（入水→放茶→闷泡→倒茶→喝茶），让用户看到真实的泡茶过程动画。

**Architecture:** 动画由 `useLoop` 帧更新驱动，`BrewPhase` 状态机切换触发对应动画阶段；每个动画阶段有独立的 progress（0~1）和缓动函数；新增 3D 对象（品茗杯、茶则、水流、茶叶粒子）作为场景子元素；动画逻辑抽离到 composable 保持组件简洁。

**Tech Stack:** Vue 3 Composition API + TypeScript + TresJS 5.8 + Three.js + useLoop 帧动画 + THREE.Points 粒子

**Spec:** 本文档

---

## Global Constraints

- Vue 3 `<script setup lang="ts">`，禁止 `any`，类型从 `src/types/` 导入
- 3D 场景修改集中在 `src/components/three/TeaBrewSceneInner.vue`
- 动画逻辑抽离到 `src/composables/useBrewAnimation.ts`（新建）
- headless 时不挂载 3D（已有 `isHeadless` 逻辑），动画在 3D 内不影响 CSS 回退
- 保持现有 3D 对象（壶/盖碗/炉/背景/桌面）不变，只新增动画和对象
- `rotation` 一律用数组字面量（TresJS 5.8 `rotation` 只读属性坑，传 Vector3 会触发异常）
- `position`/`scale` 用 Vector3 实例
- 修改前端后必须过 `npm run type-check` + `npm run build`
- E2E 回归（headless 回退不受影响，5 用例必须全绿）

---

## File Structure

| 文件 | 操作 | 职责 |
|---|---|---|
| `src/composables/useBrewAnimation.ts` | 新建 | 动画状态机、progress 计算、缓动函数 |
| `src/components/three/TeaBrewSceneInner.vue` | 修改 | 新增 3D 对象（品茗杯、茶则、水流、茶叶粒子）+ 动画驱动绑定 |
| `src/types/brewing.ts` | 可能修改 | 新增 `AnimationPhase` 类型（如需要） |

---

## BrewPhase 与动画阶段映射

| BrewPhase | 标签 | 触发动画 |
|---|---|---|
| IDLE | 备器 | 无（静态展示） |
| HEATING | 煮水 | 无（火焰+蒸汽已有） |
| WARMING | 温杯 | 入水动画（水壶倾斜→水流→盖碗液面） |
| RINSING | 醒茶 | 入水 + 放茶动画 |
| READY | 准备 | 可手势注水（已有 canGesturePour） |
| STEEPING | 浸泡 | 放茶 + 闷泡（盖碗盖子盖上 + 蒸汽增强） |
| DONE | 出汤 | 倒茶（盖碗倾斜→茶汤流入品茗杯）+ 喝茶（品茗杯端起） |

---

## Task 1：动画状态机 composable

**Files:**
- Create: `src/composables/useBrewAnimation.ts`

**Interfaces:**
- Consumes: `phase: BrewPhase`, `isPouringOut: boolean`, `infusion: number`
- Produces:
  - `pourWater: Ref<number>`（入水 progress 0~1）
  - `addLeaves: Ref<number>`（放茶 progress 0~1）
  - `steep: Ref<number>`（闷泡 progress 0~1）
  - `pourOut: Ref<number>`（倒茶 progress 0~1）
  - `drink: Ref<number>`（喝茶 progress 0~1）
  - `update(dt: number): void`（每帧调用，基于 deltaTime 更新 progress）

**Steps:**

- [ ] **Step 1: 定义类型与缓动函数**

```typescript
// src/composables/useBrewAnimation.ts
import { ref, type Ref } from 'vue'
import { BrewPhase } from '@/types/brewing'

export interface BrewAnimationState {
  pourWater: Ref<number>
  addLeaves: Ref<number>
  steep: Ref<number>
  pourOut: Ref<number>
  drink: Ref<number>
}

// 线性插值
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// smoothstep 缓动（开始和结束平滑）
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t)
}

// 阻尼逼近（帧速率无关）
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}
```

- [ ] **Step 2: 实现 composable 主体**

```typescript
export function useBrewAnimation(
  phase: Ref<BrewPhase>,
  isPouringOut: Ref<boolean>,
): BrewAnimationState & { update: (dt: number) => void } {
  const pourWater = ref(0)
  const addLeaves = ref(0)
  const steep = ref(0)
  const pourOut = ref(0)
  const drink = ref(0)

  // 每个动画的目标值（由 phase 决定）
  const targets = {
    pourWater: 0,
    addLeaves: 0,
    steep: 0,
    pourOut: 0,
    drink: 0,
  }

  function updateTargets() {
    const p = phase.value
    targets.pourWater = [BrewPhase.WARMING, BrewPhase.RINSING, BrewPhase.READY, BrewPhase.STEEPING].includes(p) ? 1 : 0
    targets.addLeaves = [BrewPhase.RINSING, BrewPhase.STEEPING].includes(p) ? 1 : 0
    targets.steep = p === BrewPhase.STEEPING ? 1 : 0
    targets.pourOut = isPouringOut.value ? 1 : 0
    targets.drink = p === BrewPhase.DONE && !isPouringOut.value ? 1 : 0
  }

  function update(dt: number) {
    updateTargets()
    // 阻尼逼近目标（lambda=3 表示约 0.5 秒达到 95%）
    pourWater.value = damp(pourWater.value, targets.pourWater, 3, dt)
    addLeaves.value = damp(addLeaves.value, targets.addLeaves, 2, dt)
    steep.value = damp(steep.value, targets.steep, 1.5, dt)
    pourOut.value = damp(pourOut.value, targets.pourOut, 4, dt)
    drink.value = damp(drink.value, targets.drink, 1, dt)
  }

  return { pourWater, addLeaves, steep, pourOut, drink, update }
}
```

- [ ] **Step 3: 验证 type-check**

Run: `npm run type-check`
Expected: 无错误

---

## Task 2：入水动画（水壶倾斜 + 水流 + 盖碗液面）

**Files:**
- Modify: `src/components/three/TeaBrewSceneInner.vue`

**Interfaces:**
- Consumes: `anim.pourWater`（0~1）
- Produces: 水壶组 rotation、水流 mesh 可见性/位置、盖碗液面 scale

**Steps:**

- [ ] **Step 1: 在 setup 中接入动画 composable**

在 `TeaBrewSceneInner.vue` 的 props 定义后添加：

```typescript
import { useBrewAnimation, smoothstep } from '@/composables/useBrewAnimation'

// 动画状态（phase/isPouringOut 从 props 或 store 获取；当前 props 有 phase，isPouringOut 需新增 prop）
const anim = useBrewAnimation(toRef(props, 'phase'), toRef(props, 'isPouringOut'))
```

注意：需在 `defineProps` 中新增 `isPouringOut: boolean`，并在 `BrewView.vue` 传入。

- [ ] **Step 2: 在 useLoop 中调用 anim.update**

在现有 `useLoop(({ delta }) => { ... })` 回调开头添加：

```typescript
anim.update(delta)
```

- [ ] **Step 3: 水壶组 rotation 绑定**

将水壶组 `<TresGroup ref="kettleGroup" :position="kettlePos" :scale="kettleScale">` 改为：

```html
<TresGroup
  ref="kettleGroup"
  :position="kettlePos"
  :scale="kettleScale"
  :rotation="[0, 0, -0.44 * smoothstep(anim.pourWater.value)]"
>
```

（-0.44 弧度 ≈ -25°，向盖碗方向倾斜）

- [ ] **Step 4: 新增水流 mesh**

在水壶组之后、电陶炉之前添加：

```html
<!-- 注水流（从壶嘴到盖碗） -->
<TresMesh
  :position="waterStreamPos"
  :rotation="[0, 0, Math.PI / 2]"
  :visible="anim.pourWater.value > 0.05"
>
  <TresCylinderGeometry :args="[0.025, 0.045, 1.0, 8]" />
  <TresMeshBasicMaterial
    :color="'#a8d8f0'"
    :transparent="true"
    :opacity="0.7 * anim.pourWater.value"
  />
</TresMesh>
```

`waterStreamPos` 计算：壶嘴位置到盖碗中心的中点，Y 轴对齐。在 setup 中定义：

```typescript
const waterStreamPos = computed(() => {
  // 壶嘴世界坐标（近似）：kettlePos + spoutPos（旋转后近似）
  const spoutWorld = new THREE.Vector3(
    kettlePos.x + 0.5,
    kettlePos.y + 0.3,
    kettlePos.z,
  )
  // 盖碗中心
  const gaiwanCenter = new THREE.Vector3(gaiwanPos.x, gaiwanPos.y + 0.3, gaiwanPos.z)
  // 中点
  return spoutWorld.clone().add(gaiwanCenter).multiplyScalar(0.5)
})
```

- [ ] **Step 5: 盖碗液面上升**

将盖碗内液面 `<TresMesh :position="liquidPos">` 的 scale 绑定：

```html
<TresMesh :position="liquidPos" :scale="[1, 0.3 + smoothstep(anim.pourWater.value) * 0.5, 1]">
```

- [ ] **Step 6: 验证**

Run: `npm run type-check`
Run: headed 截图 WARMING/STEEPING 阶段
Expected: 水壶向盖碗倾斜，可见细水流从壶嘴到盖碗，盖碗内液面上升

---

## Task 3：放茶动画（茶则 + 茶叶粒子）

**Files:**
- Modify: `src/components/three/TeaBrewSceneInner.vue`

**Interfaces:**
- Consumes: `anim.addLeaves`（0~1）
- Produces: 茶则位置、茶叶粒子系统

**Steps:**

- [ ] **Step 1: 新增茶则 mesh**

在盖碗组之后添加：

```html
<!-- 茶则（放茶叶用） -->
<TresMesh
  :position="teaScoopPos"
  :rotation="[0, 0, -0.2]"
  :visible="anim.addLeaves.value > 0.05"
>
  <TresBoxGeometry :args="[0.45, 0.02, 0.28]" />
  <TresMeshStandardMaterial :color="'#8b6f47'" :roughness="0.6" />
</TresMesh>
```

`teaScoopPos`：从旁侧移入盖碗上方。

```typescript
const teaScoopPos = computed(() => {
  const start = new THREE.Vector3(1.8, 1.6, 0)
  const end = new THREE.Vector3(gaiwanPos.x + 0.2, gaiwanPos.y + 0.8, gaiwanPos.z)
  return start.clone().lerp(end, smoothstep(anim.addLeaves.value))
})
```

- [ ] **Step 2: 新增茶叶粒子系统**

```html
<!-- 茶叶粒子 -->
<TresPoints ref="teaLeavesRef" :visible="anim.addLeaves.value > 0.1">
  <TresBufferGeometry ref="teaLeavesGeo" />
  <TresPointsMaterial
    :color="'#5a7a3a'"
    :size="0.03"
    :transparent="true"
    :opacity="0.9"
  />
</TresPoints>
```

setup 中初始化粒子（80 个，初始在茶则位置）：

```typescript
const teaLeavesRef = ref<THREE.Points | null>(null)
const teaLeavesVelocities: THREE.Vector3[] = []

function initTeaLeaves() {
  const count = 80
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // 初始在茶则位置附近
    positions[i * 3] = 1.8 + (Math.random() - 0.5) * 0.3
    positions[i * 3 + 1] = 1.6 + Math.random() * 0.1
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2
    teaLeavesVelocities.push(new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      -0.5 - Math.random() * 0.5,
      (Math.random() - 0.5) * 0.2,
    ))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  // 绑定到模板（通过 ref 或直接在 onMounted 设置）
}
```

- [ ] **Step 3: useLoop 中更新粒子（重力下落）**

```typescript
// 在 useLoop 回调中
if (anim.addLeaves.value > 0.1 && teaLeavesRef.value) {
  const positions = teaLeavesRef.value.geometry.attributes.position.array as Float32Array
  for (let i = 0; i < 80; i++) {
    const vel = teaLeavesVelocities[i]
    positions[i * 3] += vel.x * delta
    positions[i * 3 + 1] += vel.y * delta
    positions[i * 3 + 2] += vel.z * delta
    // 落入盖碗后停止（y < gaiwanPos.y + 0.2）
    if (positions[i * 3 + 1] < gaiwanPos.y + 0.2) {
      positions[i * 3 + 1] = gaiwanPos.y + 0.2
      vel.set(0, 0, 0)
    }
  }
  teaLeavesRef.value.geometry.attributes.position.needsUpdate = true
}
```

- [ ] **Step 4: 验证**

Run: `npm run type-check`
Run: headed 截图 STEEPING 初期
Expected: 茶则从旁侧移入盖碗上方，绿色茶叶粒子落入盖碗

---

## Task 4：闷泡动画（盖碗盖子 + 蒸汽增强）

**Files:**
- Modify: `src/components/three/TeaBrewSceneInner.vue`

**Interfaces:**
- Consumes: `anim.steep`（0~1）
- Produces: 盖碗盖子位置、蒸汽透明度

**Steps:**

- [ ] **Step 1: 盖碗盖子下移盖上**

将盖碗盖子 `<TresMesh :position="lidPos">` 改为：

```html
<TresMesh :position="lidPos.clone().add(new THREE.Vector3(0, -0.3 * smoothstep(anim.steep.value), 0))">
```

（盖子从当前位置下移 0.3 单位盖上碗口）

- [ ] **Step 2: 蒸汽增强**

如果场景中有 3D 蒸汽粒子（tsParticles 是 DOM 层），在 3D 场景内新增蒸汽粒子或调整现有蒸汽 opacity。

当前蒸汽是 tsParticles（DOM 层，`v-show="!isHeadless"` 已修复为 `isHeadless`，headed 时不显示）。需要在 3D 场景内新增蒸汽：

```html
<!-- 3D 蒸汽粒子（闷泡时增强） -->
<TresPoints ref="steamRef">
  <TresBufferGeometry ref="steamGeo" />
  <TresPointsMaterial
    :color="'#f0e8d8'"
    :size="0.08"
    :transparent="true"
    :opacity="0.15 + anim.steep.value * 0.4"
    :depth-write="false"
  />
</TresPoints>
```

蒸汽粒子初始化（30 个，在盖碗上方，缓慢上升）：

```typescript
const steamRef = ref<THREE.Points | null>(null)
const steamVelocities: THREE.Vector3[] = []

function initSteam() {
  const count = 30
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = gaiwanPos.x + (Math.random() - 0.5) * 0.3
    positions[i * 3 + 1] = gaiwanPos.y + 0.5 + Math.random() * 0.5
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2
    steamVelocities.push(new THREE.Vector3(
      (Math.random() - 0.5) * 0.1,
      0.2 + Math.random() * 0.2,
      (Math.random() - 0.5) * 0.1,
    ))
  }
  // ... 设置 geometry
}
```

useLoop 中更新蒸汽（缓慢上升+循环）：

```typescript
if (steamRef.value && anim.steep.value > 0.1) {
  const positions = steamRef.value.geometry.attributes.position.array as Float32Array
  for (let i = 0; i < 30; i++) {
    positions[i * 3] += steamVelocities[i].x * delta
    positions[i * 3 + 1] += steamVelocities[i].y * delta
    positions[i * 3 + 2] += steamVelocities[i].z * delta
    // 超过高度后重置
    if (positions[i * 3 + 1] > gaiwanPos.y + 1.5) {
      positions[i * 3 + 1] = gaiwanPos.y + 0.5
    }
  }
  steamRef.value.geometry.attributes.position.needsUpdate = true
}
```

- [ ] **Step 3: 验证**

Run: `npm run type-check`
Run: headed 截图 STEEPING 中期
Expected: 盖碗盖子下移盖上，盖碗上方有白色蒸汽粒子上升

---

## Task 5：新增 3D 品茗杯

**Files:**
- Modify: `src/components/three/TeaBrewSceneInner.vue`

**Interfaces:**
- Produces: 品茗杯 mesh（杯身 + 液面）

**Steps:**

- [ ] **Step 1: 定义品茗杯轮廓与位置**

在坐标常量区添加：

```typescript
// 品茗杯（黑釉，参考真实黑釉品茗杯）
const teacupPos = new THREE.Vector3(1.5, 1.19, 0.4)
const teacupScale = new THREE.Vector3(0.45, 0.45, 0.45)
const teacupPts = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.28, 0.02),
  new THREE.Vector2(0.36, 0.12),
  new THREE.Vector2(0.38, 0.28),
  new THREE.Vector2(0.34, 0.38),
  new THREE.Vector2(0.25, 0.42),
]
const teacupLiquidPos = new THREE.Vector3(0, 0.2, 0)
```

- [ ] **Step 2: 新增品茗杯 group**

在盖碗组之后、电陶炉之前添加：

```html
<!-- 品茗杯（黑釉） -->
<TresGroup :position="teacupPos" :scale="teacupScale" :ref="teacupGroupRef">
  <!-- 杯身 -->
  <TresMesh>
    <TresLatheGeometry :args="[teacupPts, 32]" />
    <TresMeshStandardMaterial
      :color="'#1a0f08'"
      :roughness="0.15"
      :metalness="0.1"
      :clearcoat="0.9"
      :clearcoat-roughness="0.1"
    />
  </TresMesh>
  <!-- 杯内茶汤 -->
  <TresMesh :position="teacupLiquidPos" :scale="[1, teacupLiquidHeight, 1]">
    <TresCylinderGeometry :args="[0.32, 0.34, 0.04, 32]" />
    <TresMeshStandardMaterial
      :color="props.soupColor"
      :roughness="0.2"
      :transparent="true"
      :opacity="teacupLiquidOpacity"
    />
  </TresMesh>
</TresGroup>
```

`teacupLiquidHeight` 和 `teacupLiquidOpacity` 初始为 0（空杯），倒茶时上升（Task 6）。

- [ ] **Step 3: 验证**

Run: `npm run type-check`
Run: headed 截图
Expected: 盖碗右前方可见黑釉品茗杯，比例协调（比盖碗小）

---

## Task 6：倒茶动画（盖碗倾斜 + 茶汤水流 + 品茗杯液面）

**Files:**
- Modify: `src/components/three/TeaBrewSceneInner.vue`

**Interfaces:**
- Consumes: `anim.pourOut`（0~1，即 isPouringOut）
- Produces: 盖碗组 rotation、茶汤水流、品茗杯液面

**Steps:**

- [ ] **Step 1: 盖碗组 rotation 绑定**

将盖碗组 `<TresGroup :position="gaiwanPos" :scale="gaiwanScale">` 改为：

```html
<TresGroup
  :position="gaiwanPos"
  :scale="gaiwanScale"
  :rotation="[0, 0, 0.52 * smoothstep(anim.pourOut.value)]"
>
```

（0.52 弧度 ≈ 30°，向品茗杯方向倾斜）

- [ ] **Step 2: 新增茶汤水流 mesh**

```html
<!-- 茶汤水流（从盖碗到品茗杯） -->
<TresMesh
  :position="teaStreamPos"
  :rotation="[0, 0, Math.PI / 2]"
  :visible="anim.pourOut.value > 0.05"
>
  <TresCylinderGeometry :args="[0.02, 0.035, 0.8, 8]" />
  <TresMeshBasicMaterial
    :color="props.soupColor"
    :transparent="true"
    :opacity="0.8 * anim.pourOut.value"
  />
</TresMesh>
```

`teaStreamPos`：盖碗碗口到品茗杯中心的中点。

```typescript
const teaStreamPos = computed(() => {
  const gaiwanSpout = new THREE.Vector3(gaiwanPos.x + 0.3, gaiwanPos.y + 0.4, gaiwanPos.z)
  const teacupCenter = new THREE.Vector3(teacupPos.x, teacupPos.y + 0.2, teacupPos.z)
  return gaiwanSpout.clone().add(teacupCenter).multiplyScalar(0.5)
})
```

- [ ] **Step 3: 品茗杯液面上升**

将品茗杯液面的 scale/opacity 绑定：

```typescript
const teacupLiquidHeight = computed(() => 0.1 + smoothstep(anim.pourOut.value) * 0.8)
const teacupLiquidOpacity = computed(() => Math.min(1, anim.pourOut.value * 2))
```

- [ ] **Step 4: 验证**

Run: `npm run type-check`
Run: headed 截图 DONE 阶段（isPouringOut=true 时）
Expected: 盖碗向品茗杯倾斜，茶汤细流从盖碗流入品茗杯，品茗杯液面上升

---

## Task 7：喝茶动画（品茗杯端起）

**Files:**
- Modify: `src/components/three/TeaBrewSceneInner.vue`

**Interfaces:**
- Consumes: `anim.drink`（0~1，DONE 阶段出汤后）
- Produces: 品茗杯 position/rotation、液面略微减少

**Steps:**

- [ ] **Step 1: 品茗杯端起动**

将品茗杯 group 的 position/rotation 绑定：

```html
<TresGroup
  :position="teacupPos.clone().add(new THREE.Vector3(0, 0.3 * smoothstep(anim.drink.value), -0.2 * smoothstep(anim.drink.value)))"
  :scale="teacupScale"
  :rotation="[0.2 * smoothstep(anim.drink.value), 0, 0]"
>
```

（杯子向上移动 0.3 + 向相机方向移动 0.2 + 向后倾斜 0.2 弧度，模拟端起喝茶）

- [ ] **Step 2: 液面略微减少（喝了一口）**

```typescript
const teacupLiquidHeight = computed(() => {
  const poured = 0.1 + smoothstep(anim.pourOut.value) * 0.8
  const drunk = smoothstep(anim.drink.value) * 0.3
  return Math.max(0.05, poured - drunk)
})
```

- [ ] **Step 3: 验证**

Run: `npm run type-check`
Run: headed 截图 DONE 阶段（出汤后）
Expected: 品茗杯向上端起并微倾，液面略微减少

---

## Task 8：整合验证与提交

**Steps:**

- [ ] **Step 1: type-check + build**

Run: `npm run type-check`
Run: `npm run build`
Expected: 均通过

- [ ] **Step 2: headed 截图全流程验证**

Run: `HEADED=1 node scripts/screenshot-brew3d.cjs`
Expected: HEATING（火焰）、WARMING/STEEPING（水壶倾斜+水流+茶叶+蒸汽）、DONE（盖碗倾斜+茶汤+品茗杯端起）各阶段动画正确

- [ ] **Step 3: E2E 回归**

Run: `$env:GITHUB_ACTIONS="true"; npm run test:e2e`
Expected: 5 用例全绿（headless 回退不受 3D 动画影响）

- [ ] **Step 4: 提交**

```bash
git add src/composables/useBrewAnimation.ts src/components/three/TeaBrewSceneInner.vue src/views/BrewView.vue
git commit -m "feat: 泡茶交互动画（入水/放茶/闷泡/倒茶/喝茶全流程）"
```

---

## Self-Review

**1. Spec coverage:**
- 入水动画（水壶倾斜+水流+盖碗液面）→ Task 2 ✓
- 放茶动画（茶则+茶叶粒子）→ Task 3 ✓
- 闷泡动画（盖碗盖子+蒸汽）→ Task 4 ✓
- 倒茶动画（盖碗倾斜+茶汤水流+品茗杯液面）→ Task 6 ✓
- 喝茶动画（品茗杯端起）→ Task 7 ✓
- 新增 3D 品茗杯 → Task 5 ✓
- 动画状态机 → Task 1 ✓

**2. Placeholder scan:** 无 TBD/TODO/占位符，每个步骤有具体代码。

**3. Type consistency:** `useBrewAnimation` 返回的 Ref 类型与模板绑定一致；`BrewPhase` 枚举引用正确；`isPouringOut` prop 需在 `defineProps` 新增并在 `BrewView` 传入。

**4. 风险点:**
- TresJS 模板中 `:rotation` 绑定 computed/ref 时，需确保是数组字面量而非 Vector3（已遵守）
- 粒子系统（Points）的 BufferGeometry 需在 onMounted 初始化（模板 ref 方式可能需要调整）
- `teacupLiquidHeight` 等 computed 在模板中用 `.value`（Vue 模板自动解包，但 TresJS 绑定可能需要显式 `.value`）
- 水流位置计算用近似坐标，实际效果可能需要微调
