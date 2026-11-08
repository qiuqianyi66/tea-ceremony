/**
 * 埋点健康度单测：src/services/tracking.ts
 * 覆盖：白名单拒收计 rejected；存储异常计 dropped 并留原因；正常写入不污染计数。
 * 用 mock 让 storage 初始化失败，验证「静默丢弃」可观测（真实故障不靠猜）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/storage', () => ({
  initDB: vi.fn(async () => {
    throw new Error('idb unavailable')
  }),
  db: { trackingEvents: {} },
}))

describe('tracking 丢弃计数', () => {
  beforeEach(async () => {
    const mod = await import('@/services/tracking')
    mod.resetTrackingHealth()
  })

  it('非法 category 计入 rejected，不进入存储路径', async () => {
    const { track, trackingHealth } = await import('@/services/tracking')
    await track({ category: 'not-allowed' as never, event: 'ai_ask' })
    expect(trackingHealth()).toEqual({ rejected: 1, dropped: 0, lastError: null })
  })

  it('超长 event 计入 rejected', async () => {
    const { track, trackingHealth } = await import('@/services/tracking')
    await track({ category: 'ai', event: 'x'.repeat(41) })
    expect(trackingHealth().rejected).toBe(1)
    expect(trackingHealth().dropped).toBe(0)
  })

  it('存储异常计入 dropped 并记录原因，track 仍不 reject', async () => {
    const { track, trackingHealth } = await import('@/services/tracking')
    await expect(
      track({ category: 'ai', event: 'ai_ask', result: 'success' }),
    ).resolves.toBeUndefined()
    const health = trackingHealth()
    expect(health.dropped).toBe(1)
    expect(health.rejected).toBe(0)
    expect(health.lastError).toBe('idb unavailable')
  })
})
