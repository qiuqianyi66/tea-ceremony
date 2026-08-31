/**
 * tsParticles 粒子系统 - 简化版，使用标准 API
 *
 * 特性：
 * - 火焰：使用 preset-fire
 * - 蒸汽/茶雾：使用 preset-bubbles + 自定义配置
 * - 水面涟漪：自定义发射器配置
 * - Vue 3 官方组件 <Particles />
 * - 按需引入，仅 ~35kB gzipped
 */

import { ref, onUnmounted, type Ref } from 'vue'
import { loadSlim } from '@tsparticles/slim'
import { loadFirePreset } from '@tsparticles/preset-fire'
import { loadBubblesPreset } from '@tsparticles/preset-bubbles'
import { tsParticles, type Engine, type Container } from '@tsparticles/engine'

// ============ 类型定义 ============

type ParticleMode = 'fire' | 'steam' | 'ripple' | 'idle'

interface ParticleSystemState {
  mode: ParticleMode
  isRunning: boolean
  flameIntensity: number  // 0-1
  steamIntensity: number  // 0-1
}

// ============ 配置工厂 ============

const COLOR_TEA_GOLD = '#C89B3C'
const COLOR_WOOD = '#5D4E37'
const COLOR_STEAM = '#E6E0D8'
const COLOR_RIPPLE = '#B4A08C'

function createFireOptions(width: number, height: number, intensity = 1): any {
  return {
    fpsLimit: 60,
    fullScreen: { enable: false, zIndex: 0 },
    background: { color: 'transparent' },
    particles: {
      number: { value: Math.round(60 * intensity), density: { enable: true, area: 800 } },
      color: { value: ['#FF6B00', '#FF8C00', '#FFD700', '#FFA500', '#FF4500'] },
      shape: { type: ['circle', 'triangle'] },
      opacity: { value: { min: 0.1, max: 0.8 }, animation: { enable: true, speed: 2, sync: false } },
      size: { value: { min: 2, max: 12 }, animation: { enable: true, speed: 10, sync: false, minimumValue: 0.5 } },
      move: {
        direction: 'top',
        speed: { min: 0.5, max: 2 },
        gravity: { enable: true, acceleration: 0.02 },
        drift: 0.3,
        path: { enable: true, options: { clamp: true, generator: 'perlinNoise' } },
        trail: { enable: true, length: 10, fillColor: 'transparent' },
      },
      life: { duration: { sync: false, value: { min: 1, max: 3 } } },
      shadows: { enable: true, blur: 15, color: '#FF6B00', offset: { x: 0, y: 0 } },
    },
    emitters: [
      {
        position: { x: 50, y: 95 },
        size: { width: width * 0.4, height: 10 },
        rate: { quantity: Math.round(8 * intensity), delay: 0.1 },
      },
    ],
    interactivity: {
      events: { onHover: { enable: false }, onClick: { enable: false } },
    },
    detectRetina: true,
  }
}

function createSteamOptions(width: number, height: number, intensity = 1): any {
  return {
    fpsLimit: 40,
    fullScreen: { enable: false, zIndex: 0 },
    background: { color: 'transparent' },
    particles: {
      number: { value: Math.round(15 * intensity), density: { enable: true, area: 1000 } },
      color: { value: COLOR_STEAM },
      shape: { type: 'circle' },
      opacity: { value: { min: 0.05, max: 0.35 }, animation: { enable: true, speed: 0.5, sync: false } },
      size: { value: { min: 8, max: 25 }, animation: { enable: true, speed: 3, sync: false, minimumValue: 0.1 } },
      move: {
        direction: 'top',
        speed: { min: 0.15, max: 0.4 },
        drift: 0.5,
        path: { enable: true, options: { clamp: true, generator: 'perlinNoise' } },
      },
      life: { duration: { sync: false, value: { min: 8, max: 15 } } },
    },
    emitters: [
      {
        position: { x: 50, y: 35 },
        size: { width: width * 0.6, height: 5 },
        rate: { quantity: Math.round(2 * intensity), delay: 0.5 },
      },
    ],
    interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } },
    detectRetina: true,
  }
}

function createRippleOptions(width: number, height: number): any {
  return {
    fpsLimit: 30,
    fullScreen: { enable: false, zIndex: 0 },
    background: { color: 'transparent' },
    particles: {
      number: { value: 0 },
      color: { value: COLOR_RIPPLE },
      shape: { type: 'circle' },
      opacity: { value: 0.5 },
      size: { value: 40 },
      move: { enable: false },
      life: { duration: { sync: false, value: { min: 2, max: 4 } } },
    },
    emitters: [
      {
        position: { x: 50, y: 35 },
        rate: { quantity: 1, delay: 1.5 },
      },
    ],
    interactivity: { events: { onHover: { enable: false }, onClick: { enable: false } } },
    detectRetina: true,
  }
}

// ============ 主组合式函数 ============

export function useParticleSystem(
  size: { width: number; height: number } | number = 300,
  height = 400,
) {
  const containerWidth = typeof size === 'number' ? size : size.width
  const containerHeight = typeof size === 'number' ? height : size.height
  const containerRef = ref<HTMLDivElement | null>(null)
  const state = ref<ParticleSystemState>({
    mode: 'idle',
    isRunning: false,
    flameIntensity: 1,
    steamIntensity: 1,
  })

  let engine: Engine | null = null
  let container: Container | null = null
  let initialized = false

  // ============ 初始化引擎 ============
  async function init() {
    if (initialized) return

    engine = tsParticles

    // 注册所有需要的 preset
    await loadFirePreset(engine)
    await loadBubblesPreset(engine)

    initialized = true
  }

  // ============ 创建容器 ============
  async function createContainer(mode: ParticleMode) {
    await init()
    if (!engine || !containerRef.value) return

    // 销毁旧容器
    if (container) {
      await container.destroy()
      container = null
    }

    let options: any

    switch (mode) {
      case 'fire':
        options = createFireOptions(containerWidth, containerHeight, state.value.flameIntensity)
        break
      case 'steam':
        options = createSteamOptions(containerWidth, containerHeight, state.value.steamIntensity)
        break
      case 'ripple':
        options = createRippleOptions(containerWidth, containerHeight)
        break
      default:
        return
    }

    container = (await engine.load({
      id: `tea-particles-${mode}`,
      element: containerRef.value,
      options,
    })) ?? null

    state.value.mode = mode
    state.value.isRunning = true
  }

  // ============ 公共 API ============

  /** 启动火焰 (电陶炉加热) */
  function startFire(intensity = 1) {
    state.value.flameIntensity = Math.max(0, Math.min(1, intensity))
    return createContainer('fire')
  }

  /** 停止火焰 */
  async function stopFire() {
    if (container && state.value.mode === 'fire') {
      await container.destroy()
      container = null
      state.value.mode = 'idle'
      state.value.isRunning = false
    }
  }

  /** 启动蒸汽/茶雾 (冲泡/出汤时) */
  function startSteam(intensity = 1) {
    state.value.steamIntensity = Math.max(0, Math.min(1, intensity))
    return createContainer('steam')
  }

  /** 停止蒸汽 */
  async function stopSteam() {
    if (container && state.value.mode === 'steam') {
      await container.destroy()
      container = null
      state.value.mode = 'idle'
      state.value.isRunning = false
    }
  }

  /** 启动涟漪 (注水/出汤瞬间) */
  function startRipple() {
    return createContainer('ripple')
  }

  /** 停止涟漪 */
  async function stopRipple() {
    if (container && state.value.mode === 'ripple') {
      await container.destroy()
      container = null
      state.value.mode = 'idle'
      state.value.isRunning = false
    }
  }

  /** 设置火焰强度 (0-1) */
  function setFlameIntensity(v: number) {
    state.value.flameIntensity = Math.max(0, Math.min(1, v))
    if (container && state.value.mode === 'fire') {
      container.options.particles.number.value = Math.round(60 * state.value.flameIntensity)
      container.refresh()
    }
  }

  /** 设置蒸汽强度 (0-1) */
  function setSteamIntensity(v: number) {
    state.value.steamIntensity = Math.max(0, Math.min(1, v))
    if (container && state.value.mode === 'steam') {
      container.options.particles.number.value = Math.round(15 * state.value.steamIntensity)
      container.refresh()
    }
  }

  /** 销毁所有 */
  async function destroy() {
    if (container) {
      await container.destroy()
      container = null
    }
    state.value.isRunning = false
    state.value.mode = 'idle'
  }

  onUnmounted(destroy)

  return {
    // 状态
    state,

    // 容器引用 (模板绑定)
      containerRef,

    // 控制方法
    startFire,
    stopFire,
    startSteam,
    stopSteam,
    startRipple,
    stopRipple,
    setFlameIntensity,
    setSteamIntensity,
    destroy,

    // 获取当前 container 实例 (高级用法)
    get currentContainer() { return container },
  }
}

// ============ 导出类型 ============
export type { ParticleMode, ParticleSystemState }
