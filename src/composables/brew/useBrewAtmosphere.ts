import { onMounted, onUnmounted, watch } from 'vue'
import { useParticleSystem } from '@/composables/useParticles'
import type { useAudio } from '@/composables/useAudio'
import { BrewPhase } from '@/types/brewing'

/**
 * 冲泡氛围同步（从 BrewView.vue 拆出，2026-10-22 B8）：
 * tsParticles 粒子 + 环境音效随阶段/水温联动，headless 外的视觉氛围都经这里。
 * 只依赖传入的 brewState 与 audio（单例），不反向依赖状态机。
 */

interface BrewStateLike {
  phase: BrewPhase
  currentTemp: number
  targetTemp: number
}

export function useBrewAtmosphere(brewState: BrewStateLike, audio: ReturnType<typeof useAudio>) {
  // ============ Canvas 粒子系统 ============
  const particleCanvas = useParticleSystem({ width: 256, height: 256 })

  let particlesStarted = false
  let mountedTimer: ReturnType<typeof setTimeout> | null = null

  function syncParticlesToPhase(phase: BrewPhase) {
    if (!particlesStarted) return

    // 先停止所有
    particleCanvas.stopFire()
    particleCanvas.stopSteam()
    particleCanvas.stopRipple()
    audio.stopAmbient()
    audio.stopBoiling()
    audio.stopCrackle()

    switch (phase) {
      case BrewPhase.HEATING:
        particleCanvas.startFire()
        audio.startBoiling()
        audio.startCrackle()
        if (brewState.currentTemp > 60) {
          particleCanvas.startSteam()
        }
        break
      case BrewPhase.WARMING:
      case BrewPhase.RINSING:
        particleCanvas.startSteam()
        audio.startAmbient()
        break
      case BrewPhase.READY:
        particleCanvas.startSteam()
        audio.startAmbient()
        break
      case BrewPhase.STEEPING:
        particleCanvas.startSteam()
        // 注：原实现在此同时 startRipple()，两个 createContainer 并发 engine.load
        // 同一容器元素，tsParticles 异步销毁/加载存在竞态，会导致动画循环泄漏、
        // 主线程卡死（E2E 实测）。浸泡阶段保留蒸汽表现即可，涟漪改由注水动画呈现。
        audio.startAmbient()
        break
      case BrewPhase.DONE:
        particleCanvas.startSteam()
        audio.startAmbient()
        break
    }
  }

  watch(
    () => brewState.currentTemp,
    (temp) => {
      const target = brewState.targetTemp
      const intensity = target > 20 ? Math.min(1, temp / target) : 0
      particleCanvas.setFlameIntensity(Math.min(1, intensity * 1.5))
      if (particlesStarted && brewState.phase === BrewPhase.HEATING) {
        if (temp > 60) particleCanvas.startSteam()
        else particleCanvas.stopSteam()
      }
    },
  )

  onMounted(() => {
    // 给 container 一点时间挂载
    mountedTimer = setTimeout(() => {
      particlesStarted = true
      syncParticlesToPhase(brewState.phase)
    }, 100)
  })

  onUnmounted(() => {
    // 清理粒子系统、音效（定时器清理在各自 composable）
    if (mountedTimer) {
      clearTimeout(mountedTimer)
      mountedTimer = null
    }
    particleCanvas.destroy()
    audio.stopAll()
  })

  return { particleCanvas, syncParticlesToPhase }
}
