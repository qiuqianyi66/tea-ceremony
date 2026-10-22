import { computed, ref } from 'vue'
import type { useAudio } from '@/composables/useAudio'
import { BrewPhase } from '@/types/brewing'

/**
 * 注水手势（从 BrewView.vue 拆出，2026-10-22 B8）：
 * READY 阶段向右拖壶嘴注水 + 键盘回车等价操作；拖拽速度折算为茶汤浓度系数。
 * 只依赖传入的 brewState 与 audio（单例）；浸泡启动回调由状态机注入。
 */

interface BrewStateLike {
  phase: BrewPhase
}

export function useBrewPourGesture(
  brewState: BrewStateLike,
  audio: ReturnType<typeof useAudio>,
  startSteeping: () => void,
) {
  const pourGestureProgress = ref(0)
  const isPourGestureActive = ref(false)
  const pourSpeed = ref(0.5)
  let pourPointerStartX = 0
  let pourPointerStartedAt = 0

  const canGesturePour = computed(() => brewState.phase === BrewPhase.READY)
  const pourGestureStyle = computed(() => ({
    transform: `translateX(${pourGestureProgress.value * 0.18}px) rotate(${-25 - pourGestureProgress.value * 0.12}deg)`,
  }))
  const streamStyle = computed(() => ({
    animationDuration: `${1.2 - pourSpeed.value * 0.55}s`,
  }))
  // 拖拽注水进度同步给 3D：拖拽中实时传 0~1，松手/非拖拽阶段传 -1 交回 phase 自动。
  // 让 3D 真手与茶壶倾斜跟着手指走，而不是按 phase 自动满姿态。
  const pourProgress3D = computed(() =>
    isPourGestureActive.value ? pourGestureProgress.value / 100 : -1,
  )

  function beginPourGesture(event: PointerEvent) {
    if (!canGesturePour.value) return
    pourPointerStartX = event.clientX
    pourPointerStartedAt = performance.now()
    pourGestureProgress.value = 0
    isPourGestureActive.value = true
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function movePourGesture(event: PointerEvent) {
    if (!isPourGestureActive.value) return
    // 向右拖动代表壶嘴向茶器倾斜，限制在 0~100 之间
    pourGestureProgress.value = Math.max(0, Math.min(100, event.clientX - pourPointerStartX))
  }

  function endPourGesture(event: PointerEvent) {
    if (!isPourGestureActive.value) return
    isPourGestureActive.value = false
    ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
    if (pourGestureProgress.value >= 60) {
      const elapsed = Math.max(performance.now() - pourPointerStartedAt, 120)
      pourSpeed.value = Math.max(0.1, Math.min(1, (pourGestureProgress.value / elapsed) * 4))
      audio.playPourWater(1 + pourGestureProgress.value / 100)
      startSteeping()
    }
    pourGestureProgress.value = 0
  }

  // P2-6 无障碍：键盘 / 读屏用户无法拖拽，用回车等价完成一次注水（中等速度）。
  // 不改状态机、不加手动确认按钮，仅把 READY 拖拽的注水动作开放给键盘。
  function onPourKeydown(event: KeyboardEvent) {
    if (!canGesturePour.value) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      pourSpeed.value = 0.6
      audio.playPourWater(1.1)
      startSteeping()
    }
  }

  return {
    pourGestureProgress,
    isPourGestureActive,
    pourSpeed,
    canGesturePour,
    pourGestureStyle,
    streamStyle,
    pourProgress3D,
    beginPourGesture,
    movePourGesture,
    endPourGesture,
    onPourKeydown,
  }
}
