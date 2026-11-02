---
last_updated: 2026-11-02
status: active
owner: yanha
---

# Composables 骨架

解决「同一段响应式逻辑在多个组件里逐字复制」的问题：抽成 `useXxx()`，返回对象，副作用自带清理。

## 1. 骨架

`src/composables/useXxx.ts`，具名导出函数，返回一个普通对象。调用方解构即可。

```ts
import { computed, ref } from 'vue'

/**
 * useSteepTimer：封装单次冲泡计时，暴露剩余秒数与运行态。
 */
export function useSteepTimer(totalSeconds = 30) {
  const remaining = ref(totalSeconds)
  const running = ref(false)

  const progress = computed(() => 1 - remaining.value / totalSeconds)
  const done = computed(() => remaining.value === 0)

  function reset(): void {
    remaining.value = totalSeconds
    running.value = false
  }

  function tick(): void {
    if (remaining.value > 0) remaining.value -= 1
  }

  return { remaining, running, progress, done, reset, tick }
}
```

要点：文件名与函数名同形（`useSteepTimer.ts` → `useSteepTimer`）；参数给默认值；不在 composable 里读全局 store 除非它就是 store 的薄封装。

## 2. ref / computed 组合

`ref` 存可变状态，`computed` 只派生、不写回。派生值不要在 `watch` 里手动同步。

```ts
import { computed, ref } from 'vue'

/**
 * useTasteAverage：把八维评分聚合成均分与等级，纯派生无副作用。
 */
export function useTasteAverage() {
  const dimensions = ref<Record<string, number>>({})

  const values = computed(() => Object.values(dimensions.value))

  const average = computed(() => {
    const list = values.value
    if (list.length === 0) return 0
    return Math.round((list.reduce((sum, v) => sum + v, 0) / list.length) * 10) / 10
  })

  const level = computed<'入门' | '熟练' | '通达'>(() => {
    if (average.value >= 8) return '通达'
    if (average.value >= 5) return '熟练'
    return '入门'
  })

  function set(name: string, score: number): void {
    dimensions.value = { ...dimensions.value, [name]: score }
  }

  return { dimensions, average, level, set }
}
```

`computed` 里避免副作用（不写 DOM、不发请求、不改其他 ref）。

## 3. 清理副作用

定时器、事件监听、图表实例都在 `onUnmounted` 里清。用 `stop()` 收敛清理逻辑，`onUnmounted(stop)` 直接传函数。

```ts
import { onUnmounted, ref } from 'vue'

/**
 * useWindowWidth：跟随窗口宽度，卸载时移除监听。
 */
export function useWindowWidth() {
  const width = ref(window.innerWidth)

  function update(): void {
    width.value = window.innerWidth
  }

  window.addEventListener('resize', update)

  function stop(): void {
    window.removeEventListener('resize', update)
  }

  onUnmounted(stop)

  return { width, stop }
}
```

定时器版本：把 handle 存成 `let timer: ReturnType<typeof setInterval> | null`，`stop()` 里 `clearInterval` 后置 `null`，可重复调用不报错。

```ts
import { onUnmounted, ref } from 'vue'

/**
 * usePoller：按固定间隔轮询，卸载或手动 stop 时停表。
 */
export function usePoller(intervalMs = 1000) {
  const ticks = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null

  function start(): void {
    stop()
    timer = setInterval(() => {
      ticks.value += 1
    }, intervalMs)
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }

  onUnmounted(stop)

  return { ticks, start, stop }
}
```

## 4. 命名与放置

- 只被一个组件用的逻辑留在组件内，不抽 composable。
- 跨组件复用 → `src/composables/useXxx.ts`；包 store → 直接放 store。
- 不在 composable 顶层 `await`；异步用函数包住并返回状态。
- 已有可复用件：`useToast`（toast）、`useImgFailed`（图片失败记录）、`useAudio`、`useParticles`。
