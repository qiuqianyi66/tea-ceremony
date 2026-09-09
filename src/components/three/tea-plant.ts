/**
 * tea-plant.ts — 茶树系统（程序化茶树 + 叶片化渲染 + 位置生态约束）
 *
 * 包含：确定性随机 / 生长阶段视觉配置 / 叶片分布 / 树皮与叶片贴图 / 叶簇层重建
 * 位置约束：《茶经》土壤三品 —— 只种砾壤带（中坡 4-10m），谷底黄土/高坡烂石/排水沟不种
 */
import * as THREE from 'three'
import { getTerrainHeight } from './terrain'

/** 基于种子的确定性伪随机 */
export function seededRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** 生长阶段视觉配置 */
export interface StageVisual {
  scale: number
  leafCount: number
  leafColor: string
  trunkHeight: number
  trunkRadius: number
  crownRadius: number
  hasGlow: boolean
}

export const STAGE_VISUALS: Record<string, StageVisual> = {
  // 绝对尺寸（1 单位 ≈ 1 米）：低矮茶丛灌木，成熟约 1.6m 高
  sprout:   { scale: 1, leafCount: 12, leafColor: '#aed581', trunkHeight: 0.35, trunkRadius: 0.08, crownRadius: 0.3,  hasGlow: false },
  seedling: { scale: 1, leafCount: 24, leafColor: '#9ccc65', trunkHeight: 0.55, trunkRadius: 0.08, crownRadius: 0.45, hasGlow: false },
  growing:  { scale: 1, leafCount: 48, leafColor: '#8bc34a', trunkHeight: 0.8,  trunkRadius: 0.08, crownRadius: 0.6,  hasGlow: false },
  mature:   { scale: 1, leafCount: 80, leafColor: '#7cb342', trunkHeight: 1.05, trunkRadius: 0.08, crownRadius: 0.75, hasGlow: true },
  recovery: { scale: 1, leafCount: 36, leafColor: '#9ccc65', trunkHeight: 0.9,  trunkRadius: 0.08, crownRadius: 0.65, hasGlow: false },
  dead:     { scale: 1, leafCount: 16, leafColor: '#6d4c41', trunkHeight: 0.85, trunkRadius: 0.08, crownRadius: 0.5,  hasGlow: false },
}

/** 单叶片卡片：位置 + 朝向（四元数）+ 缩放 + 颜色 */
export interface LeafBlade {
  position: [number, number, number]
  quaternion: [number, number, number, number]
  scale: number
  /** 每片叶子的颜色（基于 seed 微调明暗，增加层次感） */
  color: string
}

export interface PlantVisual {
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

/** 基于种子生成茶树在地形上的位置（砾壤带，确保相机可见且不被山挡） */
export function getPlantPosition(seed: number): [number, number, number] {
  // 生态约束（古籍）：只种砾壤带（中坡 4-10m），谷底黄土/高坡烂石/排水沟均不种
  const MIN_H = 4.2
  const MAX_H = 9.5
  let best: [number, number, number] | null = null
  let bestScore = Infinity
  // 多次尝试：命中梯田高度且相机可见立即返回；否则记录最接近目标范围的候选
  for (let attempt = 0; attempt < 80; attempt++) {
    const x = (seededRandom(seed + attempt * 3.1 + 1) - 0.5) * 30
    const z = (seededRandom(seed + attempt * 5.7 + 2) - 0.5) * 30
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
export function getLeafBlades(seed: number, count: number, crownRadius: number, crownY: number, baseColor: string): LeafBlade[] {
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

/** 生成叶片贴图（128x128 披针形，叶脉 + 蜡质反光，透明底） */
export function createLeafBladeTexture(): THREE.CanvasTexture {
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
export function createBarkTexture(): THREE.CanvasTexture {
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

/** 叶簇层：每棵树一个 Group（含 1 个叶片 InstancedMesh），共享几何与材质 */
export interface LeafClusterLayer {
  root: THREE.Group
  byPlant: Map<number, THREE.Group>
}

/** 重建全部叶簇（plants 增删/阶段变化时调用；共享几何与材质，只重建实例矩阵） */
export function buildLeafClusters(scene: THREE.Scene, visuals: PlantVisual[], leafBladeTexture: THREE.CanvasTexture): LeafClusterLayer {
  const root = new THREE.Group()
  root.name = 'leafClusters'
  const byPlant = new Map<number, THREE.Group>()
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

  for (const plant of visuals) {
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
    byPlant.set(plant.id, group)
  }
  scene.add(root)
  return { root, byPlant }
}
