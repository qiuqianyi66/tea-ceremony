/**
 * 采样与限流单测：src/services/telemetry/sampler.ts（契约 §8）
 * 重点：令牌桶补充与耗尽、同指纹去重窗口、窗口过后放行、vital 每页只发一次。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEDUPE_WINDOW_MS } from '../config'
import {
  TokenBucket,
  getSuppressedCount,
  resetSamplerForTest,
  shouldEmitError,
  shouldEmitVital,
} from '../sampler'

afterEach(() => {
  vi.useRealTimers()
  resetSamplerForTest()
})

describe('TokenBucket', () => {
  it('桶容量内可连续取，耗尽后拒绝', () => {
    const now = 0
    const bucket = new TokenBucket(10, 10, () => now)
    for (let i = 0; i < 10; i++) expect(bucket.take()).toBe(true)
    expect(bucket.take()).toBe(false)
  })

  it('按分钟补充：10 次/分钟 → 6 秒补 1 个', () => {
    let now = 0
    const bucket = new TokenBucket(10, 10, () => now)
    for (let i = 0; i < 10; i++) bucket.take()
    expect(bucket.take()).toBe(false)

    now += 6_000
    expect(bucket.take()).toBe(true)
    expect(bucket.take()).toBe(false)

    now += 30_000
    expect(bucket.take()).toBe(true)
  })

  it('补充不会超过容量上限', () => {
    let now = 0
    const bucket = new TokenBucket(10, 10, () => now)
    bucket.take()
    now += 10 * 60_000
    for (let i = 0; i < 10; i++) expect(bucket.take()).toBe(true)
    expect(bucket.take()).toBe(false)
  })

  it('默认参数即契约规定的 10 次/分钟、桶容量 10', () => {
    const bucket = new TokenBucket()
    for (let i = 0; i < 10; i++) expect(bucket.take()).toBe(true)
    expect(bucket.take()).toBe(false)
  })
})

describe('shouldEmitError（同指纹 5 分钟去重）', () => {
  it('窗口内只放行 1 条，被拦下的累加计数', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-17T00:00:00Z'))

    expect(shouldEmitError('fp-1')).toBe(true)
    expect(shouldEmitError('fp-1')).toBe(false)
    expect(shouldEmitError('fp-1')).toBe(false)
    expect(getSuppressedCount('fp-1')).toBe(2)

    // 不同指纹互不影响
    expect(shouldEmitError('fp-2')).toBe(true)
    expect(getSuppressedCount('fp-2')).toBe(0)
  })

  it('窗口边界：5 分钟 - 1ms 仍拦下，满 5 分钟放行', () => {
    vi.useFakeTimers()
    const t0 = new Date('2026-10-17T00:00:00Z').getTime()
    vi.setSystemTime(t0)

    expect(shouldEmitError('fp')).toBe(true)

    vi.setSystemTime(t0 + DEDUPE_WINDOW_MS - 1)
    expect(shouldEmitError('fp')).toBe(false)

    vi.setSystemTime(t0 + DEDUPE_WINDOW_MS)
    expect(shouldEmitError('fp')).toBe(true)
  })

  it('放行后计数归零（上一轮被拦数已随上一条带出）', () => {
    vi.useFakeTimers()
    const t0 = new Date('2026-10-17T00:00:00Z').getTime()
    vi.setSystemTime(t0)

    shouldEmitError('fp')
    shouldEmitError('fp')
    expect(getSuppressedCount('fp')).toBe(1)

    vi.setSystemTime(t0 + DEDUPE_WINDOW_MS)
    expect(shouldEmitError('fp')).toBe(true)
    expect(getSuppressedCount('fp')).toBe(0)
  })
})

describe('shouldEmitVital（每页每指标 1 条）', () => {
  it('同一路由同一指标只放行一次', () => {
    resetSamplerForTest()
    expect(shouldEmitVital('LCP', '/brew')).toBe(true)
    expect(shouldEmitVital('LCP', '/brew')).toBe(false)
  })

  it('不同指标 / 不同路由各自放行', () => {
    resetSamplerForTest()
    expect(shouldEmitVital('LCP', '/brew')).toBe(true)
    expect(shouldEmitVital('CLS', '/brew')).toBe(true)
    expect(shouldEmitVital('LCP', '/home')).toBe(true)
    expect(shouldEmitVital('CLS', '/brew')).toBe(false)
  })
})
