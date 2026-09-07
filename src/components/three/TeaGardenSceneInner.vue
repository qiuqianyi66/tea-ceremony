<script setup lang="ts">
/**
 * TeaGardenSceneInner — 3D茶园场景内容（TresCanvas 内部）
 * 一期：HDRI环境 + 太阳光 + 雾 + 程序化梯田地形 + OrbitControls
 * 二期：程序化茶树渲染（按生长阶段变化形态，基于plant.id确定性分布）
 * 三期：点击/悬停交互（点击茶树高亮并通知父组件打开详情）
 *
 * TresJS 5 坑：rotation 必须传 [x,y,z] 数组，不能传 Vector3。
 */
import { computed, onMounted, ref } from 'vue'
import { useTresContext } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import type { PointerEvent as TresPointerEvent } from '@pmndrs/pointer-events'
import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { getGrowthStage } from '@/services/garden'
import type { PlantedTea } from '@/types/garden'

const props = defineProps<{
  plants: PlantedTea[]
}>()

const emit = defineEmits<{
  'select-plant': [id: number]
}>()

const sceneCtx = useTresContext()

// ============ 程序化噪声（Simplex-like，无需外部库） ============
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy), b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}
function fbm(x: number, y: number, octaves = 5): number {
  let value = 0, amplitude = 1, frequency = 1, max = 0
  for (let i = 0; i < octaves; i++) {
    value += smoothNoise(x * frequency, y * frequency) * amplitude
    max += amplitude
    amplitude *= 0.5
    frequency *= 2
  }
  return value / max
}

// ============ 地形生成 ============
const TERRAIN_SIZE = 200
const TERRAIN_SEGMENTS = 200
const TERRAIN_AMPLITUDE = 18
const TERRACE_START = 2
const TERRACE_END = 12
const TERRACE_STEP = 1.8

/** 采样地形高度（与createTerrainGeometry中的计算完全一致，供茶树定位用） */
function getTerrainHeight(x: number, z: number): number {
  let h = fbm(x * 0.015, z * 0.015, 5) * TERRAIN_AMPLITUDE
  h += fbm(x * 0.04, z * 0.04, 3) * 4
  h -= TERRAIN_AMPLITUDE * 0.4
  // 中央茶山隆起：让茶园区域位于场景中央的相机视野内（边缘渐消，保持整体山势）
  const r = Math.sqrt(x * x + z * z)
  const centralHill = Math.max(0, 1 - r / 55) * 10
  h += centralHill
  if (h > TERRACE_START && h < TERRACE_END) {
    const localH = h - TERRACE_START
    h = TERRACE_START + Math.floor(localH / TERRACE_STEP) * TERRACE_STEP
    h += (smoothNoise(x * 0.3, z * 0.3) - 0.5) * 0.3
  }
  return h
}

function createTerrainGeometry(): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position!
  const colors = new Float32Array(pos.count * 3)

  const grassColor = new THREE.Color(0x4a6b3a)
  const grassLight = new THREE.Color(0x5d7e45)
  const soilColor = new THREE.Color(0x6b5344)
  const rockColor = new THREE.Color(0x7a7570)
  const rockDark = new THREE.Color(0x5a5550)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = getTerrainHeight(x, z)
    pos.setY(i, h)

    const color = new THREE.Color()
    if (h < 1) {
      color.lerpColors(grassColor, grassLight, smoothNoise(x * 0.1, z * 0.1))
    } else if (h < TERRACE_END) {
      const terracePos = ((h - TERRACE_START) % TERRACE_STEP) / TERRACE_STEP
      if (terracePos < 0.15) {
        color.copy(soilColor)
      } else {
        color.lerpColors(grassColor, grassLight, smoothNoise(x * 0.15, z * 0.15))
      }
    } else if (h < 15) {
      color.lerpColors(soilColor, rockDark, (h - TERRACE_END) / 3)
    } else {
      color.lerpColors(rockDark, rockColor, smoothNoise(x * 0.2, z * 0.2))
    }

    const noise = (smoothNoise(x * 0.5, z * 0.5) - 0.5) * 0.08
    color.r = Math.max(0, Math.min(1, color.r + noise))
    color.g = Math.max(0, Math.min(1, color.g + noise))
    color.b = Math.max(0, Math.min(1, color.b + noise))

    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

const terrainGeo = createTerrainGeometry()

// ============ 茶树渲染（二期） ============

/** 基于种子的确定性伪随机 */
function seededRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** 生长阶段视觉配置 */
interface StageVisual {
  scale: number
  leafCount: number
  leafColor: string
  trunkHeight: number
  trunkRadius: number
  crownRadius: number
  hasGlow: boolean
}

const STAGE_VISUALS: Record<string, StageVisual> = {
  // 绝对尺寸（1 单位 ≈ 1 米）：低矮茶丛灌木，成熟约 1.6m 高
  sprout:   { scale: 1, leafCount: 2, leafColor: '#9ccc65', trunkHeight: 0.35, trunkRadius: 0.08, crownRadius: 0.3,  hasGlow: false },
  seedling: { scale: 1, leafCount: 3, leafColor: '#8bc34a', trunkHeight: 0.55, trunkRadius: 0.08, crownRadius: 0.45, hasGlow: false },
  growing:  { scale: 1, leafCount: 5, leafColor: '#7cb342', trunkHeight: 0.8,  trunkRadius: 0.08, crownRadius: 0.6,  hasGlow: false },
  mature:   { scale: 1, leafCount: 7, leafColor: '#689f38', trunkHeight: 1.05, trunkRadius: 0.08, crownRadius: 0.75, hasGlow: true },
  recovery: { scale: 1, leafCount: 5, leafColor: '#7cb342', trunkHeight: 0.9,  trunkRadius: 0.08, crownRadius: 0.65, hasGlow: false },
  dead:     { scale: 1, leafCount: 2, leafColor: '#6d4c41', trunkHeight: 0.85, trunkRadius: 0.08, crownRadius: 0.5,  hasGlow: false },
}

interface LeafInfo {
  position: [number, number, number]
  scale: number
}

interface PlantVisual {
  id: number
  position: [number, number, number]
  /** 稳定引用：Group rotation（避免模板内联数组导致 TresJS 响应式循环） */
  rotation: [number, number, number]
  /** 稳定引用：枝干位置 */
  trunkPos: [number, number, number]
  /** 稳定引用：发光新芽位置（无则 null） */
  glowPos: [number, number, number] | null
  /** 稳定引用：点击包围球位置 */
  hitPos: [number, number, number]
  /** 点击包围球半径 */
  hitRadius: number
  /** 稳定引用：点击拾取用 userData（避免每次渲染新对象） */
  hitUserData: { plantId: number }
  config: StageVisual
  leaves: LeafInfo[]
  rotationY: number
}

/** 检查候选点是否被地形挡住（从初始相机视角出发做步进采样） */
function isVisibleFromCamera(x: number, h: number, z: number): boolean {
  const camX = 30
  const camY = 23
  const camZ = 30
  const STEPS = 24
  for (let i = 1; i < STEPS; i++) {
    const t = i / STEPS
    const px = camX + (x - camX) * t
    const py = camY + (h - camY) * t
    const pz = camZ + (z - camZ) * t
    const th = getTerrainHeight(px, pz)
    if (th > py) return false // 地形高于视线，被遮挡
  }
  return true
}

/** 基于种子生成茶树在地形上的位置（中央茶园区，确保相机可见且不被山挡） */
function getPlantPosition(seed: number): [number, number, number] {
  const MIN_H = 2
  const MAX_H = 10
  let best: [number, number, number] | null = null
  let bestScore = Infinity
  // 多次尝试：命中梯田高度且相机可见立即返回；否则记录最接近目标范围的候选
  for (let attempt = 0; attempt < 80; attempt++) {
    const x = (seededRandom(seed + attempt * 3.1 + 1) - 0.5) * 28
    const z = (seededRandom(seed + attempt * 5.7 + 2) - 0.5) * 28
    const h = getTerrainHeight(x, z)
    if (h >= MIN_H && h <= MAX_H && isVisibleFromCamera(x, h, z)) {
      return [x, h, z]
    }
    const score = h < MIN_H ? MIN_H - h : h - MAX_H
    if (score < bestScore && isVisibleFromCamera(x, h, z)) {
      bestScore = score
      best = [x, h, z]
    }
  }
  return best ?? [0, MIN_H, 0]
}

/** 生成叶子球的位置（围绕枝干冠部分布） */
function getLeafPositions(seed: number, count: number, crownRadius: number, crownY: number): LeafInfo[] {
  const leaves: LeafInfo[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + seededRandom(seed + i * 7.3) * 0.9
    const dist = crownRadius * (0.35 + seededRandom(seed + i * 11.7) * 0.65)
    const y = crownY + (seededRandom(seed + i * 13.1) - 0.25) * crownRadius * 0.7
    const s = 0.65 + seededRandom(seed + i * 17.3) * 0.7
    leaves.push({
      position: [Math.cos(angle) * dist, y, Math.sin(angle) * dist],
      scale: s,
    })
  }
  return leaves
}

const plantVisuals = computed<PlantVisual[]>(() => {
  return props.plants.map(plant => {
    const stage = plant.status === 'dead' ? 'dead' : getGrowthStage(plant)
    const config: StageVisual = STAGE_VISUALS[stage] ?? STAGE_VISUALS.growing!
    const seed = (plant.id ?? 0) * 1000 + plant.teaId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const position = getPlantPosition(seed)
    const crownY = config.trunkHeight * config.scale
    const leaves = getLeafPositions(seed, config.leafCount, config.crownRadius, crownY)
    const rotationY = seededRandom(seed + 99) * Math.PI * 2
    const plantId = plant.id ?? 0
    return {
      id: plantId,
      position,
      rotation: [0, rotationY, 0] as [number, number, number],
      trunkPos: [0, config.trunkHeight * config.scale / 2, 0] as [number, number, number],
      glowPos: config.hasGlow
        ? [0, config.trunkHeight * config.scale + 0.45, 0] as [number, number, number]
        : null,
      hitPos: [0, config.trunkHeight * config.scale * 0.6, 0] as [number, number, number],
      hitRadius: Math.max(1.1, config.crownRadius * config.scale * 1.6),
      hitUserData: { plantId },
      config,
      leaves,
      rotationY,
    }
  })
})

// ============ 点击 / 悬停交互（三期） ============

const hoveredPlantId = ref<number | null>(null)
const selectedPlantId = ref<number | null>(null)

function onPlantOver(id: number): void {
  hoveredPlantId.value = id
}

function onPlantOut(id: number): void {
  if (hoveredPlantId.value === id) hoveredPlantId.value = null
}

function onPlantClick(id: number): void {
  selectedPlantId.value = id
  emit('select-plant', id)
}

/** 从事件对象 userData 中取 plantId（事件处理器必须用稳定引用，避免 TresJS 反复重绑导致渲染循环） */
function getEventPlantId(e: TresPointerEvent): number | undefined {
  const raw = (e.object as THREE.Object3D | undefined)?.userData?.plantId
  return typeof raw === 'number' ? raw : undefined
}

function onPlantOverEvent(e: TresPointerEvent): void {
  const id = getEventPlantId(e)
  if (id !== undefined) onPlantOver(id)
}

function onPlantOutEvent(e: TresPointerEvent): void {
  const id = getEventPlantId(e)
  if (id !== undefined) onPlantOut(id)
}

function onPlantClickEvent(e: TresPointerEvent): void {
  const id = getEventPlantId(e)
  if (id !== undefined) onPlantClick(id)
}

/** 悬停/选中时整体放大，提示可交互 */
function getPlantScale(id: number): number {
  return hoveredPlantId.value === id || selectedPlantId.value === id ? 1.15 : 1
}

/** 悬停/选中时叶子泛光 */
function getLeafEmissive(id: number): string {
  return hoveredPlantId.value === id || selectedPlantId.value === id ? '#aed581' : '#000000'
}

// ============ HDRI 环境加载 ============
onMounted(() => {
  const scene = sceneCtx.scene.value
  if (!scene) return

  // DEV 调试钩子：暴露场景与茶树列表，便于自动化验证与排查
  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>
    w.__teaGarden = {
      scene: () => sceneCtx.scene.value,
      plantVisuals: () => plantVisuals.value,
      activeCamera: () => sceneCtx.camera.activeCamera,
      THREE,
    }
  }

  const rgbeLoader = new RGBELoader()
  rgbeLoader.load(
    '/3d/hdri/kloofendal_2k.hdr',
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.environment = texture
      scene.background = texture
      scene.backgroundBlurriness = 0.3
    },
    undefined,
    () => {
      console.warn('[TeaGarden] HDRI 加载失败，使用纯色背景兜底')
      scene.background = new THREE.Color(0x2a3328)
    }
  )
})
</script>

<template>
  <!-- 相机：近景俯视中央茶园 -->
  <PerspectiveCamera
    :make-default="true"
    :position="[30, 23, 30]"
    :fov="50"
    :near="0.1"
    :far="500"
  />

  <!-- 雾效：茶色调雾，远处山朦胧 -->
  <FogExp2 :args="['#3a4a3a', 0.006]" attach="fog" />

  <!-- 太阳光：平行光，带软阴影 -->
  <DirectionalLight
    :position="[40, 60, 30]"
    :intensity="2.5"
    :color="'#fff5e0'"
    :cast-shadow="true"
    :shadow-mapSize-width="2048"
    :shadow-mapSize-height="2048"
    :shadow-camera-near="1"
    :shadow-camera-far="200"
    :shadow-camera-left="-80"
    :shadow-camera-right="80"
    :shadow-camera-top="80"
    :shadow-camera-bottom="-80"
    :shadow-bias="-0.0005"
  />

  <!-- 半球光：天空蓝 + 地面绿，模拟环境漫反射 -->
  <HemisphereLight :args="['#b8d4e8', '#3a5a3a', 0.6]" />

  <!-- 环境光：补光，避免阴影死黑 -->
  <AmbientLight :intensity="0.2" />

  <!-- 程序化梯田地形 -->
  <Mesh :geometry="terrainGeo" :receive-shadow="true">
    <MeshStandardMaterial
      :vertex-colors="true"
      :roughness="0.95"
      :metalness="0"
      :env-map-intensity="0.3"
    />
  </Mesh>

  <!-- 茶树（二期：程序化模型，按生长阶段变化；三期：点击/悬停交互） -->
  <Group
    v-for="plant in plantVisuals"
    :key="plant.id"
    :position="plant.position"
    :rotation="plant.rotation"
    :scale="getPlantScale(plant.id)"
  >
    <!-- 枝干 -->
    <Mesh
      :cast-shadow="true"
      :position="plant.trunkPos"
    >
      <CylinderGeometry
        :args="[
          plant.config.trunkRadius * plant.config.scale * 0.55,
          plant.config.trunkRadius * plant.config.scale,
          plant.config.trunkHeight * plant.config.scale,
          8
        ]"
      />
      <MeshStandardMaterial :color="'#5d4037'" :roughness="0.92" />
    </Mesh>

    <!-- 叶子球（围绕冠部分布） -->
    <Mesh
      v-for="(leaf, i) in plant.leaves"
      :key="i"
      :cast-shadow="true"
      :position="leaf.position"
      :scale="leaf.scale * plant.config.scale"
    >
      <IcosahedronGeometry :args="[0.38, 1]" />
      <MeshStandardMaterial
        :color="plant.config.leafColor"
        :roughness="0.82"
        :flat-shading="true"
        :emissive="getLeafEmissive(plant.id)"
        :emissive-intensity="0.55"
      />
    </Mesh>

    <!-- 成熟茶树：顶部发光新芽 -->
    <Mesh
      v-if="plant.glowPos"
      :position="plant.glowPos"
    >
      <SphereGeometry :args="[0.13, 10, 10]" />
      <MeshStandardMaterial
        :color="'#c5e1a5'"
        :emissive="'#7cb342'"
        :emissive-intensity="2.5"
      />
    </Mesh>

    <!-- 透明点击包围球（只做拾取，不渲染；事件用稳定函数引用避免渲染循环） -->
    <Mesh
      :position="plant.hitPos"
      :user-data="plant.hitUserData"
      @click="onPlantClickEvent"
      @pointer-over="onPlantOverEvent"
      @pointer-out="onPlantOutEvent"
    >
      <SphereGeometry :args="[plant.hitRadius, 10, 10]" />
      <MeshBasicMaterial
        :transparent="true"
        :opacity="0"
        :depth-write="false"
        :color-write="false"
      />
    </Mesh>
  </Group>

  <!-- 轨道控制器（cientos 组件，内部已处理 camera/domElement） -->
  <OrbitControls
    :make-default="true"
    :enable-damping="true"
    :damping-factor="0.05"
    :min-distance="8"
    :max-distance="120"
    :max-polar-angle="Math.PI / 2.05"
    :target="[0, 3, 0]"
  />
</template>


