/**
 * 节流：窗口内最多执行一次，支持 leading / trailing 开关。零依赖。
 */

export interface ThrottleOptions {
  /** 窗口起点立即执行，默认 true */
  leading?: boolean
  /** 窗口结束补执行最后一次调用，默认 true */
  trailing?: boolean
}

/** 节流后的函数（调用返回 void，节流本身不携带返回值） */
export type ThrottledFunction<A extends unknown[]> = ((...args: A) => void) & {
  /** 清除待执行的 trailing 调用，并把状态重置为「从未执行」 */
  cancel: () => void
}

/**
 * @param fn 被包装的函数
 * @param wait 窗口长度（毫秒）
 * @param options leading / trailing，两者都可关；都关时函数永不执行
 */
export function throttle<A extends unknown[], R>(
  fn: (...args: A) => R,
  wait = 300,
  options: ThrottleOptions = {},
): ThrottledFunction<A> {
  const leading = options.leading !== false
  const trailing = options.trailing !== false
  /** 上次实际执行时间；null 表示从未执行 */
  let lastInvoke: number | null = null
  let pending: A | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const scheduleTrailing = (delay: number): void => {
    if (!trailing || timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      const queued = pending
      pending = undefined
      if (queued === undefined) return
      lastInvoke = Date.now()
      fn(...queued)
    }, delay)
  }

  const throttled = (...args: A): void => {
    const now = Date.now()
    const windowOpen = lastInvoke === null ? leading : now - lastInvoke >= wait
    if (windowOpen) {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      pending = undefined
      lastInvoke = now
      fn(...args)
      return
    }
    pending = args
    scheduleTrailing(Math.max(0, wait - (now - (lastInvoke ?? now))))
  }

  const cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    pending = undefined
    lastInvoke = null
  }

  return Object.assign(throttled, { cancel })
}
