/**
 * Canvas 粒子动画系统
 * 管理火焰、蒸汽、水面涟漪三种粒子效果
 */

import { ref, onUnmounted, type Ref } from 'vue'

// ============ 类型定义 ============

type ParticleType = 'fire' | 'steam' | 'ripple'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number          // 0→1 生命周期进度
  maxLife: number       // 帧数寿命
  type: ParticleType
  color: string
  alpha: number
}

interface ParticleSystemOptions {
  width: number
  height: number
  flameIntensity?: number  // 0-1
}

// ============ 颜色工具 ============

/** 火焰色渐变：红→橙→黄 */
function fireColor(progress: number): string {
  const r = 255
  const g = Math.round(100 + progress * 155)
  const b = Math.round(progress * 50)
  return `rgb(${r}, ${g}, ${b})`
}

/** 蒸汽色：半透明白 */
const steamColor = 'rgba(230, 225, 215,'

// ============ 主组合式函数 ============

export function useParticleSystem(options: ParticleSystemOptions) {
  const { width, height } = options
  const flameIntensity = ref(options.flameIntensity ?? 1)

  const canvasRef: Ref<HTMLCanvasElement | null> = ref(null)

  let particles: Particle[] = []
  let animationId: number | null = null
  let isRunning = false

  // 粒子生成控制
  let emitFire = false
  let emitSteam = false
  let emitRipple = false
  let frameCount = 0

  // ============ 粒子生成 ============

  function addFireParticle() {
    const maxLife = 40 + Math.random() * 30
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 30,
      y: height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -(2 + Math.random() * 3) * flameIntensity.value,
      size: 4 + Math.random() * 8,
      life: 0,
      maxLife,
      type: 'fire',
      color: '',
      alpha: 0.8,
    })
  }

  function addSteamParticle() {
    const maxLife = 60 + Math.random() * 40
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 40,
      y: height * 0.25,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -(0.3 + Math.random() * 0.4),
      size: 6 + Math.random() * 10,
      life: 0,
      maxLife,
      type: 'steam',
      color: '',
      alpha: 0.3 + Math.random() * 0.15,
    })
  }

  function addRippleParticle() {
    particles.push({
      x: width / 2 + (Math.random() - 0.5) * 20,
      y: height * 0.25,
      vx: 0,
      vy: 0,
      size: 2,
      life: 0,
      maxLife: 30,
      type: 'ripple',
      color: 'rgba(180, 160, 140,',
      alpha: 0.5,
    })
  }

  // ============ 粒子更新 ============

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!
      p.life++

      if (p.life >= p.maxLife) {
        particles.splice(i, 1)
        continue
      }

      const progress = p.life / p.maxLife

      switch (p.type) {
        case 'fire':
          p.x += p.vx + (Math.random() - 0.5) * 0.5
          p.y += p.vy
          p.vy *= 0.98
          p.size *= 0.97
          p.color = fireColor(progress)
          p.alpha = (1 - progress) * 0.8
          break

        case 'steam':
          p.x += p.vx + (Math.random() - 0.5) * 0.2
          p.y += p.vy
          p.size += 0.05 // 蒸汽扩散
          p.alpha = (1 - progress) * 0.3
          break

        case 'ripple':
          p.size += 0.5
          p.alpha = (1 - progress) * 0.5
          break
      }
    }
  }

  // ============ 渲染 ============

  function render(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, width, height)

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.alpha)

      switch (p.type) {
        case 'fire': {
          ctx.shadowBlur = 10
          ctx.shadowColor = p.color
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          break
        }

        case 'steam': {
          ctx.shadowBlur = 0
          ctx.fillStyle = `${steamColor}${p.alpha})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          break
        }

        case 'ripple': {
          ctx.shadowBlur = 0
          ctx.strokeStyle = `${p.color}${p.alpha})`
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.stroke()
          break
        }
      }
    }

    // 重置 Canvas 状态
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  // ============ 主循环 ============

  function loop() {
    if (!isRunning) return
    frameCount++

    // 生成粒子
    if (emitFire && frameCount % 2 === 0) {
      addFireParticle()
      if (Math.random() > 0.5) addFireParticle()
    }
    if (emitSteam && frameCount % 4 === 0) {
      addSteamParticle()
    }
    if (emitRipple && frameCount % 15 === 0) {
      addRippleParticle()
    }

    updateParticles()

    const canvas = canvasRef.value
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) render(ctx)
    }

    animationId = requestAnimationFrame(loop)
  }

  // ============ 公共 API ============

  function start() {
    if (isRunning) return
    isRunning = true
    particles = []
    frameCount = 0
    loop()
  }

  function stop() {
    isRunning = false
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    particles = []
    // 清空画布
    const canvas = canvasRef.value
    if (canvas) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, width, height)
    }
  }

  function startFire() { emitFire = true }
  function stopFire() { emitFire = false }
  function startSteam() { emitSteam = true }
  function stopSteam() { emitSteam = false }
  function startRipple() { emitRipple = true }
  function stopRipple() { emitRipple = false }
  function setFlameIntensity(v: number) { flameIntensity.value = Math.max(0, Math.min(1, v)) }

  onUnmounted(() => {
    stop()
  })

  return {
    canvasRef,
    start,
    stop,
    startFire,
    stopFire,
    startSteam,
    stopSteam,
    startRipple,
    stopRipple,
    setFlameIntensity,
  }
}
