<script setup lang="ts">
/**
 * TeaGardenSceneInner — 3D茶园场景内容（TresCanvas 内部）
 * 一期：HDRI环境 + 太阳光 + 雾 + 程序化梯田地形 + OrbitControls
 * 二期：程序化茶树渲染（按生长阶段变化形态，基于plant.id确定性分布）
 * 三期：点击/悬停交互（点击茶树高亮并通知父组件打开详情）
 *
 * TresJS 5 坑：rotation 必须传 [x,y,z] 数组，不能传 Vector3。
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core'
import { createAmbient } from './garden-ambient'
import { createAnimals } from './garden-animals'
import { createScenery } from './garden-scenery'
import { createWeather, type WeatherMode } from './garden-weather'
import { createAmbientAudio, type AmbientAudio } from './ambient-audio'
import { OrbitControls } from '@tresjs/cientos'
import type { PointerEvent as TresPointerEvent } from '@pmndrs/pointer-events'
import * as THREE from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { getGrowthStage } from '@/services/garden'
import type { PlantedTea } from '@/types/garden'

const props = defineProps<{
  plants: PlantedTea[]
}>()

const emit = defineEmits<{
  'select-plant': [id: number]
}>()

const sceneCtx = useTresContext()
/** 六期：OrbitControls 实例引用（DEV 调试钩子暴露，供自动化特写/验证） */
const controlsRef = ref<InstanceType<typeof OrbitControls> | null>(null)
const sunLightRef = ref<THREE.DirectionalLight | null>(null)
const ambientLightRef = ref<THREE.AmbientLight | null>(null)

// 地面湿润度（雨天渐变，地形 shader 读取；天气模块写入）
const wetnessUniform = { value: 0 }

/** 四期：渲染函数替换（后处理接管渲染循环）；五期：粒子动画钩子 */
const { render: replaceRender, onBeforeRender } = useLoop()
let ambientLayer: ReturnType<typeof createAmbient> | null = null
let animalsLayer: ReturnType<typeof createAnimals> | null = null
let sceneryLayer: ReturnType<typeof createScenery> | null = null
let weatherLayer: ReturnType<typeof createWeather> | null = null
let audioLayer: AmbientAudio | null = null
let currentWeather: WeatherMode = 'sunny'
let audioEnabled = false

onBeforeRender(({ delta, elapsed }) => {
  updateWater(delta)
  ambientLayer?.update(elapsed, delta)
  animalsLayer?.update(elapsed)
  sceneryLayer?.update(elapsed)
  weatherLayer?.update(delta)
  // 风动：叶簇整簇轻微摇摆（绕组原点，树干不动；幅度 ~2°，微风感）
  for (const [id, g] of leafClusterByPlant) {
    g.rotation.z = Math.sin(elapsed * 0.8 + id * 1.7) * 0.035
    g.rotation.x = Math.sin(elapsed * 0.55 + id * 2.3) * 0.02
  }
})

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

/** 程序化"万里晴空"背景：Equirect 球面渐变（天顶蔚蓝 → 地平线浅蓝白） */
function createSkyTexture(): THREE.CanvasTexture {
  const w = 64
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不可用')
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#1f56ad') // 天顶：蔚蓝
  g.addColorStop(0.32, '#3f86cf') // 高天：明蓝
  g.addColorStop(0.62, '#86bae4') // 中天：浅蓝
  g.addColorStop(0.85, '#c6e0f2') // 低空：蓝白
  g.addColorStop(1, '#eef6fc') // 地平线：近白
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // 近地平线加一层淡淡晨光暖白（云朵下缘光感）
  const glow = ctx.createLinearGradient(0, h * 0.78, 0, h)
  glow.addColorStop(0, 'rgba(255,255,255,0)')
  glow.addColorStop(1, 'rgba(255,246,230,0.9)')
  ctx.fillStyle = glow
  ctx.fillRect(0, h * 0.78, w, h * 0.22)
  const tex = new THREE.CanvasTexture(canvas)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
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

  // 六期写实化：顶点色退化为明暗系数（灰白），真实颜色由 PBR 贴图按高度混合提供。
  // 保留噪声起伏与梯田边缘阴影，增强真实光照层次。
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = getTerrainHeight(x, z)
    pos.setY(i, h)

    // 明暗：缓坡略亮、陡坡/梯田台阶暗（台阶面平缓处亮），叠加低频噪声
    let shade = 1.0
    if (h > TERRACE_START && h < TERRACE_END) {
      const terracePos = ((h - TERRACE_START) % TERRACE_STEP) / TERRACE_STEP
      shade = terracePos < 0.12 ? 0.88 : 1.0 // 梯田垂直边缘阴影
    }
    if (h > 12) shade *= 0.92 // 高处岩石略暗
    shade *= 1.0 + (smoothNoise(x * 0.25, z * 0.25) - 0.5) * 0.22

    colors[i * 3] = shade
    colors[i * 3 + 1] = shade
    colors[i * 3 + 2] = shade
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

const terrainGeo = createTerrainGeometry()
const terrainMeshRef = ref<THREE.Mesh | null>(null)

// ============ 六期写实化：程序化叶片 / 树皮贴图（同步生成，全局复用） ============
const leafBladeTexture = createLeafBladeTexture()
const barkTexture = createBarkTexture()

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
  // 六期写实化：叶子从球体改为真实叶片卡片，叶片数大幅增加形成叶簇冠
  sprout:   { scale: 1, leafCount: 12, leafColor: '#aed581', trunkHeight: 0.35, trunkRadius: 0.08, crownRadius: 0.3,  hasGlow: false },
  seedling: { scale: 1, leafCount: 24, leafColor: '#9ccc65', trunkHeight: 0.55, trunkRadius: 0.08, crownRadius: 0.45, hasGlow: false },
  growing:  { scale: 1, leafCount: 48, leafColor: '#8bc34a', trunkHeight: 0.8,  trunkRadius: 0.08, crownRadius: 0.6,  hasGlow: false },
  mature:   { scale: 1, leafCount: 80, leafColor: '#7cb342', trunkHeight: 1.05, trunkRadius: 0.08, crownRadius: 0.75, hasGlow: true },
  recovery: { scale: 1, leafCount: 36, leafColor: '#9ccc65', trunkHeight: 0.9,  trunkRadius: 0.08, crownRadius: 0.65, hasGlow: false },
  dead:     { scale: 1, leafCount: 16, leafColor: '#6d4c41', trunkHeight: 0.85, trunkRadius: 0.08, crownRadius: 0.5,  hasGlow: false },
}

/** 单叶片卡片：位置 + 朝向（四元数）+ 缩放 + 颜色 */
interface LeafBlade {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  scale: number
  /** 每片叶子的颜色（基于 seed 微调明暗，增加层次感） */
  color: string
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
  blades: LeafBlade[]
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

/**
 * 生成叶片卡片分布：围绕枝干冠部分布，每片叶子朝向冠心外侧（真实叶簇感），
 * 顶部叶片上翘（新芽区），颜色基于 seed 微调明暗。
 */
function getLeafBlades(seed: number, count: number, crownRadius: number, crownY: number, baseColor: string): LeafBlade[] {
  const base = new THREE.Color(baseColor)
  const blades: LeafBlade[] = []
  const crownCenter = new THREE.Vector3(0, crownY, 0)
  const zAxis = new THREE.Vector3(0, 0, 1)
  const up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < count; i++) {
    const angle = seededRandom(seed + i * 7.3) * Math.PI * 2
    const distNorm = 0.35 + seededRandom(seed + i * 11.7) * 0.65 // 0.35~1.0 冠内归一化距离
    const dist = crownRadius * distNorm
    const y = crownY + (seededRandom(seed + i * 13.1) - 0.4) * crownRadius * 0.9
    const pos = new THREE.Vector3(Math.cos(angle) * dist, y, Math.sin(angle) * dist)

    // 朝向：默认叶片正面（+Z）朝冠心外侧；顶部新芽叶朝上
    const q = new THREE.Quaternion()
    if (y > crownY + crownRadius * 0.35) {
      q.setFromUnitVectors(zAxis, up)
    } else {
      q.setFromUnitVectors(zAxis, new THREE.Vector3().subVectors(crownCenter, pos).normalize())
    }
    // 随机绕自身中轴旋转 + 轻微俯仰（自然朝向，避免整齐划一）
    q.multiply(new THREE.Quaternion().setFromAxisAngle(zAxis, seededRandom(seed + i * 21.1) * Math.PI * 2))
    q.multiply(new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      (seededRandom(seed + i * 23.7) - 0.5) * 0.7
    ))

    // 双层冠：内层小叶（深色、填密度），外层大叶（受光、饱满）
    const isInner = distNorm < 0.62
    const s = (isInner ? 0.5 + seededRandom(seed + i * 17.3) * 0.3 : 0.8 + seededRandom(seed + i * 17.3) * 0.55)
    // 顶部新芽叶更浅更亮；内层叶偏深
    const lightness = (seededRandom(seed + i * 19.7) - 0.5) * 0.14
      + (y > crownY + crownRadius * 0.35 ? 0.12 : 0)
      + (isInner ? -0.07 : 0)
    const c = base.clone().offsetHSL(0, 0, lightness)
    blades.push({
      position: [pos.x, pos.y, pos.z],
      quaternion: [q.x, q.y, q.z, q.w],
      scale: s,
      color: `#${c.getHexString()}`,
    })
  }
  return blades
}

const plantVisuals = computed<PlantVisual[]>(() => {
  return props.plants.map(plant => {
    const stage = plant.status === 'dead' ? 'dead' : getGrowthStage(plant)
    const config: StageVisual = STAGE_VISUALS[stage] ?? STAGE_VISUALS.growing!
    const seed = (plant.id ?? 0) * 1000 + plant.teaId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const position = getPlantPosition(seed)
    const crownY = config.trunkHeight * config.scale
    const blades = getLeafBlades(seed, config.leafCount, config.crownRadius, crownY, config.leafColor)
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
      blades,
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

// ============ 六期写实化：程序化高细节贴图（叶片 / 树皮） ============

/**
 * 生成单叶片 alpha 贴图（128px，透明背景）：
 * 披针形叶片轮廓（贝塞尔曲线）+ 主/侧叶脉 + 渐变绿 + 微光斑点 + 边缘暗化。
 * 背景透明，配合材质 alphaTest 裁剪，呈现真实叶片形状而非圆球。
 */
function createLeafBladeTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不可用')
  const rnd = (n: number) => Math.random() * n

  // 叶片轮廓：披针形（左叶尖 → 上缘弧 → 右叶尖 → 下缘弧回）
  const lx = 16, rx = 112, midY = 64
  ctx.beginPath()
  ctx.moveTo(lx, midY)
  ctx.bezierCurveTo(lx + 26, midY - 30, rx - 26, midY - 24, rx, midY)
  ctx.bezierCurveTo(rx - 26, midY + 24, lx + 26, midY + 30, lx, midY)
  ctx.closePath()

  // 叶片底色：沿叶长线性渐变（叶基深 → 叶尖亮），叠加横向轻微明暗
  const base = ctx.createLinearGradient(lx, 0, rx, 0)
  base.addColorStop(0, '#4c7d33')
  base.addColorStop(0.5, '#62963f')
  base.addColorStop(1, '#7fb255')
  ctx.fillStyle = base
  ctx.fill()

  // 主叶脉（中脉）
  ctx.strokeStyle = 'rgba(26,54,20,0.5)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(lx + 3, midY)
  ctx.quadraticCurveTo((lx + rx) / 2, midY - 1, rx - 4, midY)
  ctx.stroke()

  // 侧叶脉：每侧 5 条斜线
  ctx.lineWidth = 0.8
  for (let i = 0; i < 5; i++) {
    const t = 0.2 + i * 0.13
    const vx = lx + (rx - lx) * t
    const len = 10 + rnd(8)
    ctx.beginPath()
    ctx.moveTo(vx, midY)
    ctx.lineTo(vx + len, midY - 8 - rnd(6))
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(vx, midY)
    ctx.lineTo(vx + len, midY + 8 + rnd(6))
    ctx.stroke()
  }

  // 蜡质微反光斑点
  for (let i = 0; i < 40; i++) {
    const g = 140 + rnd(60)
    ctx.fillStyle = `rgba(${g - 30},${g},${g - 60},${0.06 + rnd(0.1)})`
    ctx.beginPath()
    ctx.arc(lx + 10 + rnd(rx - lx - 20), midY - 18 + rnd(36), 1 + rnd(2.2), 0, Math.PI * 2)
    ctx.fill()
  }

  // 边缘暗化 + 叶片尖端高光
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(lx, midY)
  ctx.bezierCurveTo(lx + 26, midY - 30, rx - 26, midY - 24, rx, midY)
  ctx.bezierCurveTo(rx - 26, midY + 24, lx + 26, midY + 30, lx, midY)
  ctx.closePath()
  ctx.clip()
  const edge = ctx.createRadialGradient((lx + rx) / 2, midY, 20, (lx + rx) / 2, midY, 66)
  edge.addColorStop(0, 'rgba(0,0,0,0)')
  edge.addColorStop(1, 'rgba(18,40,12,0.45)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, size, size)
  // 叶尖透光高光
  ctx.fillStyle = 'rgba(210,235,170,0.35)'
  ctx.beginPath()
  ctx.ellipse(rx - 6, midY, 7, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 生成粗糙树皮贴图（128x256，深褐 + 纵向裂纹 + 结疤） */
function createBarkTexture(): THREE.CanvasTexture {
  const w = 128
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不可用')

  ctx.fillStyle = '#5b4232'
  ctx.fillRect(0, 0, w, h)
  // 纵向裂纹
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * w
    const shade = 0.7 + Math.random() * 0.55
    ctx.strokeStyle = `rgba(${Math.round(48 * shade)},${Math.round(32 * shade)},${Math.round(22 * shade)},${0.5 + Math.random() * 0.4})`
    ctx.lineWidth = 0.8 + Math.random() * 1.6
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + Math.random() * 6 - 3, h * 0.3, x + Math.random() * 8 - 4, h * 0.7, x + Math.random() * 4 - 2, h)
    ctx.stroke()
  }
  // 高光脊线（裂脊受光）
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * w
    ctx.strokeStyle = `rgba(150,118,88,${0.12 + Math.random() * 0.16})`
    ctx.lineWidth = 1 + Math.random() * 1.4
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + Math.random() * 5 - 2.5, h * 0.4, x + Math.random() * 6 - 3, h * 0.6, x + Math.random() * 4 - 2, h)
    ctx.stroke()
  }
  // 结疤
  for (let i = 0; i < 3; i++) {
    const x = 20 + Math.random() * (w - 40)
    const y = 40 + Math.random() * (h - 80)
    ctx.fillStyle = 'rgba(30,20,14,0.5)'
    ctx.beginPath()
    ctx.ellipse(x, y, 3 + Math.random() * 3, 4 + Math.random() * 4, Math.random(), 0, Math.PI * 2)
    ctx.fill()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ============ 六期写实化：地形 PBR 材质（三贴图按高度混合） ============

/**
 * 给地形材质注入三张真实贴图（Poly Haven CC0）：
 * 低处草地 → 梯田泥土 → 高处岩石，按世界高度 smoothstep 混合，
 * 顶点色保留为明暗系数参与调制。
 */
function applyTerrainTextures(
  material: THREE.MeshStandardMaterial,
  textures: { grass: THREE.Texture; mud: THREE.Texture; rock: THREE.Texture; grassNormal: THREE.Texture },
  wetness: { value: number }
): void {
  // 平铺采样：三张贴图必须 RepeatWrapping，否则 UV×N 超出 1 的部分被边缘像素 clamp 平铺
  for (const t of [textures.grass, textures.mud, textures.rock, textures.grassNormal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
  }
  material.map = textures.grass
  material.normalMap = textures.grassNormal
  material.normalScale = new THREE.Vector2(0.9, 0.9)
  material.needsUpdate = true

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTexGrass = { value: textures.grass }
    shader.uniforms.uTexMud = { value: textures.mud }
    shader.uniforms.uTexRock = { value: textures.rock }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uTexGrass;
        uniform sampler2D uTexMud;
        uniform sampler2D uTexRock;
        uniform float uWetness;
        varying vec3 vWorldPos;`
      )
      .replace(
        '#include <map_fragment>',
        `vec4 texGrass = texture2D(uTexGrass, vMapUv * 10.0);
        vec4 texMud = texture2D(uTexMud, vMapUv * 7.0);
        vec4 texRock = texture2D(uTexRock, vMapUv * 5.0);
        float terrH = vWorldPos.y;
        float tMud = smoothstep(2.0, 6.0, terrH) * 0.38;   // 草地 → 梯田泥（茶园区草皮为主）
        float tRock = smoothstep(12.0, 16.0, terrH);       // 梯田 → 高处裸岩
        vec3 terrMix = mix(texGrass.rgb, texMud.rgb, tMud);
        terrMix = mix(terrMix, texRock.rgb, tRock);
        vec4 sampledDiffuseColor = vec4(terrMix, 1.0);
        #ifdef USE_COLOR
          sampledDiffuseColor.rgb *= vColor.rgb; // 顶点色明暗系数（r185: vColor 为 vec4）
        #endif
        sampledDiffuseColor.rgb *= (1.0 - uWetness * 0.3); // 雨天地面湿润变暗
        diffuseColor *= sampledDiffuseColor;`
      )
    shader.uniforms.uWetness = wetness // 共享对象引用，运行时 wetness.value 变化实时生效
  }
}

// ============ 六期写实化：叶簇层（真实叶片 InstancedMesh） ============

/** 每棵树一个叶簇 Group（含 1 个叶片 InstancedMesh），100 树 ≈ 100 draw call（原 900 球大幅减少） */
const leafClusterRoot = ref<THREE.Group | null>(null)
const leafClusterByPlant = new Map<number, THREE.Group>()

/** 重建全部叶簇（plants 增删/阶段变化时调用；共享几何与材质，只重建实例矩阵） */
function buildLeafClusters(scene: THREE.Scene): void {
  const oldRoot = leafClusterRoot.value
  if (oldRoot) {
    oldRoot.removeFromParent()
    oldRoot.traverse(o => { if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose() })
  }
  leafClusterByPlant.clear()

  const root = new THREE.Group()
  root.name = 'leafClusters'
  const geo = new THREE.PlaneGeometry(0.3, 0.2)
  const mat = new THREE.MeshStandardMaterial({
    map: leafBladeTexture,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.72,
    envMapIntensity: 0.5,
  })
  const dummy = new THREE.Object3D()
  const tmpColor = new THREE.Color()

  for (const plant of plantVisuals.value) {
    const count = plant.blades.length
    if (count === 0) continue
    const group = new THREE.Group()
    group.position.set(plant.position[0], plant.position[1], plant.position[2])
    group.rotation.y = plant.rotationY
    const mesh = new THREE.InstancedMesh(geo, mat, count)
    mesh.castShadow = true
    for (let i = 0; i < count; i++) {
      const b = plant.blades[i]
      if (!b) continue
      dummy.position.set(b.position[0], b.position[1], b.position[2])
      dummy.quaternion.set(b.quaternion[0], b.quaternion[1], b.quaternion[2], b.quaternion[3])
      dummy.scale.setScalar(b.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      tmpColor.set(b.color)
      mesh.setColorAt(i, tmpColor)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    group.add(mesh)
    root.add(group)
    leafClusterByPlant.set(plant.id, group)
  }
  scene.add(root)
  leafClusterRoot.value = root
}

/** 悬停/选中时对应叶簇同步放大（与模板 Group scale 一致） */
function syncLeafClusterScale(): void {
  const s = (id: number) => hoveredPlantId.value === id || selectedPlantId.value === id ? 1.15 : 1
  for (const [id, g] of leafClusterByPlant) g.scale.setScalar(s(id))
}

watch([hoveredPlantId, selectedPlantId], syncLeafClusterScale)

// ============ 装饰植被（四期） ============

const ROCK_COUNT = 45
const GRASS_COUNT = 420
const FLOWER_COUNT = 90

/** 装饰物定位：在中央茶山半径内随机采样地形高度，命中高度范围即返回 */
function getDecorPosition(seedIdx: number, minH: number, maxH: number): [number, number, number] {
  for (let attempt = 0; attempt < 24; attempt++) {
    const x = (seededRandom(seedIdx * 37.1 + attempt * 3.3 + 1) - 0.5) * 70
    const z = (seededRandom(seedIdx * 53.7 + attempt * 5.1 + 2) - 0.5) * 70
    const h = getTerrainHeight(x, z)
    if (h >= minH && h <= maxH) return [x, h, z]
  }
  return [0, minH + 1, 0]
}

/** 生成石头：Dodecahedron 顶点随机位移，程序化圆润石块 */
function createRockGeometry(): THREE.DodecahedronGeometry {
  const geo = new THREE.DodecahedronGeometry(1, 0)
  const pos = geo.attributes.position!
  for (let i = 0; i < pos.count; i++) {
    const n = seededRandom(i * 7.7 + 11) - 0.5
    pos.setXYZ(
      i,
      pos.getX(i) * (1 + n * 0.55),
      pos.getY(i) * (1 + n * 0.4),
      pos.getZ(i) * (1 + n * 0.55)
    )
  }
  geo.computeVertexNormals()
  return geo
}

/** 创建装饰植被并挂到场景（石头用独立 Mesh，草/花用 InstancedMesh，共 3 个 draw call） */
function createDecorations(scene: THREE.Scene): void {
  const decorGroup = new THREE.Group()
  decorGroup.name = 'decorations'

  // --- 石头：散布在坡地/梯田边缘 ---
  const rockGeo = createRockGeometry()
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.95, flatShading: true })
  for (let i = 0; i < ROCK_COUNT; i++) {
    const [x, h, z] = getDecorPosition(i, 1.2, 12)
    const rock = new THREE.Mesh(rockGeo, rockMat)
    const s = 0.28 + seededRandom(i * 3.3 + 5) * 0.85
    rock.scale.set(s, s * (0.55 + seededRandom(i * 2.1 + 9) * 0.5), s)
    rock.position.set(x, h - s * 0.3, z)
    rock.rotation.set(
      seededRandom(i + 17) * Math.PI,
      seededRandom(i + 23) * Math.PI,
      seededRandom(i + 29) * Math.PI
    )
    decorGroup.add(rock)
  }

  // --- 草簇：InstancedMesh，颜色按 HSL 微调 ---
  const grassGeo = new THREE.ConeGeometry(0.06, 0.5, 4)
  grassGeo.translate(0, 0.25, 0)
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true })
  const grass = new THREE.InstancedMesh(grassGeo, grassMat, GRASS_COUNT)
  const dummy = new THREE.Object3D()
  const tmpColor = new THREE.Color()
  for (let i = 0; i < GRASS_COUNT; i++) {
    const [x, h, z] = getDecorPosition(i + 100, 0.5, 14)
    dummy.position.set(x, h, z)
    const s = 0.6 + seededRandom(i * 4.7 + 3) * 1.3
    dummy.scale.set(s, s, s)
    dummy.rotation.set(0, seededRandom(i + 41) * Math.PI, (seededRandom(i + 43) - 0.5) * 0.35)
    dummy.updateMatrix()
    grass.setMatrixAt(i, dummy.matrix)
    tmpColor.setHSL(0.25 + seededRandom(i * 1.9 + 2) * 0.07, 0.4, 0.3 + seededRandom(i * 3.1 + 4) * 0.2)
    grass.setColorAt(i, tmpColor)
  }
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true
  decorGroup.add(grass)

  // --- 野花：InstancedMesh 亮色小球，集中茶园带 ---
  const flowerGeo = new THREE.IcosahedronGeometry(0.1, 0)
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, flatShading: true })
  const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, FLOWER_COUNT)
  const flowerPalette = [0xf4e28d, 0xf4b8d0, 0xe8e3f2, 0xf2b88d, 0xd9e8b8]
  for (let i = 0; i < FLOWER_COUNT; i++) {
    const [x, h, z] = getDecorPosition(i + 500, 2, 10)
    dummy.position.set(x, h + 0.05, z)
    const s = 0.8 + seededRandom(i * 5.9 + 7) * 1.4
    dummy.scale.set(s, s, s)
    dummy.rotation.set(0, seededRandom(i + 61) * Math.PI, 0)
    dummy.updateMatrix()
    flowers.setMatrixAt(i, dummy.matrix)
    tmpColor.setHex(flowerPalette[Math.floor(seededRandom(i * 8.1 + 13) * flowerPalette.length)] ?? 0xf4e28d)
    flowers.setColorAt(i, tmpColor)
  }
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true
  decorGroup.add(flowers)

  scene.add(decorGroup)
}

// ============ 后处理（四期：SSAO + Bloom） ============

/** 组装后处理管线：RenderPass → SSAO（桌面）→ Bloom → OutputPass（ACES 色调映射） */
function setupPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  sizes: { width: () => number; height: () => number }
): { composer: EffectComposer; dispose: () => void } {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  let ssao: SSAOPass | null = null
  if (!isMobile) {
    ssao = new SSAOPass(scene, camera, sizes.width(), sizes.height())
    // 柔和 AO：中等采样半径，深度范围取场景尺度（避免近处全黑）
    ssao.kernelRadius = 0.6
    ssao.minDistance = 0.005
    ssao.maxDistance = 0.12
    composer.addPass(ssao)
  }

  // Bloom：阈值 1.3（HDR 亮度），只让成熟新芽（emissive 2.5）等强发光点辉光，
  // 普通叶子与环境反光不发光（避免场景整体泛光发晕）
  const bloom = new UnrealBloomPass(new THREE.Vector2(sizes.width(), sizes.height()), 0.35, 0.6, 1.3)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const onResize = () => {
    composer.setSize(sizes.width(), sizes.height())
    if (ssao) ssao.setSize(sizes.width(), sizes.height())
  }
  window.addEventListener('resize', onResize)
  return {
    composer,
    dispose: () => window.removeEventListener('resize', onResize),
  }
}

// ============ 浇水水滴粒子（五期：点击浇水后的视觉反馈） ============

const WATER_PARTICLE_COUNT = 80
const WATER_MAX_LIFE = 1.2 // 秒
const WATER_GRAVITY = 7

interface WaterState {
  t: number
  maxT: number
  velocities: Float32Array
}

const waterPoints = ref<THREE.Points | null>(null)
const waterState = ref<WaterState | null>(null)

/** 创建水滴粒子系统（Points，蓝色半透明，一次性池化复用） */
function createWaterPoints(): THREE.Points {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WATER_PARTICLE_COUNT * 3), 3))
  // 注意：transparent:true 在本渲染管线不渲染，用不透明圆点 + 整体淡出
  const mat = new THREE.PointsMaterial({
    color: 0x9fdcff,
    size: 0.55,
    depthWrite: false,
  })
  const points = new THREE.Points(geo, mat)
  points.visible = false
  points.frustumCulled = false
  return points
}

/** 在指定茶树上方播放下雨粒子（不改变任何状态机，纯视觉反馈） */
function playWater(plantId: number): void {
  const points = waterPoints.value
  if (!points || waterState.value) return
  const pv = plantVisuals.value.find(p => p.id === plantId)
  if (!pv) return
  const pos = points.geometry.attributes.position as THREE.BufferAttribute
  const velocities = new Float32Array(WATER_PARTICLE_COUNT * 3)
  const [px, py, pz] = pv.position
  for (let i = 0; i < WATER_PARTICLE_COUNT; i++) {
    const angle = seededRandom(i * 5.3 + 2) * Math.PI * 2
    const r = 0.5 + seededRandom(i * 3.7 + 1) * 1.1
    pos.setXYZ(
      i,
      px + Math.cos(angle) * r * 0.5,
      py + 1.6 + seededRandom(i * 7.1 + 3) * 0.9,
      pz + Math.sin(angle) * r * 0.5
    )
    velocities[i * 3] = (seededRandom(i * 11.3 + 4) - 0.5) * 1.4
    velocities[i * 3 + 1] = 0
    velocities[i * 3 + 2] = (seededRandom(i * 13.7 + 5) - 0.5) * 1.4
  }
  pos.needsUpdate = true
  waterState.value = { t: 0, maxT: WATER_MAX_LIFE, velocities }
  points.visible = true
}

/** 每帧更新水滴：重力下落 + 整体淡出 */
function updateWater(delta: number): void {
  const points = waterPoints.value
  const state = waterState.value
  if (!points || !state) return
  state.t += delta
  if (state.t >= state.maxT) {
    points.visible = false
    waterState.value = null
    return
  }
  const pos = points.geometry.attributes.position as THREE.BufferAttribute
  const vel = state.velocities
  for (let i = 0; i < WATER_PARTICLE_COUNT; i++) {
    const idx = i * 3
    vel[idx + 1] = (vel[idx + 1] ?? 0) - WATER_GRAVITY * delta
    pos.setXYZ(
      i,
      pos.getX(i) + (vel[idx] ?? 0) * delta,
      pos.getY(i) + (vel[idx + 1] ?? 0) * delta,
      pos.getZ(i) + (vel[idx + 2] ?? 0) * delta
    )
  }
  pos.needsUpdate = true
  ;(points.material as THREE.PointsMaterial).opacity = 0.9 * (1 - state.t / state.maxT)
}

defineExpose({ playWater, setWeather, setAudioEnabled })

/** 切换天气（晴天/雨天），由 GardenView 按钮触发 */
function setWeather(mode: WeatherMode): void {
  currentWeather = mode
  weatherLayer?.setWeather(mode)
  // 晨雾为雨天专属（晴天"万里晴空"；雾带在晴天蓝天下会成"白色地块"）
  ambientLayer?.setFogVisible(mode === 'rain')
  // 音效联动：雨天雨声强度跟随
  audioLayer?.setRainIntensity(mode === 'rain' ? 1 : 0)
}

/** 环境音效开关（需用户手势，AudioContext 在此启动） */
function setAudioEnabled(on: boolean): void {
  audioEnabled = on
  audioLayer?.setEnabled(on)
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
      controls: () => controlsRef.value,
      THREE,
    }
  }

  // 六期：ACES 电影级色调映射 + 柔和软阴影（真实感光照）
  const renderer = sceneCtx.renderer.instance as unknown as THREE.WebGLRenderer
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.12
  renderer.shadowMap.type = THREE.PCFShadowMap

  // 六期：加载 Poly Haven 真实地形贴图（CC0）并应用到地形材质
  const texLoader = new THREE.TextureLoader()
  Promise.all([
    texLoader.loadAsync('/3d/textures/terrain/aerial_grass_rock_diff_2k.jpg'),
    texLoader.loadAsync('/3d/textures/terrain/brown_mud_dry_diff_2k.jpg'),
    texLoader.loadAsync('/3d/textures/terrain/rock_ground_02_diff_2k.jpg'),
    texLoader.loadAsync('/3d/textures/terrain/aerial_grass_rock_nor_gl_2k.jpg'),
  ])
    .then(([grass, mud, rock, grassNormal]) => {
      grass.colorSpace = THREE.SRGBColorSpace
      mud.colorSpace = THREE.SRGBColorSpace
      rock.colorSpace = THREE.SRGBColorSpace
      grassNormal.colorSpace = THREE.NoColorSpace
      const terrain = terrainMeshRef.value
      if (terrain) {
        applyTerrainTextures(terrain.material as THREE.MeshStandardMaterial, { grass, mud, rock, grassNormal }, wetnessUniform)
      }
    })
    .catch((error: unknown) => {
      console.warn('[TeaGarden] 地形贴图加载失败，回退程序化着色:', error)
    })

  // 四期：装饰植被（石头 + 草 + 野花）挂到场景
  createDecorations(scene)

  // 六期：真实叶片叶簇层（初始挂载 + 后续 plants 变化时重建）
  buildLeafClusters(scene)
  watch(plantVisuals, () => { buildLeafClusters(scene) })

  // 五期：浇水水滴粒子系统挂到场景
  const wp = createWaterPoints()
  scene.add(wp)
  waterPoints.value = wp

  // 活茶园：环境氛围层（云朵/云影/晨雾） + 小动物（蝴蝶/蜜蜂/飞鸟）
  const activeCam2 = sceneCtx.camera.activeCamera as unknown
  const camRef2 = ((activeCam2 as { value?: THREE.PerspectiveCamera }).value ?? activeCam2) as THREE.PerspectiveCamera
  ambientLayer = createAmbient(scene, camRef2)
  animalsLayer = createAnimals(scene)
  sceneryLayer = createScenery(scene)
  // 天气系统（晴天/雨天：雨丝 + 地面湿润 + 光照/雾联动）
  const sun = sunLightRef.value
  const amb = ambientLightRef.value
  if (sun && amb) {
    weatherLayer = createWeather({
      sunLight: sun,
      ambientLight: amb,
      fog: (scene.fog as THREE.FogExp2 | null) ?? null,
      renderer,
      wetnessUniform,
    })
  }
  // 环境音效（WebAudio 合成，默认静音，需用户手势后开启）
  audioLayer = createAmbientAudio()

  // 四期：后处理管线（SSAO + Bloom），用 useLoop().render 接管渲染循环
  const activeCam = sceneCtx.camera.activeCamera as unknown
  const cam = ((activeCam as { value?: THREE.PerspectiveCamera }).value ?? activeCam) as THREE.PerspectiveCamera
  const { composer, dispose } = setupPostProcessing(renderer, scene, cam, {
    width: () => sceneCtx.sizes.width.value,
    height: () => sceneCtx.sizes.height.value,
  })
  replaceRender(() => { composer.render() })
  onUnmounted(() => {
    dispose()
    ambientLayer?.dispose()
    animalsLayer?.dispose()
    sceneryLayer?.dispose()
    weatherLayer?.dispose()
    audioLayer?.dispose()
  })

  const rgbeLoader = new RGBELoader()
  rgbeLoader.load(
    '/3d/hdri/kloofendal_2k.hdr',
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      // HDRI 只做环境反射（PBR 材质质感），背景用程序化"蓝天白云"渐变球
      scene.environment = texture
      // 压环境强度：HDRI 太阳亮斑被物体反射 + Bloom 放大 = 用户多次反馈的"右侧刺眼白光"
      scene.environmentIntensity = 0.3
      scene.background = createSkyTexture()
      scene.backgroundBlurriness = 0.3
    },
    undefined,
    () => {
      console.warn('[TeaGarden] HDRI 加载失败，使用纯色背景兜底')
      scene.background = createSkyTexture()
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

  <!-- 雾效：晴天淡蓝白雾（远处山朦胧），雨天由天气状态机调浓 -->
  <FogExp2 :args="['#b9cfdf', 0.006]" attach="fog" />

  <!-- 太阳光：平行光，带软阴影 -->
  <DirectionalLight
    ref="sunLightRef"
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
  <AmbientLight ref="ambientLightRef" :intensity="0.2" />

  <!-- 六期：程序化梯田地形（真实 PBR 贴图在 onMounted 异步加载后注入） -->
  <Mesh ref="terrainMeshRef" :geometry="terrainGeo" :receive-shadow="true">
    <MeshStandardMaterial
      :vertex-colors="true"
      :roughness="0.9"
      :metalness="0"
      :env-map-intensity="0.35"
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
    <!-- 枝干（六期：粗糙树皮贴图，取代纯色） -->
    <Mesh
      :cast-shadow="true"
      :position="plant.trunkPos"
    >
      <CylinderGeometry
        :args="[
          plant.config.trunkRadius * plant.config.scale * 0.55,
          plant.config.trunkRadius * plant.config.scale,
          plant.config.trunkHeight * plant.config.scale,
          10
        ]"
      />
      <MeshStandardMaterial
        :map="barkTexture"
        :bump-map="barkTexture"
        :bump-scale="0.6"
        :roughness="0.95"
      />
    </Mesh>

    <!-- 叶簇（六期：真实叶片卡片，由 buildLeafClusters 编程层 InstancedMesh 渲染，
         这里不再渲染球体叶子；叶簇随 Group 一起参与悬停/选中缩放） -->

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
    ref="controlsRef"
    :make-default="true"
    :enable-damping="true"
    :damping-factor="0.05"
    :min-distance="8"
    :max-distance="120"
    :max-polar-angle="Math.PI / 2.05"
    :target="[0, 3, 0]"
  />
</template>


