/**
 * garden-ambient.ts — 茶园环境氛围层（零外部依赖，全程序化）
 * 1. 远处云朵（横置 Mesh 平面 + emissive 云贴图，慢速摆荡）
 * 2. 山谷晨雾（低层半透明雾带，左右流动 + 上下微浮）
 *
 * 参考：
 * - threejs-volumetric-clouds 技能（云影作为独立低成本方案，不参与体积 raymarch）
 * - drei Cloud 的实例化云片思路（此处用 Mesh 平面更轻）
 *
 * 历史：云影（高空暗斑）曾反复出现"大黑片/发光片"视觉问题（用户多次反馈），
 * 于 2026-09-09 彻底移除 —— 用户要的是蓝天白云，不要地面暗影。
 */
import * as THREE from 'three'

/** 固定种子随机（确定性，便于截图复现） */
function seededRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** 生成云朵贴图（模糊椭圆簇，白-透明） */
function createCloudTexture(): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不可用')
  ctx.clearRect(0, 0, size, size)
  // 4-6 个模糊椭圆拼合成一朵云
  const puffs = 5 + Math.floor(seededRandom(7) * 2)
  for (let i = 0; i < puffs; i++) {
    const cx = size * (0.3 + seededRandom(i * 3.1 + 1) * 0.4)
    const cy = size * (0.35 + seededRandom(i * 5.7 + 2) * 0.3)
    const rx = size * (0.16 + seededRandom(i * 7.3 + 3) * 0.16)
    const ry = size * (0.08 + seededRandom(i * 9.1 + 4) * 0.09)
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx)
    g.addColorStop(0, 'rgba(255,255,255,0.85)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.42)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(1, ry / rx)
    ctx.translate(-cx, -cy)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, rx, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** 生成晨雾贴图（水平渐变白-透明，边缘柔） */
function createFogTexture(): THREE.CanvasTexture {
  const w = 512
  const h = 64
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不可用')
  ctx.clearRect(0, 0, w, h)
  // 水平方向若干随机波动的白色带
  for (let i = 0; i < 6; i++) {
    const y = h * (0.15 + seededRandom(i * 2.3 + 21) * 0.7)
    const gh = h * (0.35 + seededRandom(i * 4.1 + 22) * 0.5)
    const g = ctx.createLinearGradient(0, y - gh / 2, 0, y + gh / 2)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.5, `rgba(240,244,238,${0.3 + seededRandom(i * 6.7 + 23) * 0.25})`)
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, y - gh / 2, w, gh)
  }
  // 左右边缘羽化
  const edge = ctx.createLinearGradient(0, 0, w, 0)
  edge.addColorStop(0, 'rgba(0,0,0,1)')
  edge.addColorStop(0.12, 'rgba(0,0,0,0)')
  edge.addColorStop(0.88, 'rgba(0,0,0,0)')
  edge.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, w, h)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface CloudSprite {
  mesh: THREE.Mesh
  speed: number
  baseX: number
  baseY: number
  baseZ: number
  radius: number
}

interface FogBand {
  mesh: THREE.Mesh
  speed: number
  baseX: number
  baseY: number
  phase: number
  amp: number
  range: number
}

export interface GardenAmbient {
  update: (elapsed: number, delta: number) => void
  setFogVisible: (v: boolean) => void
  dispose: () => void
}

/** 创建茶园环境氛围层并挂到场景（camera 用于云朵 billboard 朝向） */
export function createAmbient(scene: THREE.Scene, camera: THREE.Camera): GardenAmbient {
  const root = new THREE.Group()
  root.name = 'ambient'
  scene.add(root)

  // ---- 云朵：5 朵 Mesh 平面缓慢漂移（每帧 billboard 朝向相机） ----
  // 注意：本项目渲染管线（TresCanvas + SSAO/Bloom）中 MeshBasicMaterial+map 不渲染、
  // transparent:true 对象不渲染；改用 MeshStandardMaterial + emissive + alphaTest（与叶片同款已验证）
  const cloudTex = createCloudTexture()
  const clouds: CloudSprite[] = []
  // 相机默认位于 (30,23,30) 看向原点（俯角 24.3°）。实测：云必须近处 + 横置 + renderOrder>0
  // （renderOrder 0 的 alphaTest 平面在本 SSAO/Bloom 管线不渲染，晨雾 renderOrder=2 可见）
  const camAngle = -Math.PI * 0.75
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshStandardMaterial({
      map: cloudTex,
      alphaTest: 0.18,
      emissive: 0xd8e4f0,
      emissiveMap: cloudTex,
      emissiveIntensity: 0.6,
      roughness: 1,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false, // 云不被场景雾洗白
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
    const radius = 22 + seededRandom(i * 3.3 + 33) * 12
    const angle = camAngle + (seededRandom(i * 7.7 + 34) - 0.5) * 1.2
    const s = 40 + seededRandom(i * 9.3 + 35) * 22
    // 横置平面（水平云片，真实云形态；实测 lookAt 版垂直云片在 SSAO 管线不可见）
    mesh.scale.set(s * (1.9 + seededRandom(i + 36) * 0.6), 1, s)
    mesh.rotation.x = -Math.PI / 2
    mesh.renderOrder = 3
    const pos = {
      x: Math.cos(angle) * radius,
      y: 12 + seededRandom(i * 4.7 + 37) * 6,
      z: Math.sin(angle) * radius,
    }
    mesh.position.set(pos.x, pos.y, pos.z)
    root.add(mesh)
    clouds.push({ mesh, speed: 0.15 + seededRandom(i * 6.1 + 38) * 0.1, baseX: pos.x, baseY: pos.y, baseZ: pos.z, radius })
  }

  // ---- 晨雾：3 层低处雾带（横置平面，左右流动 + 上下微浮；Standard+emissive 自发光白雾） ----
  // 注意：雾带必须收敛在山谷低处（近处大平面会盖住上方天空的云）
  const fogTex = createFogTexture()
  const fogBands: FogBand[] = []
  const fogYs = [0.9, 1.7, 2.4]
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshStandardMaterial({
      map: fogTex,
      alphaTest: 0.18,
      emissive: 0xdce6ee,
      emissiveMap: fogTex,
      emissiveIntensity: 0.09,
      roughness: 1,
      metalness: 0,
      depthWrite: false,
      fog: false,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 16), mat)
    mesh.rotation.x = -Math.PI / 2
    // 收敛到远处山谷（近处大雾带会盖住茶丛与动物）
    mesh.position.set(seededRandom(i * 4.3 + 52) * 30 - 20, fogYs[i] ?? 1.7, seededRandom(i * 6.1 + 53) * 24 - 32)
    mesh.renderOrder = 2
    // 默认隐藏：晨雾为雨天专属（晴天蓝天下会成"白色地块"，用户多次反馈）
    mesh.visible = false
    root.add(mesh)
    fogBands.push({
      mesh,
      speed: 1.1 + seededRandom(i * 3.5 + 54) * 0.9,
      baseX: mesh.position.x,
      baseY: mesh.position.y,
      phase: seededRandom(i * 5.9 + 55) * Math.PI * 2,
      amp: 0.25 + seededRandom(i * 7.7 + 56) * 0.2,
      range: 24,
    })
  }

  let disposed = false
  return {
    update(elapsed: number) {
      if (disposed) return
      // 云朵：围绕初始角慢速摆荡（±26°，永不出水平视锥；单调漂移会在 20s 后漂出视锥导致"消失"）
      for (const c of clouds) {
        const t = Math.sin(elapsed * c.speed) * 0.45
        const angle = Math.atan2(c.baseZ, c.baseX) + t
        c.mesh.position.set(Math.cos(angle) * c.radius, c.baseY + Math.sin(elapsed * 0.22 + c.baseX) * 0.8, Math.sin(angle) * c.radius)
      }
      // 晨雾：左右流动 + 上下微浮
      for (const f of fogBands) {
        const offset = Math.sin(elapsed * f.speed * 0.1 + f.phase) * f.range
        f.mesh.position.x = f.baseX + offset
        f.mesh.position.y = f.baseY + Math.sin(elapsed * 0.4 + f.phase) * f.amp
      }
    },
    setFogVisible(v: boolean) {
      for (const f of fogBands) f.mesh.visible = v
    },
    dispose() {
      disposed = true
      root.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const m = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose())
        else m?.dispose()
      })
      cloudTex.dispose()
      fogTex.dispose()
      root.removeFromParent()
    },
  }
}
