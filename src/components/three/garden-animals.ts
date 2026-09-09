/**
 * garden-animals.ts — 茶园小动物（零外部模型，全程序化）
 * 1. 蝴蝶 2 只：双翅扑动 + 绕茶丛正弦游荡（参考 threejs-procedural-animation：elapsed 秒驱动、分析式路径）
 * 2. 蜜蜂 2 只：小椭圆身 + 高频扑翅，绕野花丛
 * 3. 飞鸟 2 只：远处高空弧线掠过 + 扑翼
 *
 * 所有运动使用 elapsed seconds（帧率无关），固定种子保证确定性。
 */
import * as THREE from 'three'

/** 固定种子随机 */
function seededRandom(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** 生成蝴蝶翅膀贴图（亮色渐变 + 斑点） */
function createWingTexture(hue: number): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d 不可用')
  ctx.clearRect(0, 0, size, size)
  // 翅膀主体（椭圆渐变）
  const g = ctx.createRadialGradient(size * 0.45, size * 0.5, 4, size * 0.45, size * 0.5, size * 0.48)
  g.addColorStop(0, `hsla(${hue}, 85%, 88%, 0.95)`)
  g.addColorStop(0.65, `hsla(${hue}, 75%, 72%, 0.85)`)
  g.addColorStop(1, `hsla(${hue}, 70%, 55%, 0.35)`)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(size * 0.45, size * 0.5, size * 0.46, size * 0.34, 0, 0, Math.PI * 2)
  ctx.fill()
  // 斑点
  for (let i = 0; i < 5; i++) {
    const sx = size * (0.2 + seededRandom(i * 3.1 + 61) * 0.5)
    const sy = size * (0.28 + seededRandom(i * 5.3 + 62) * 0.44)
    ctx.fillStyle = `hsla(${hue + 40}, 70%, 45%, 0.55)`
    ctx.beginPath()
    ctx.arc(sx, sy, 4 + seededRandom(i * 7.7 + 63) * 5, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface Butterfly {
  group: THREE.Group
  wingL: THREE.Mesh
  wingR: THREE.Mesh
  radius: number
  height: number
  speed: number
  phase: number
  wingFreq: number
}

interface Bee {
  group: THREE.Group
  wingL: THREE.Mesh
  wingR: THREE.Mesh
  radius: number
  height: number
  speed: number
  phase: number
}

interface Bird {
  group: THREE.Group
  wingL: THREE.Mesh
  wingR: THREE.Mesh
  speed: number
  yBase: number
  yAmp: number
  phase: number
  flapFreq: number
  direction: number
}

export interface GardenAnimals {
  update: (elapsed: number) => void
  dispose: () => void
}

/** 创建茶园小动物并挂到场景 */
export function createAnimals(scene: THREE.Scene): GardenAnimals {
  const root = new THREE.Group()
  root.name = 'animals'
  scene.add(root)

  // 共享翅膀几何：小平面（根部在原点，向外展开）
  const wingGeo = new THREE.PlaneGeometry(0.7, 0.56)
  wingGeo.translate(0.35, 0, 0)

  // ---- 蝴蝶 2 只：白/黄 ----
  const butterflies: Butterfly[] = []
  const butterflyHues = [48, 15]
  for (let i = 0; i < 2; i++) {
    const group = new THREE.Group()
    const hue = butterflyHues[i] ?? 48
    const wingTex = createWingTexture(hue)
    const wingMat = new THREE.MeshStandardMaterial({
      map: wingTex,
      alphaTest: 0.28, // Basic+map 在本渲染管线不渲染，用 Standard+emissive（云/晨雾实证可渲染）
      emissive: 0xffffff,
      emissiveMap: wingTex,
      emissiveIntensity: 0.35, // 避免 Bloom 过曝成白块
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    })
    const wingL = new THREE.Mesh(wingGeo, wingMat)
    wingL.scale.x = -1 // 左翅镜像（根仍在中轴）
    wingL.position.x = -0.01
    const wingR = new THREE.Mesh(wingGeo, wingMat)
    wingR.position.x = 0.01
    // 身体：细长深色锥
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x2a2320 })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.2, 5), bodyMat)
    body.rotation.z = Math.PI / 2
    group.add(wingL, wingR, body)
    group.position.set(0, 4, 0)
    root.add(group)
    butterflies.push({
      group,
      wingL,
      wingR,
      radius: 6 + seededRandom(i * 4.1 + 71) * 4,
      height: 3.5 + seededRandom(i * 6.3 + 72) * 2.5,
      speed: 0.28 + seededRandom(i * 8.7 + 73) * 0.12,
      phase: seededRandom(i * 10.1 + 74) * Math.PI * 2,
      wingFreq: 18 + seededRandom(i * 3.9 + 75) * 6,
    })
  }

  // ---- 蜜蜂 2 只：更小，快速扑翅 ----
  const bees: Bee[] = []
  for (let i = 0; i < 2; i++) {
    const group = new THREE.Group()
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.35, // 避免 Bloom 过曝成白块
      alphaTest: 0.5,
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false,
    })
    const wingL = new THREE.Mesh(wingGeo, wingMat)
    wingL.scale.setScalar(0.8)
    wingL.scale.x = -0.8
    const wingR = new THREE.Mesh(wingGeo, wingMat)
    wingR.scale.setScalar(0.8)
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xf2c14e })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.045, 0.14, 5), bodyMat)
    body.rotation.z = Math.PI / 2
    group.add(wingL, wingR, body)
    group.position.set(0, 3, 0)
    root.add(group)
    bees.push({
      group,
      wingL,
      wingR,
      radius: 3 + seededRandom(i * 2.7 + 81) * 3,
      height: 1.8 + seededRandom(i * 5.1 + 82) * 1.2,
      speed: 0.9 + seededRandom(i * 7.3 + 83) * 0.4,
      phase: seededRandom(i * 9.9 + 84) * Math.PI * 2,
    })
  }

  // ---- 飞鸟 2 只：远处高空弧线掠过 ----
  const birds: Bird[] = []
  for (let i = 0; i < 2; i++) {
    const group = new THREE.Group()
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x2e3336, side: THREE.DoubleSide })
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.32), wingMat)
    wingL.position.x = -0.75
    wingL.rotation.z = 0.28
    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.32), wingMat)
    wingR.position.x = 0.75
    wingR.rotation.z = -0.28
    group.add(wingL, wingR)
    group.position.set(-60, 20 + seededRandom(i + 91) * 6, -35 - seededRandom(i * 3.3 + 92) * 15)
    root.add(group)
    birds.push({
      group,
      wingL,
      wingR,
      speed: 6 + seededRandom(i * 4.7 + 93) * 3,
      yBase: 20 + seededRandom(i * 6.1 + 94) * 5,
      yAmp: 2 + seededRandom(i * 8.3 + 95) * 2,
      phase: seededRandom(i * 9.5 + 96) * Math.PI * 2,
      flapFreq: 4.5 + seededRandom(i * 2.7 + 97) * 1.5,
      direction: i % 2 === 0 ? 1 : -1,
    })
  }

  let disposed = false
  return {
    update(elapsed: number) {
      if (disposed) return
      // 蝴蝶：绕 (0, height, 0) 圆游荡 + 上下起伏 + 扑翅
      for (const b of butterflies) {
        const t = elapsed * b.speed
        const angle = t + b.phase
        const x = Math.cos(angle) * b.radius
        const z = Math.sin(angle) * b.radius
        const y = b.height + Math.sin(elapsed * 0.8 + b.phase * 2) * 0.9
        b.group.position.set(x, y, z)
        // 面朝前进方向
        b.group.rotation.y = -angle + Math.PI / 2
        // 扑翅：左右反向翻转（近垂直扑动）
        const flap = Math.sin(elapsed * b.wingFreq) * 0.85
        b.wingL.rotation.y = -flap
        b.wingR.rotation.y = flap
      }
      // 蜜蜂：小半径快游 + 高频扑翅 + 轻微摇摆
      for (const b of bees) {
        const t = elapsed * b.speed
        const angle = t + b.phase
        const x = Math.cos(angle) * b.radius
        const z = Math.sin(angle * 1.3) * b.radius * 0.7
        const y = b.height + Math.sin(elapsed * 1.6 + b.phase) * 0.5
        b.group.position.set(x, y, z)
        b.group.rotation.y = -angle + Math.PI / 2
        b.group.rotation.z = Math.sin(elapsed * 3 + b.phase) * 0.15
        const flap = Math.sin(elapsed * 42) * 0.9
        b.wingL.rotation.y = -flap
        b.wingR.rotation.y = flap
      }
      // 飞鸟：x 方向直线掠过 + 上下起伏 + 扑翼，出界回绕
      for (const b of birds) {
        const span = 190
        const x = ((((elapsed * b.speed * b.direction) % span) + span) % span) - 95
        const y = b.yBase + Math.sin(elapsed * 0.9 + b.phase) * b.yAmp
        b.group.position.set(x, y, b.group.position.z)
        b.group.rotation.z = 0.1 + Math.sin(elapsed * b.flapFreq + b.phase) * 0.28
        b.group.rotation.y = b.direction > 0 ? 0 : Math.PI
        // 左右翅相对扑动
        const flap = Math.sin(elapsed * b.flapFreq + b.phase) * 0.35
        b.wingL.rotation.z = 0.28 + flap
        b.wingR.rotation.z = -0.28 - flap
      }
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
      root.removeFromParent()
    },
  }
}
