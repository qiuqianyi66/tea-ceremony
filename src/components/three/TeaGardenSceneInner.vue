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
/** 四期：渲染函数替换（后处理接管渲染循环）；五期：粒子动画钩子 */
const { render: replaceRender, onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => { updateWater(delta) })

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
const leafTexture = createLeafTexture()
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
  // 四期调优：叶子颜色整体提亮（sprout 嫩黄绿 → mature 深绿），叶片数增加使冠形更饱满
  sprout:   { scale: 1, leafCount: 3, leafColor: '#aed581', trunkHeight: 0.35, trunkRadius: 0.08, crownRadius: 0.3,  hasGlow: false },
  seedling: { scale: 1, leafCount: 4, leafColor: '#9ccc65', trunkHeight: 0.55, trunkRadius: 0.08, crownRadius: 0.45, hasGlow: false },
  growing:  { scale: 1, leafCount: 6, leafColor: '#8bc34a', trunkHeight: 0.8,  trunkRadius: 0.08, crownRadius: 0.6,  hasGlow: false },
  mature:   { scale: 1, leafCount: 9, leafColor: '#7cb342', trunkHeight: 1.05, trunkRadius: 0.08, crownRadius: 0.75, hasGlow: true },
  recovery: { scale: 1, leafCount: 5, leafColor: '#9ccc65', trunkHeight: 0.9,  trunkRadius: 0.08, crownRadius: 0.65, hasGlow: false },
  dead:     { scale: 1, leafCount: 2, leafColor: '#6d4c41', trunkHeight: 0.85, trunkRadius: 0.08, crownRadius: 0.5,  hasGlow: false },
}

interface LeafInfo {
  position: [number, number, number]
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

/** 生成叶子球的位置（围绕枝干冠部分布），每片叶子颜色基于 seed 微调明暗 */
function getLeafPositions(seed: number, count: number, crownRadius: number, crownY: number, baseColor: string): LeafInfo[] {
  const base = new THREE.Color(baseColor)
  const leaves: LeafInfo[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + seededRandom(seed + i * 7.3) * 0.9
    const dist = crownRadius * (0.35 + seededRandom(seed + i * 11.7) * 0.65)
    const y = crownY + (seededRandom(seed + i * 13.1) - 0.25) * crownRadius * 0.7
    const s = 0.65 + seededRandom(seed + i * 17.3) * 0.7
    const c = base.clone().offsetHSL(0, 0, (seededRandom(seed + i * 19.7) - 0.5) * 0.14)
    leaves.push({
      position: [Math.cos(angle) * dist, y, Math.sin(angle) * dist],
      scale: s,
      color: `#${c.getHexString()}`,
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
    const leaves = getLeafPositions(seed, config.leafCount, config.crownRadius, crownY, config.leafColor)
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

// ============ 六期写实化：程序化高细节贴图（叶片 / 树皮） ============

/**
 * 生成写实叶片贴图（256px，密集叶簇风格）：
 * 多层绿色渐变 + 叶脉网络 + 微反光斑点 + 边缘暗化。
 * 纹理无方向性，球面展开不会明显拉丝。
 */
function createLeafTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不可用')
  const rnd = (n: number) => Math.random() * n

  // 基底：径向渐变（中心亮、边缘深，模拟叶簇球体的受光层次）
  const base = ctx.createRadialGradient(128, 128, 18, 128, 128, 175)
  base.addColorStop(0, '#7fb255')
  base.addColorStop(0.45, '#55863a')
  base.addColorStop(0.85, '#3a6a2c')
  base.addColorStop(1, '#2c5322')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  // 叶脉网络：短细弧线，半透明深色
  ctx.strokeStyle = 'rgba(24,52,20,0.4)'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 26; i++) {
    const cx = 96 + rnd(64)
    const cy = 96 + rnd(64)
    const a = rnd(Math.PI * 2)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.bezierCurveTo(
      cx + Math.cos(a) * 26, cy + Math.sin(a) * 26,
      cx + Math.cos(a + 0.5) * 34, cy + Math.sin(a + 0.5) * 34,
      cx + Math.cos(a) * 42, cy + Math.sin(a) * 42
    )
    ctx.stroke()
  }

  // 微反光斑点（叶片蜡质光泽）+ 瑕疵黄点
  for (let i = 0; i < 160; i++) {
    const g = 128 + rnd(60)
    ctx.fillStyle = `rgba(${g - 30},${g},${g - 60},${0.05 + rnd(0.09)})`
    ctx.beginPath()
    ctx.arc(rnd(size), rnd(size), 1 + rnd(2.4), 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgba(168,148,64,${0.10 + rnd(0.12)})`
    ctx.beginPath()
    ctx.arc(rnd(size), rnd(size), 1.2 + rnd(2), 0, Math.PI * 2)
    ctx.fill()
  }

  // 边缘暗化（球体明暗衔接自然）
  const vign = ctx.createRadialGradient(128, 128, 58, 128, 128, 205)
  vign.addColorStop(0, 'rgba(0,0,0,0)')
  vign.addColorStop(1, 'rgba(16,36,12,0.5)')
  ctx.fillStyle = vign
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
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
  textures: { grass: THREE.Texture; mud: THREE.Texture; rock: THREE.Texture; grassNormal: THREE.Texture }
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
        diffuseColor *= sampledDiffuseColor;`
      )
  }
}

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

const WATER_PARTICLE_COUNT = 40
const WATER_MAX_LIFE = 1.5 // 秒
const WATER_GRAVITY = 5.5

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
  const mat = new THREE.PointsMaterial({
    color: 0x8ed3ff,
    size: 0.3,
    transparent: true,
    opacity: 0.9,
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
    const r = 0.4 + seededRandom(i * 3.7 + 1) * 0.9
    pos.setXYZ(
      i,
      px + Math.cos(angle) * r * 0.4,
      py + 1.3 + seededRandom(i * 7.1 + 3) * 0.7,
      pz + Math.sin(angle) * r * 0.4
    )
    velocities[i * 3] = (seededRandom(i * 11.3 + 4) - 0.5) * 1.1
    velocities[i * 3 + 1] = 0
    velocities[i * 3 + 2] = (seededRandom(i * 13.7 + 5) - 0.5) * 1.1
  }
  pos.needsUpdate = true
  waterState.value = { t: 0, maxT: WATER_MAX_LIFE, velocities }
  points.visible = true
  ;(points.material as THREE.PointsMaterial).opacity = 0.9
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

defineExpose({ playWater })

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
        applyTerrainTextures(terrain.material as THREE.MeshStandardMaterial, { grass, mud, rock, grassNormal })
      }
    })
    .catch((error: unknown) => {
      console.warn('[TeaGarden] 地形贴图加载失败，回退程序化着色:', error)
    })

  // 四期：装饰植被（石头 + 草 + 野花）挂到场景
  createDecorations(scene)

  // 五期：浇水水滴粒子系统挂到场景
  const wp = createWaterPoints()
  scene.add(wp)
  waterPoints.value = wp

  // 四期：后处理管线（SSAO + Bloom），用 useLoop().render 接管渲染循环
  const activeCam = sceneCtx.camera.activeCamera as unknown
  const cam = ((activeCam as { value?: THREE.PerspectiveCamera }).value ?? activeCam) as THREE.PerspectiveCamera
  const { composer, dispose } = setupPostProcessing(renderer, scene, cam, {
    width: () => sceneCtx.sizes.width.value,
    height: () => sceneCtx.sizes.height.value,
  })
  replaceRender(() => { composer.render() })
  onUnmounted(dispose)

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

    <!-- 叶子球（六期：写实叶片贴图 + 平滑法线 + bump，取代 flat-shading 纯色） -->
    <Mesh
      v-for="(leaf, i) in plant.leaves"
      :key="i"
      :cast-shadow="true"
      :position="leaf.position"
      :scale="leaf.scale * plant.config.scale"
    >
      <SphereGeometry :args="[0.38, 14, 12]" />
      <MeshStandardMaterial
        :map="leafTexture"
        :bump-map="leafTexture"
        :bump-scale="0.35"
        :color="leaf.color"
        :roughness="0.68"
        :emissive="leaf.color"
        :emissive-intensity="getLeafEmissive(plant.id) === '#000000' ? 0.08 : 0.45"
        :env-map-intensity="0.6"
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


