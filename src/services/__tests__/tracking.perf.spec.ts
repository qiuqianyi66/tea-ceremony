/**
 * 埋点性能基准（T2.2，用户要求性能维度验证）：
 * - 批量写入 + 容量裁剪耗时
 * - 汇总查询耗时
 * 阈值按开发机安全余量设定（CI/本地不应接近上限）；耗时打印供人工复核。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { initDB, db } from '@/services/storage'
import { track, getTrackingSummary, MAX_EVENTS } from '@/services/tracking'

beforeEach(async () => {
  await initDB()
  await db.trackingEvents.clear()
})

describe('tracking 性能基准', () => {
  it(`写入 ${MAX_EVENTS} 条（含超限裁剪）耗时在合理范围`, async () => {
    const t0 = performance.now()
    for (let i = 0; i < MAX_EVENTS + 500; i++) {
      await track({ category: 'ai', event: 'ai_ask', result: 'success' })
    }
    const elapsed = performance.now() - t0
    // 宽松阈值：2500 次串行 IndexedDB 写 + 5 次裁剪（各删 500 条）
    expect(elapsed).toBeLessThan(10_000)
    expect(await db.trackingEvents.count()).toBeLessThanOrEqual(MAX_EVENTS)
    console.log(`[perf] 写入 ${MAX_EVENTS + 500} 条（含裁剪）耗时 ${elapsed.toFixed(1)}ms`)
  })

  it('汇总查询 2000 条事件耗时在合理范围', async () => {
    for (let i = 0; i < 2000; i++) {
      await track({ category: 'ai', event: 'ai_ask', result: i % 2 ? 'success' : 'degraded' })
    }
    const t0 = performance.now()
    const summary = await getTrackingSummary()
    const elapsed = performance.now() - t0
    expect(elapsed).toBeLessThan(1_000)
    expect(summary['ai:ai_ask:success']).toBe(1000)
    expect(summary['ai:ai_ask:degraded']).toBe(1000)
    console.log(`[perf] 汇总查询 2000 条耗时 ${elapsed.toFixed(1)}ms`)
  })
})
