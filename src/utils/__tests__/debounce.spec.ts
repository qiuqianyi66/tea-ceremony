/**
 * 防抖单测：假定时器验证窗口合并、窗口重置、cancel、flush 与 leading。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounce } from '@/utils/debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('窗口内多次调用只执行最后一次，并带最后参数', () => {
    const spy = vi.fn((value: number) => value * 2)
    const fn = debounce(spy, 200)
    fn(1)
    fn(2)
    fn(3)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(199)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenLastCalledWith(3)
  })

  it('每次调用都会重置窗口', () => {
    const spy = vi.fn()
    const fn = debounce(spy, 100)
    fn()
    vi.advanceTimersByTime(80)
    fn()
    vi.advanceTimersByTime(80)
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(20)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('cancel 丢弃待执行调用', () => {
    const spy = vi.fn()
    const fn = debounce(spy, 100)
    fn()
    fn.cancel()
    vi.advanceTimersByTime(1000)
    expect(spy).not.toHaveBeenCalled()
  })

  it('flush 立即执行并返回结果，之后不重复执行', () => {
    const spy = vi.fn((a: number, b: number) => a + b)
    const fn = debounce(spy, 100)
    expect(fn.flush()).toBeUndefined()
    fn(2, 3)
    expect(fn.flush()).toBe(5)
    expect(spy).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(fn.flush()).toBe(5)
  })

  it('leading 模式首次立即执行，窗口内调用被合并丢弃', () => {
    const spy = vi.fn()
    const fn = debounce(spy, 100, { leading: true })
    fn('a')
    expect(spy).toHaveBeenCalledWith('a')
    fn('b')
    expect(spy).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(fn.flush()).toBeUndefined()
  })
})
