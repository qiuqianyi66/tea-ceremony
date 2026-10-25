import * as THREE from 'three'

/**
 * 冲泡 3D 场景程序化纹理（从 TeaBrewSceneInner.vue 拆出，2026-10-22 B8）。
 * 全部 Canvas 2D 程序化生成（零外部素材）：软圆点（蒸汽）/ 木纹 / 布褶高度图 /
 * 陶土颗粒 / 挂轴 / 暖光斑。纯函数 + 工厂，无 Vue 依赖，可单测。
 */

export function makeSoftCircleTexture(): THREE.CanvasTexture {
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

export function makeWoodTexture(): THREE.CanvasTexture {
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

export function makeFabricBumpTexture(): THREE.CanvasTexture {
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
    ctx.quadraticCurveTo(
      x + (Math.random() - 0.5) * len,
      y + (Math.random() - 0.5) * len * 0.4,
      x2,
      y2,
    )
    ctx.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

export function makePotBumpTexture(): THREE.CanvasTexture {
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

export function makeScrollTexture(): THREE.CanvasTexture {
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

export function makeWarmGlowTexture(): THREE.CanvasTexture {
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

/** 一次性生成场景全部程序化纹理（每次挂载生成一份，随组件生命周期）。 */
export function createBrewTextures() {
  return {
    softCircleTex: makeSoftCircleTexture(),
    woodTex: makeWoodTexture(),
    fabricBump: makeFabricBumpTexture(),
    potBump: makePotBumpTexture(),
    scrollTex: makeScrollTexture(),
    warmGlowTex: makeWarmGlowTexture(),
  }
}
