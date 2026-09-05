<script setup lang="ts">
/**
 * TeaBrewSceneInner — TresCanvas 内部场景内容（必须在 TresCanvas 内使用 useLoop）。
 * 负责：夜色暖光环境 + 程序化茶具 + 蒸汽/炉火 + 阶段联动。
 *
 * 注意（TresJS 5 坑）：Tres 元素的 rotation 是只读属性，直接传 Vector3 实例会触发
 * "Cannot assign to read only property 'rotation'" 海量报错 → 必须传 [x,y,z] 数组字面量。
 */
import { computed, onMounted, ref, shallowRef, toRef, watch } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core'
import * as THREE from 'three'
import { BrewPhase } from '@/types/brewing'
import { useBrewAnimation, smoothstep } from '@/composables/useBrewAnimation'
import bgUrl from '@/assets/tearoom-bg.jpg'
import zishaUrl from '@/assets/zisha-albedo.jpg'
import porcelainUrl from '@/assets/blue-white-porcelain.jpg'

// 场景背景：夜色暖光茶室实景（程序生成，贴合「夜色暖光·炭火煮茶」基调）。
// 作为 scene.background 铺满视口，3D 桌面/茶具位于其前，露出远景暖光，消除"浮空"感。
// 注意：直接在 setup 赋值 scene.background 不生效，需在 onRender 每帧强制设置（TresJS 渲染循环持有 scene）。
const sceneCtx = useTresContext()
let bgTex: THREE.Texture | null = null
{
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    bgTex = tex
    const scene = sceneCtx.scene.value
    if (scene) {
      scene.background = tex
    }
  }
  img.onerror = () => console.warn('[TeaBrewScene] 背景图加载失败，回退纯色背景')
  img.src = bgUrl
}

// 陶壶紫砂贴图：照片级紫砂泥材质（细密砂砾颗粒/哑光温润），替代纯色，提升茶壶真实感。
// Image → Canvas → CanvasTexture 异步加载，加载完成后经 shallowRef 响应更新材质 map。
const zishaTex = shallowRef<THREE.Texture | null>(null)
{
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    zishaTex.value = tex
  }
  img.onerror = () => console.warn('[TeaBrewScene] 紫砂贴图加载失败，回退纯色')
  img.src = zishaUrl
}

// 盖碗青花瓷贴图：白底蓝花缠枝莲纹（参考真实青花瓷盖碗），替代纯色白瓷，强化茶文化特色与真实感。
const porcelainTex = shallowRef<THREE.Texture | null>(null)
{
  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    porcelainTex.value = tex
  }
  img.onerror = () => console.warn('[TeaBrewScene] 青花瓷贴图加载失败，回退纯色')
  img.src = porcelainUrl
}

// 贴图异步加载完成后，遍历场景按材质颜色定位陶壶/盖碗，手动设置 map + needsUpdate。
// 原因：TresJS 模板材质 :map 绑定异步 shallowRef 纹理时，部分版本不会自动触发材质更新，导致贴图不显示。
watch([zishaTex, porcelainTex], () => {
  const scene = sceneCtx.scene.value
  if (!scene) return
  scene.traverse((obj: any) => {
    if (!obj.isMesh || !obj.material) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      if (!m.color) continue
      const hex = m.color.getHexString()
      if (hex === '8a6b48' && zishaTex.value) {
        m.map = zishaTex.value
        m.needsUpdate = true
      }
      if (hex === 'f5f1e8' && porcelainTex.value) {
        m.map = porcelainTex.value
        m.needsUpdate = true
      }
    }
  })
})

const props = defineProps<{
  phase: BrewPhase
  soupColor: string
  currentTemp: number
  targetTemp: number
  isPouringOut: boolean
  infusion: number
}>()

// 泡茶动画状态机（入水/放茶/闷泡/倒茶/喝茶）
const anim = useBrewAnimation(toRef(props, 'phase'), toRef(props, 'isPouringOut'))

// ==================== 坐标常量（position/scale 用 Vector3 实例；rotation 一律用数组） ====================
const camPos = new THREE.Vector3(0, 2.4, 5.6)
const camLook = new THREE.Vector3(0, 1.35, 0)
const keyLightPos = new THREE.Vector3(3.2, 5.5, 4)
const rimLightPos = new THREE.Vector3(-3, 2, -2)
const floorPos = new THREE.Vector3(0, -0.001, 1.5)
const tablePos = new THREE.Vector3(0, 1.1, 0)
const clothPos = new THREE.Vector3(0, 1.19, 0)
const legPositions: THREE.Vector3[] = [
  new THREE.Vector3(-2, 0.55, -0.9),
  new THREE.Vector3(2, 0.55, -0.9),
  new THREE.Vector3(-2, 0.55, 0.9),
  new THREE.Vector3(2, 0.55, 0.9),
]
const gaiwanPos = new THREE.Vector3(0.85, 1.19, 0)
const gaiwanScale = new THREE.Vector3(0.24, 0.24, 0.24)
const liquidPos = new THREE.Vector3(0, 0.68, 0)
// 盖碗盖子位置（闷泡时下移盖上碗口）
const lidPosition = computed(() =>
  new THREE.Vector3(0, 0.98 - 0.3 * smoothstep(anim.steep.value), 0),
)
// 品茗杯（黑釉，倒茶/喝茶动画用）
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
// 品茗杯液面（倒茶时上升，喝茶时减少）
const teacupLiquidScale = computed(() => {
  const poured = 0.1 + smoothstep(anim.pourOut.value) * 0.8
  const drunk = smoothstep(anim.drink.value) * 0.3
  return new THREE.Vector3(1, Math.max(0.05, poured - drunk), 1)
})
const teacupLiquidOpacity = computed(() => Math.min(1, anim.pourOut.value * 2))
// 品茗杯位置（喝茶时端起：向上+向相机方向移动）
const teacupPosition = computed(() =>
  teacupPos.clone().add(
    new THREE.Vector3(
      0,
      0.3 * smoothstep(anim.drink.value),
      -0.2 * smoothstep(anim.drink.value),
    ),
  ),
)
// 品茗杯旋转（喝茶时向后倾斜模拟端起）
const teacupRotation = computed<[number, number, number]>(() => [
  0.2 * smoothstep(anim.drink.value),
  0,
  0,
])
// 茶汤水流位置：盖碗碗口到品茗杯中心的中点（倒茶动画）
const teaStreamPos = computed(() => {
  const gaiwanSpout = new THREE.Vector3(gaiwanPos.x + 0.3, gaiwanPos.y + 0.4, gaiwanPos.z)
  const teacupCenter = new THREE.Vector3(teacupPos.x, teacupPos.y + 0.2, teacupPos.z)
  return gaiwanSpout.clone().add(teacupCenter).multiplyScalar(0.5)
})
const kettlePos = new THREE.Vector3(-1.15, 1.465, 0)
const kettleScale = new THREE.Vector3(0.24, 0.24, 0.24)
const kettleLidPos = new THREE.Vector3(0, 1.62, 0)
const knobPos = new THREE.Vector3(0, 1.78, 0)
const spoutPos = new THREE.Vector3(1.35, 1.05, 0)
const handlePos = new THREE.Vector3(-1.35, 0.95, 0)
const stovePos = new THREE.Vector3(-1.15, 1.19, 0)
const stoveBasePos = new THREE.Vector3(0, 0.1375, 0)
const flameLightPos = new THREE.Vector3(0, 0.45, 0)
const streamPos = new THREE.Vector3(0.1, 1.0, 0)
// 注水流位置：壶嘴到盖碗中心的中点（入水动画用）
const waterStreamPos = computed(() => {
  const spoutWorld = new THREE.Vector3(
    kettlePos.x + 0.5,
    kettlePos.y + 0.3,
    kettlePos.z,
  )
  const gaiwanCenter = new THREE.Vector3(gaiwanPos.x, gaiwanPos.y + 0.3, gaiwanPos.z)
  return spoutWorld.clone().add(gaiwanCenter).multiplyScalar(0.5)
})
// 盖碗液面 scale（入水时液面上升）
const liquidScale = computed(() =>
  new THREE.Vector3(1, 0.3 + smoothstep(anim.pourWater.value) * 0.5, 1),
)
// 茶则位置（从旁侧移入盖碗上方，放茶动画）
const teaScoopPos = computed(() => {
  const start = new THREE.Vector3(1.8, 1.6, 0)
  const end = new THREE.Vector3(gaiwanPos.x + 0.2, gaiwanPos.y + 0.8, gaiwanPos.z)
  return start.clone().lerp(end, smoothstep(anim.addLeaves.value))
})
// 茶叶粒子（放茶动画：80 个绿色粒子从盖碗上方落入）
const TEA_LEAVES_COUNT = 80
const teaLeavesPoints = shallowRef<THREE.Points | null>(null)
const teaLeavesVelocities: THREE.Vector3[] = []

function initTeaLeaves() {
  const positions = new Float32Array(TEA_LEAVES_COUNT * 3)
  for (let i = 0; i < TEA_LEAVES_COUNT; i++) {
    positions[i * 3] = gaiwanPos.x + 0.2 + (Math.random() - 0.5) * 0.3
    positions[i * 3 + 1] = gaiwanPos.y + 0.8 + Math.random() * 0.1
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.2
    teaLeavesVelocities.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        -0.5 - Math.random() * 0.5,
        (Math.random() - 0.5) * 0.2,
      ),
    )
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: '#5a7a3a',
    size: 0.03,
    transparent: true,
    opacity: 0.9,
  })
  teaLeavesPoints.value = new THREE.Points(geo, mat)
  teaLeavesPoints.value.visible = false
}

onMounted(() => {
  initTeaLeaves()
})
// 空间纵深元素（茶柜 / 挂轴 / 炭火暖光斑）
const cabinetPos = new THREE.Vector3(-3.2, 1.55, -2.2)
const shelfPos = new THREE.Vector3(0, 1.75, -2.15)
const scrollPos = new THREE.Vector3(2.4, 2.6, -2.35)
const glowPos = new THREE.Vector3(-1.15, 0.012, 0)

// 火焰片布局（位置 + 绕 Z 旋转；rotation 用数组字面量）
const flameSlots: { pos: THREE.Vector3; rot: [number, number, number] }[] = [
  { pos: new THREE.Vector3(-0.32, 0.3, 0.05), rot: [0, 0, -0.12] },
  { pos: new THREE.Vector3(-0.16, 0.3, -0.05), rot: [0, 0, 0.06] },
  { pos: new THREE.Vector3(0, 0.3, 0), rot: [0, 0, 0] },
  { pos: new THREE.Vector3(0.16, 0.3, -0.05), rot: [0, 0, -0.06] },
  { pos: new THREE.Vector3(0.32, 0.3, 0.05), rot: [0, 0, 0.12] },
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

// ==================== 程序化资源：茶席质感与空间纵深纹理 ====================
// 全部 Canvas 2D 程序化生成（零外部素材）：木纹 / 布褶高度图 / 陶土颗粒 / 挂轴 / 暖光斑
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
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

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
    const x2 = x + (Math.random() - 0.5) * len
    const y2 = y + (Math.random() - 0.5) * len * 0.4
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + (Math.random() - 0.5) * len, y + (Math.random() - 0.5) * len * 0.4, x2, y2)
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

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

const woodTex = makeWoodTexture()
const fabricBump = makeFabricBumpTexture()
const potBump = makePotBumpTexture()
const scrollTex = makeScrollTexture()
const warmGlowTex = makeWarmGlowTexture()

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
  // 更新泡茶动画状态
  anim.update(delta)
  // 水壶倾斜：入水时向盖碗倾斜（负方向）；出汤时水壶不动，由盖碗倾斜倒茶
  tiltTarget = -0.44 * smoothstep(anim.pourWater.value)
  // 每帧强制设置场景背景（TresJS 渲染循环持有 scene，直接 setup 赋值不生效）
  if (bgTex && sceneCtx.scene.value && sceneCtx.scene.value.background !== bgTex) {
    sceneCtx.scene.value.background = bgTex
  }
  // 闷泡时蒸汽增强（基于 anim.steep progress）
  if (anim.steep.value > 0.1) {
    steamTargetOpacity = Math.max(steamTargetOpacity, 0.35 + anim.steep.value * 0.25)
  }

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

  // 茶叶粒子：放茶时重力下落，落入盖碗后停止
  if (teaLeavesPoints.value) {
    if (anim.addLeaves.value > 0.1) {
      teaLeavesPoints.value.visible = true
      const posAttr = teaLeavesPoints.value.geometry.attributes.position
      if (posAttr) {
        const attr = posAttr as THREE.BufferAttribute
        for (let i = 0; i < TEA_LEAVES_COUNT; i++) {
          const vel = teaLeavesVelocities[i]
          if (!vel) continue
          attr.setX(i, attr.getX(i) + vel.x * delta)
          attr.setY(i, attr.getY(i) + vel.y * delta)
          attr.setZ(i, attr.getZ(i) + vel.z * delta)
          // 落入盖碗后停止
          if (attr.getY(i) < gaiwanPos.y + 0.2) {
            attr.setY(i, gaiwanPos.y + 0.2)
            vel.set(0, 0, 0)
          }
        }
        attr.needsUpdate = true
      }
    } else {
      teaLeavesPoints.value.visible = false
    }
  }

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

  <!-- 茶室环境：背景由 scene.background 提供（夜色暖光茶室实景图），不再需要 3D 墙。
       仅保留地面承接茶席光影。 -->
  <TresMesh :position="floorPos" :rotation="[-Math.PI / 2, 0, 0]">
    <TresPlaneGeometry :args="[12, 8]" />
    <TresMeshStandardMaterial :color="'#1a140f'" :roughness="0.95" />
  </TresMesh>

  <!-- 木桌 + 茶席布 + 桌腿 -->
  <TresMesh :position="tablePos">
    <TresBoxGeometry :args="[4.4, 0.16, 2.2]" />
    <TresMeshStandardMaterial :color="'#4a3626'" :map="woodTex" :roughness="0.65" :metalness="0.02" />
  </TresMesh>
  <TresMesh :position="clothPos" :rotation="[-Math.PI / 2, 0, 0]">
    <TresPlaneGeometry :args="[3, 1.3]" />
    <TresMeshStandardMaterial :color="'#cbb68a'" :roughness="0.9" :bump-map="fabricBump" :bump-scale="0.06" :side="THREE.DoubleSide" />
  </TresMesh>
  <TresMesh v-for="(leg, i) in legPositions" :key="i" :position="leg">
    <TresBoxGeometry :args="[0.14, 1.1, 0.14]" />
    <TresMeshStandardMaterial :color="'#3f3020'" :roughness="0.8" />
  </TresMesh>

  <!-- 盖碗（碗身 + 碗内茶汤 + 碗盖） -->
  <TresGroup
    :position="gaiwanPos"
    :scale="gaiwanScale"
    :rotation="[0, 0, 0.52 * smoothstep(anim.pourOut.value)]"
  >
    <TresMesh>
      <TresLatheGeometry :args="[bowlPts, 48]" />
      <TresMeshStandardMaterial :color="'#f5f1e8'" :roughness="0.35" :metalness="0.05" :map="porcelainTex" />
    </TresMesh>
    <TresMesh :position="liquidPos" :scale="liquidScale">
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
    <TresMesh :position="lidPosition">
      <TresSphereGeometry :args="[1.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3]" />
      <TresMeshStandardMaterial :color="'#f5f1e8'" :roughness="0.35" :metalness="0.05" :map="porcelainTex" />
    </TresMesh>
  </TresGroup>

  <!-- 茶壶（壶身 + 盖 + 壶钮 + 嘴 + 把） -->
  <TresGroup ref="kettleGroup" :position="kettlePos" :scale="kettleScale">
    <TresMesh>
      <TresLatheGeometry :args="[potPts, 48]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" :map="zishaTex" :bump-map="potBump" :bump-scale="0.05" />
    </TresMesh>
    <TresMesh :position="kettleLidPos">
      <TresSphereGeometry :args="[0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.6]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" :map="zishaTex" :bump-map="potBump" :bump-scale="0.05" />
    </TresMesh>
    <TresMesh :position="knobPos">
      <TresSphereGeometry :args="[0.16, 16, 12]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" :map="zishaTex" :bump-map="potBump" :bump-scale="0.05" />
    </TresMesh>
    <TresMesh :position="spoutPos" :rotation="[0, 0, -Math.PI / 5]">
      <TresCylinderGeometry :args="[0.16, 0.3, 1.1, 16]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" :map="zishaTex" :bump-map="potBump" :bump-scale="0.05" />
    </TresMesh>
    <TresMesh :position="handlePos" :rotation="[0, 0, Math.PI / 2.3]">
      <TresTorusGeometry :args="[0.55, 0.13, 12, 24, Math.PI * 1.1]" />
      <TresMeshStandardMaterial :color="'#8a6b48'" :roughness="0.55" :metalness="0.05" :map="zishaTex" :bump-map="potBump" :bump-scale="0.05" />
    </TresMesh>
  </TresGroup>

  <!-- 注水流（从壶嘴到盖碗，入水动画） -->
  <TresMesh
    :position="waterStreamPos"
    :rotation="[0, 0, Math.PI / 2]"
    :visible="anim.pourWater.value > 0.05"
  >
    <TresCylinderGeometry :args="[0.025, 0.045, 2.0, 8]" />
    <TresMeshBasicMaterial
      :color="'#a8d8f0'"
      :transparent="true"
      :opacity="0.7 * anim.pourWater.value"
    />
  </TresMesh>

  <!-- 炉 + 火焰片 + 炉火光 -->
  <TresGroup :position="stovePos">
    <TresMesh :position="stoveBasePos">
      <TresCylinderGeometry :args="[0.55, 0.65, 0.275, 32]" />
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
      <TresConeGeometry :args="[0.09, 0.35, 8]" />
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

  <!-- 茶则（放茶叶用，放茶动画） -->
  <TresMesh
    :position="teaScoopPos"
    :rotation="[0, 0, -0.2]"
    :visible="anim.addLeaves.value > 0.05"
  >
    <TresBoxGeometry :args="[0.45, 0.02, 0.28]" />
    <TresMeshStandardMaterial :color="'#8b6f47'" :roughness="0.6" />
  </TresMesh>

  <!-- 品茗杯（黑釉，倒茶/喝茶动画用） -->
  <TresGroup :position="teacupPosition" :scale="teacupScale" :rotation="teacupRotation">
    <!-- 杯身 -->
    <TresMesh>
      <TresLatheGeometry :args="[teacupPts, 32]" />
      <TresMeshStandardMaterial
        :color="'#1a0f08'"
        :roughness="0.12"
        :metalness="0.15"
      />
    </TresMesh>
    <!-- 杯内茶汤（初始空杯，倒茶时显示） -->
    <TresMesh :position="teacupLiquidPos" :scale="teacupLiquidScale">
      <TresCylinderGeometry :args="[0.32, 0.34, 0.04, 32]" />
      <TresMeshStandardMaterial
        :color="props.soupColor"
        :roughness="0.2"
        :transparent="true"
        :opacity="teacupLiquidOpacity"
      />
    </TresMesh>
  </TresGroup>

  <!-- 茶汤水流（从盖碗到品茗杯，倒茶动画） -->
  <TresMesh
    :position="teaStreamPos"
    :rotation="[0, 0, Math.PI / 2]"
    :visible="anim.pourOut.value > 0.05"
  >
    <TresCylinderGeometry :args="[0.02, 0.035, 1.2, 8]" />
    <TresMeshBasicMaterial
      :color="props.soupColor"
      :transparent="true"
      :opacity="0.8 * anim.pourOut.value"
    />
  </TresMesh>

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

  <!-- 茶叶粒子（放茶动画） -->
  <TresPrimitive v-if="teaLeavesPoints" :object="teaLeavesPoints" />
</template>
