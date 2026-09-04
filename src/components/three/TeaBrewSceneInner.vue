<script setup lang="ts">
/**
 * TeaBrewSceneInner — TresCanvas 内部场景内容（必须在 TresCanvas 内使用 useLoop）。
 * 负责：夜色暖光环境 + 程序化茶具 + 蒸汽/炉火 + 阶段联动。
 *
 * 注意（TresJS 5 坑）：Tres 元素的 rotation 是只读属性，直接传 Vector3 实例会触发
 * "Cannot assign to read only property 'rotation'" 海量报错 → 必须传 [x,y,z] 数组字面量。
 */
import { ref, watch } from 'vue'
import { useLoop } from '@tresjs/core'
import * as THREE from 'three'
import { BrewPhase } from '@/types/brewing'

const props = defineProps<{
  phase: BrewPhase
  soupColor: string
  currentTemp: number
  targetTemp: number
  isPouringOut: boolean
  infusion: number
}>()

// ==================== 坐标常量（position/scale 用 Vector3 实例；rotation 一律用数组） ====================
const camPos = new THREE.Vector3(0, 2.4, 5.6)
const camLook = new THREE.Vector3(0, 1.35, 0)
const keyLightPos = new THREE.Vector3(3.2, 5.5, 4)
const rimLightPos = new THREE.Vector3(-3, 2, -2)
const wallPos = new THREE.Vector3(0, 3.4, -2.6)
const floorPos = new THREE.Vector3(0, -0.001, 1.5)
const tablePos = new THREE.Vector3(0, 1.1, 0)
const clothPos = new THREE.Vector3(0, 1.19, 0)
const legPositions: THREE.Vector3[] = [
  new THREE.Vector3(-2, 0.55, -0.9),
  new THREE.Vector3(2, 0.55, -0.9),
  new THREE.Vector3(-2, 0.55, 0.9),
  new THREE.Vector3(2, 0.55, 0.9),
]
const gaiwanPos = new THREE.Vector3(0.85, 1.32, 0)
const gaiwanScale = new THREE.Vector3(0.85, 0.85, 0.85)
const liquidPos = new THREE.Vector3(0, 0.68, 0)
const lidPos = new THREE.Vector3(0, 0.98, 0)
const kettlePos = new THREE.Vector3(-1.15, 1.28, 0)
const kettleScale = new THREE.Vector3(0.72, 0.72, 0.72)
const kettleLidPos = new THREE.Vector3(0, 1.62, 0)
const knobPos = new THREE.Vector3(0, 1.78, 0)
const spoutPos = new THREE.Vector3(1.35, 1.05, 0)
const handlePos = new THREE.Vector3(-1.35, 0.95, 0)
const stovePos = new THREE.Vector3(-1.15, 0.98, 0)
const stoveBasePos = new THREE.Vector3(0, 0.27, 0)
const flameLightPos = new THREE.Vector3(0, 0.9, 0)
const streamPos = new THREE.Vector3(0.1, 1.0, 0)

// 火焰片布局（位置 + 绕 Z 旋转；rotation 用数组字面量）
const flameSlots: { pos: THREE.Vector3; rot: [number, number, number] }[] = [
  { pos: new THREE.Vector3(-0.32, 0.6, 0.05), rot: [0, 0, -0.12] },
  { pos: new THREE.Vector3(-0.16, 0.6, -0.05), rot: [0, 0, 0.06] },
  { pos: new THREE.Vector3(0, 0.6, 0), rot: [0, 0, 0] },
  { pos: new THREE.Vector3(0.16, 0.6, -0.05), rot: [0, 0, -0.06] },
  { pos: new THREE.Vector3(0.32, 0.6, 0.05), rot: [0, 0, 0.12] },
]
const flameSeed: number[] = flameSlots.map(() => Math.random() * Math.PI * 2)

// ==================== Three 对象引用（模板绑定） ====================
const kettleGroup = ref<THREE.Group | null>(null)   // 茶壶组（出汤倾斜）
const flameLight = ref<THREE.PointLight | null>(null) // 炉火光源
const flameMeshes = ref<THREE.Mesh[]>([])           // 火焰片数组（v-for）
const teaLiquidMat = ref<THREE.MeshStandardMaterial | null>(null) // 碗内茶汤材质
const pourStreamMat = ref<THREE.MeshBasicMaterial | null>(null)   // 水流细柱材质
const pourStream = ref<THREE.Mesh | null>(null)      // 水流细柱
const steamMat = ref<THREE.PointsMaterial | null>(null) // 蒸汽材质

// 视觉平滑目标值（动画循环中 lerp）
let steamTargetOpacity = 0.1
let flameTargetIntensity = 0
let tiltTarget = 0 // 茶壶倾斜角（出汤）

// ==================== 程序化资源：软圆点纹理（蒸汽） ====================
function makeSoftCircleTexture(): THREE.CanvasTexture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}
const softCircleTex = makeSoftCircleTexture()

// ==================== 程序化资源：蒸汽粒子系统 ====================
const STEAM_COUNT = 60
const steamPositions = new Float32Array(STEAM_COUNT * 3)
const steamVel = new Float32Array(STEAM_COUNT)
const steamTop = new Float32Array(STEAM_COUNT)
for (let i = 0; i < STEAM_COUNT; i++) {
  steamPositions[i * 3] = (Math.random() - 0.5) * 0.5
  steamPositions[i * 3 + 1] = Math.random() * 1.2 + 2.4 // 起始在桌面附近
  steamPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5
  steamVel[i] = 0.4 + Math.random() * 0.5
  steamTop[i] = 3.4 + Math.random() * 1.6
}
const steamGeometry = new THREE.BufferGeometry()
steamGeometry.setAttribute('position', new THREE.BufferAttribute(steamPositions, 3))

// ==================== 程序化资源：Lathe 轮廓点 ====================
// 盖碗碗身
const bowlPts = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(0.9, 0.02),
  new THREE.Vector2(1.05, 0.12),
  new THREE.Vector2(1.2, 0.5),
  new THREE.Vector2(1.15, 0.95),
]
// 茶壶壶身
const potPts = [
  new THREE.Vector2(0, 0),
  new THREE.Vector2(1.05, 0.04),
  new THREE.Vector2(1.3, 0.2),
  new THREE.Vector2(1.45, 0.75),
  new THREE.Vector2(1.3, 1.35),
  new THREE.Vector2(1.05, 1.55),
  new THREE.Vector2(0.62, 1.62),
]

// ==================== 阶段/数据联动 ====================
function setSteamTarget(phase: BrewPhase, temp: number) {
  const target = props.targetTemp || 80
  switch (phase) {
    case BrewPhase.HEATING:
      steamTargetOpacity = temp > 60 ? 0.25 + (temp / Math.max(target, 1)) * 0.15 : 0.1
      flameTargetIntensity = Math.min(1, temp / Math.max(target, 1))
      break
    case BrewPhase.WARMING:
    case BrewPhase.RINSING:
    case BrewPhase.READY:
    case BrewPhase.STEEPING:
    case BrewPhase.DONE:
      steamTargetOpacity = 0.35
      flameTargetIntensity = 0
      break
    default:
      steamTargetOpacity = 0.1
      flameTargetIntensity = 0
  }
  tiltTarget = props.isPouringOut || phase === BrewPhase.DONE ? 0.55 : 0
}

watch(
  () => props.phase,
  (v) => {
    setSteamTarget(v, props.currentTemp)
    flameMeshes.value.forEach(m => (m.visible = v === BrewPhase.HEATING))
  },
  { immediate: true },
)

watch(
  () => props.soupColor,
  (c) => {
    teaLiquidMat.value?.color.set(c)
    pourStreamMat.value?.color.set(c)
  },
)

watch(
  () => props.currentTemp,
  (t) => setSteamTarget(props.phase, t),
)

watch(
  () => props.isPouringOut,
  (v) => {
    tiltTarget = v || props.phase === BrewPhase.DONE ? 0.55 : 0
  },
)

// ==================== 主渲染循环 ====================
const { onRender } = useLoop()
onRender(({ delta, elapsed }) => {
  // 蒸汽：平滑透明度 + 上飘循环
  if (steamMat.value) {
    steamMat.value.opacity += (steamTargetOpacity - steamMat.value.opacity) * Math.min(1, delta * 3)
    for (let i = 0; i < STEAM_COUNT; i++) {
      const vel = steamVel[i] ?? 0.4
      const top = steamTop[i] ?? 4.0
      let y = (steamPositions[i * 3 + 1] ?? 2.4) + vel * delta
      steamPositions[i * 3] = (steamPositions[i * 3] ?? 0) + Math.sin(elapsed * 0.8 + i) * delta * 0.08
      steamPositions[i * 3 + 2] = (steamPositions[i * 3 + 2] ?? 0) + Math.cos(elapsed * 0.6 + i) * delta * 0.08
      if (y > top) {
        y = 2.4
        steamPositions[i * 3] = (Math.random() - 0.5) * 0.5
        steamPositions[i * 3 + 2] = (Math.random() - 0.5) * 0.5
      }
      steamPositions[i * 3 + 1] = y
    }
    const posAttr = steamGeometry.getAttribute('position')
    if (posAttr) posAttr.needsUpdate = true
  }

  // 火焰：正弦脉动 + 炉火光强度
  flameMeshes.value.forEach((m, i) => {
    const pulse = 0.7 + 0.5 * Math.sin(elapsed * 9 + (flameSeed[i] ?? 0))
    m.scale.set(1, 0.6 + flameTargetIntensity * pulse, 1)
  })
  if (flameLight.value) flameLight.value.intensity = flameTargetIntensity * 2.2

  // 茶壶：出汤倾斜平滑 + 轻微呼吸
  if (kettleGroup.value) {
    const k = kettleGroup.value
    k.rotation.z += (tiltTarget - k.rotation.z) * Math.min(1, delta * 4)
    k.position.y = 1.28 + Math.sin(elapsed * 1.2) * 0.012
  }
  if (pourStream.value) pourStream.value.visible = tiltTarget > 0.3
})
</script>

<template>
  <!-- 相机 -->
  <TresPerspectiveCamera :position="camPos" :fov="42" :look-at="camLook" />

  <!-- 灯光：夜色暖光氛围 -->
  <TresAmbientLight :color="'#ffe8d0'" :intensity="0.55" />
  <TresDirectionalLight :position="keyLightPos" :color="'#fff0dd'" :intensity="1.3" />
  <TresDirectionalLight :position="rimLightPos" :color="'#8a7a66'" :intensity="0.5" />

  <!-- 茶室环境：墙面 + 地面 -->
  <TresMesh :position="wallPos">
    <TresPlaneGeometry :args="[12, 7]" />
    <TresMeshStandardMaterial :color="'#241a12'" :roughness="0.9" />
  </TresMesh>
  <TresMesh :position="floorPos" :rotation="[-Math.PI / 2, 0, 0]">
    <TresPlaneGeometry :args="[12, 8]" />
    <TresMeshStandardMaterial :color="'#1a140f'" :roughness="0.95" />
  </TresMesh>

  <!-- 木桌 + 茶席布 + 桌腿 -->
  <TresMesh :position="tablePos">
    <TresBoxGeometry :args="[4.4, 0.16, 2.2]" />
    <TresMeshStandardMaterial :color="'#5a442e'" :roughness="0.75" :metalness="0.02" />
  </TresMesh>
  <TresMesh :position="clothPos" :rotation="[-Math.PI / 2, 0, 0]">
    <TresPlaneGeometry :args="[3, 1.3]" />
    <TresMeshStandardMaterial :color="'#cbb68a'" :roughness="0.95" :side="THREE.DoubleSide" />
  </TresMesh>
  <TresMesh v-for="(leg, i) in legPositions" :key="i" :position="leg">
    <TresBoxGeometry :args="[0.14, 1.1, 0.14]" />
    <TresMeshStandardMaterial :color="'#3f3020'" :roughness="0.8" />
  </TresMesh>

  <!-- 盖碗（碗身 + 碗内茶汤 + 碗盖） -->
  <TresGroup :position="gaiwanPos" :scale="gaiwanScale">
    <TresMesh>
      <TresLatheGeometry :args="[bowlPts, 48]" />
      <TresMeshStandardMaterial :color="'#f5f1e8'" :roughness="0.35" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="liquidPos">
      <TresCylinderGeometry :args="[0.98, 1.02, 0.12, 48]" />
      <TresMeshStandardMaterial
        ref="teaLiquidMat"
        :color="props.soupColor"
        :roughness="0.2"
        :metalness="0.05"
        :transparent="true"
        :opacity="0.88"
      />
    </TresMesh>
    <TresMesh :position="lidPos">
      <TresSphereGeometry :args="[1.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3]" />
      <TresMeshStandardMaterial :color="'#f5f1e8'" :roughness="0.35" :metalness="0.05" />
    </TresMesh>
  </TresGroup>

  <!-- 茶壶（壶身 + 盖 + 壶钮 + 嘴 + 把） -->
  <TresGroup ref="kettleGroup" :position="kettlePos" :scale="kettleScale">
    <TresMesh>
      <TresLatheGeometry :args="[potPts, 48]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="kettleLidPos">
      <TresSphereGeometry :args="[0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="knobPos">
      <TresSphereGeometry :args="[0.16, 16, 12]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="spoutPos" :rotation="[0, 0, -Math.PI / 5]">
      <TresCylinderGeometry :args="[0.16, 0.3, 1.1, 16]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" />
    </TresMesh>
    <TresMesh :position="handlePos" :rotation="[0, 0, Math.PI / 2.3]">
      <TresTorusGeometry :args="[0.55, 0.13, 12, 24, Math.PI * 1.1]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" />
    </TresMesh>
  </TresGroup>

  <!-- 炉 + 火焰片 + 炉火光 -->
  <TresGroup :position="stovePos">
    <TresMesh :position="stoveBasePos">
      <TresCylinderGeometry :args="[1.1, 1.3, 0.55, 32]" />
      <TresMeshStandardMaterial :color="'#2a2622'" :roughness="0.7" :metalness="0.4" />
    </TresMesh>
    <TresMesh
      v-for="(slot, i) in flameSlots"
      :key="i"
      ref="flameMeshes"
      :position="slot.pos"
      :rotation="slot.rot"
      :visible="false"
    >
      <TresConeGeometry :args="[0.18, 0.7, 8]" />
      <TresMeshBasicMaterial
        :color="'#ff8833'"
        :transparent="true"
        :opacity="0.9"
        :blending="THREE.AdditiveBlending"
        :depth-write="false"
      />
    </TresMesh>
    <TresPointLight ref="flameLight" :position="flameLightPos" :color="'#ff7a2a'" :intensity="0" :distance="6" />
  </TresGroup>

  <!-- 水流细柱（出汤/注水时可见） -->
  <TresMesh ref="pourStream" :position="streamPos" :visible="false">
    <TresCylinderGeometry :args="[0.06, 0.09, 1.0, 10, 1, true]" />
    <TresMeshBasicMaterial
      ref="pourStreamMat"
      :color="props.soupColor"
      :transparent="true"
      :opacity="0.75"
      :depth-write="false"
    />
  </TresMesh>

  <!-- 蒸汽粒子 -->
  <TresPoints :geometry="steamGeometry">
    <TresPointsMaterial
      ref="steamMat"
      :size="0.16"
      :map="softCircleTex"
      :color="'#fff4e0'"
      :transparent="true"
      :opacity="0.15"
      :blending="THREE.AdditiveBlending"
      :depth-write="false"
      :size-attenuation="true"
    />
  </TresPoints>
</template>
