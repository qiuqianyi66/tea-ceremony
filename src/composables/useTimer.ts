/**
 * 计时器组合式函数
 * 封装 setInterval 逻辑，支持暂停/恢复/重置
 */

import { ref, onUnmounted } from 'vue'

export function useTimer() {
  const seconds = ref(0)
  const isRunning = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null

  function start(onTick?: (seconds: number) => void) {
    if (isRunning.value) return
    isRunning.value = true
    intervalId = setInterval(() => {
      seconds.value++
      onTick?.(seconds.value)
    }, 1000)
  }

  function stop() {
    isRunning.value = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function reset() {
    stop()
    seconds.value = 0
  }

  function getElapsed(): number {
    return seconds.value
  }

  onUnmounted(() => {
    stop()
  })

  return {
    seconds,
    isRunning,
    start,
    stop,
    reset,
    getElapsed,
  }
}
