/**
 * 防抖：窗口内多次调用合并为一次。零依赖，不引 vueuse。
 */

export interface DebounceOptions {
  /** 首次调用立即执行；窗口内后续调用直接丢弃（不补 trailing） */
  leading?: boolean
}

/** 防抖后的函数：调用本身返回 void，结果通过 flush() 取回 */
export type DebouncedFunction<A extends unknown[], R> = ((...args: A) => void) & {
  /** 丢弃待执行的调用并清空定时器 */
  cancel: () => void
  /** 立即执行待执行的调用并返回其返回值；无待执行调用时返回上次结果 */
  flush: () => R | undefined
}

/**
 * @param fn 被包装的函数
 * @param wait 静默窗口（毫秒）
 * @param options leading 为 true 时首次立即执行
 */
export function debounce<A extends unknown[], R>(
  fn: (...args: A) => R,
  wait = 300,
  options: DebounceOptions = {},
): DebouncedFunction<A, R> {
  const leading = options.leading === true
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: A | undefined
  let result: R | undefined

  const invoke = (): void => {
    const args = lastArgs
    lastArgs = undefined
    if (args === undefined) return
    result = fn(...args)
  }

  const cancel = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    lastArgs = undefined
  }

  const debounced = (...args: A): void => {
    const first = timer === undefined
    lastArgs = args
    if (timer !== undefined) clearTimeout(timer)
    if (first && leading) invoke()
    timer = setTimeout(() => {
      timer = undefined
      if (leading) {
        // leading 模式只保留首次执行，窗口内调用按设计丢弃
        lastArgs = undefined
        return
      }
      invoke()
    }, wait)
  }

  const flush = (): R | undefined => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
      if (leading) lastArgs = undefined
      else invoke()
    }
    return result
  }

  return Object.assign(debounced, { cancel, flush })
}
