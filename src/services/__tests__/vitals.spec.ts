/**
 * Web Vitals 采集单测（P1-9）：src/services/vitals.ts
 * 覆盖：五项指标注册与落库、幂等注册、容量裁剪、无网络外发（ADR-006）、清空。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers: Record<string, (metric: unknown) => void> = {}

vi.mock('web-vitals', () => ({
  onLCP: (cb: (metric: unknown) => void) => {
    handlers.LCP = cb
  },
  onINP: (cb: (metric: unknown) => void) => {
    handlers.INP = cb
  },
  onCLS: (cb: (metric: unknown) => void) => {
    handlers.CLS = cb
  },
  onFCP: (cb: (metric: unknown) => void) => {
    handlers.FCP = cb
  },
  onTTFB: (cb: (metric: unknown) => void) => {
    handlers.TTFB = cb
  },
}))

import { db, initDB } from '@/services/storage'
import { clearWebVitals, getWebVitals, initWebVitals, MAX_VITALS } from '@/services/vitals'

const metric = (name: string, value: number, rating = 'good') => ({
  name,
  value,
  rating,
  id: `v3-${name}-1`,
  delta: value,
  navigationType: 'navigate',
})

beforeEach(async () => {
  await initDB()
  await db.webVitals.clear()
  initWebVitals()
})

/** 等待同步触发的回调的异步落库链全部 settle（count 连续两次轮询不变） */
async function waitForSettle() {
  let prev = -1
  await vi.waitFor(
    async () => {
      const count = await db.webVitals.count()
      if (count !== prev) {
        prev = count
        throw new Error('pending writes')
      }
    },
    { timeout: 5000, interval: 100 },
  )
}

describe('initWebVitals 注册', () => {
  it('五项指标监听均已注册', () => {
    for (const name of ['LCP', 'INP', 'CLS', 'FCP', 'TTFB']) {
      expect(typeof handlers[name]).toBe('function')
    }
  })

  it('重复调用幂等（不抛错，监听仍可用）', () => {
    expect(() => initWebVitals()).not.toThrow()
    expect(typeof handlers.LCP).toBe('function')
  })
})

describe('指标落库', () => {
  it('LCP 回调触发后写入一条结构化记录', async () => {
    handlers.LCP(metric('LCP', 1234.567))
    // 回调内部异步落库，等一个微任务周期
    await Promise.resolve()
    await vi.waitFor(async () => {
      expect(await db.webVitals.count()).toBe(1)
    })
    const records = await getWebVitals()
    expect(records[0]).toMatchObject({
      name: 'LCP',
      value: 1234.567,
      rating: 'good',
      navigationType: 'navigate',
    })
    expect(typeof records[0].ts).toBe('number')
  })

  it('CLS 分数与 INP 均能落库', async () => {
    handlers.CLS(metric('CLS', 0.042))
    handlers.INP(metric('INP', 88, 'needs-improvement'))
    await vi.waitFor(async () => {
      expect(await db.webVitals.count()).toBe(2)
    })
    const all = await getWebVitals()
    expect(all.map((r) => r.name).sort()).toEqual(['CLS', 'INP'])
  })
})

describe('容量与隐私', () => {
  it(`超过 ${MAX_VITALS} 条裁剪最旧，总数不超上限`, async () => {
    for (let i = 0; i < MAX_VITALS; i++) {
      handlers.LCP(metric('LCP', 100 + i))
    }
    await vi.waitFor(async () => {
      expect(await db.webVitals.count()).toBe(MAX_VITALS)
    })
    // 再触发一批 → 裁剪后不超上限
    for (let i = 0; i < 50; i++) {
      handlers.LCP(metric('LCP', 9999))
    }
    await waitForSettle()
    expect(await db.webVitals.count()).toBeLessThanOrEqual(MAX_VITALS)
  })

  it('采集全程不发起网络请求（纯本地，无外发）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    handlers.FCP(metric('FCP', 500))
    handlers.TTFB(metric('TTFB', 120))
    await vi.waitFor(async () => {
      // 按 name 精确计数，不受其他测试迟到的 LCP 写入影响
      expect(await db.webVitals.where('name').equals('FCP').count()).toBe(1)
    })
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('clearWebVitals 清空指标', async () => {
    handlers.LCP(metric('LCP', 100))
    await vi.waitFor(async () => {
      expect(await db.webVitals.count()).toBe(1)
    })
    await clearWebVitals()
    expect(await db.webVitals.count()).toBe(0)
  })
})
