/**
 * 节流单测：假定时器验证 leading / trailing 组合、窗口推进与 cancel。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { throttle } from '@/utils/throttle'

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('默认 leading + trailing：首次立即执行，窗口结束补最后一次', () => {
    const spy = vi.fn()
    const fn = throttle(spy, 100)
    fn('a')
    expect(spy).toHaveBeenCalledTimes(1)
    fn('b')
    fn('c')
    expect(spy).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith('c')
  })

  it('trailing 落在窗口结束时刻，而非最后一次调用后再等一个 wait', () => {
    const spy = vi.fn()
    const fn = throttle(spy, 100)
    fn('a')
    vi.advanceTimersByTime(50)
    fn('b')
    vi.advanceTimersByTime(49)
    expect(spy).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith('b')
  })

  it('leading:false 时首次不执行，窗口结束后执行一次', () => {
    const spy = vi.fn()
    const fn = throttle(spy, 100, { leading: false })
    fn('a')
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('a')
  })

  it('trailing:false 时窗口内调用直接丢弃', () => {
    const spy = vi.fn()
    const fn = throttle(spy, 100, { trailing: false })
    fn('a')
    fn('b')
    vi.advanceTimersByTime(200)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('a')
  })

  it('leading 与 trailing 都关时永不执行', () => {
    const spy = vi.fn()
    const fn = throttle(spy, 100, { leading: false, trailing: false })
    fn('a')
    vi.advanceTimersByTime(500)
    expect(spy).not.toHaveBeenCalled()
  })

  it('cancel 清掉待执行的 trailing 调用', () => {
    const spy = vi.fn()
    const fn = throttle(spy, 100)
    fn('a')
    fn('b')
    fn.cancel()
    vi.advanceTimersByTime(500)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('窗口过去后的新调用重新立即执行', () => {
    const spy = vi.fn()
    const fn = throttle(spy, 100)
    fn('a')
    vi.advanceTimersByTime(150)
    fn('b')
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith('b')
  })
})
