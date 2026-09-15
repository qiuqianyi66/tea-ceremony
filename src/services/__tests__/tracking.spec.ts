/**
 * 行为埋点单测（T2.2）：src/services/tracking.ts
 * 覆盖：写入/汇总、容量上限裁剪、非法输入白名单、无网络外发（隐私安全）、track 永不 reject。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initDB, db } from '@/services/storage'
import { track, getTrackingSummary, clearTracking, MAX_EVENTS } from '@/services/tracking'

beforeEach(async () => {
  await initDB()
  await db.trackingEvents.clear()
})

describe('tracking 基础写入与汇总', () => {
  it('写入事件后按 category:event:result 汇总计数', async () => {
    await track({ category: 'ai', event: 'ai_ask', label: 'ask', result: 'success' })
    await track({ category: 'ai', event: 'ai_ask', label: 'ask', result: 'degraded' })
    await track({ category: 'ai', event: 'ai_ask', label: 'ask', result: 'degraded' })

    const summary = await getTrackingSummary()
    expect(summary['ai:ai_ask:success']).toBe(1)
    expect(summary['ai:ai_ask:degraded']).toBe(2)
    expect(summary['ai:ai_ask:failed']).toBeUndefined()
  })

  it('无 result 的事件按 category:event 聚合', async () => {
    await track({ category: 'ai', event: 'ai_page_open', label: 'page_open' })
    const summary = await getTrackingSummary()
    expect(summary['ai:ai_page_open']).toBe(1)
  })

  it('clearTracking 清空全部事件', async () => {
    await track({ category: 'ai', event: 'ai_ask', result: 'success' })
    await clearTracking()
    expect(await db.trackingEvents.count()).toBe(0)
    expect(await getTrackingSummary()).toEqual({})
  })
})

describe('tracking 容量上限（防本地无限膨胀）', () => {
  it(`超过 ${MAX_EVENTS} 条时裁剪最旧，总数不超上限`, async () => {
    const now = Date.now()
    // 先写 100 条"旧事件"（ts 靠前）
    for (let i = 0; i < 100; i++) {
      await db.trackingEvents.add({ category: 'system', event: 'old_event', ts: now - 100000 + i })
    }
    // 再写 MAX_EVENTS 条新事件 → 触发裁剪
    for (let i = 0; i < MAX_EVENTS; i++) {
      await track({ category: 'ai', event: 'ai_ask', result: 'success' })
    }
    const count = await db.trackingEvents.count()
    expect(count).toBeLessThanOrEqual(MAX_EVENTS)
    // 最旧的 old_event 已被裁剪（保新弃旧）
    const olds = await db.trackingEvents.where('event').equals('old_event').count()
    expect(olds).toBe(0)
    const news = await db.trackingEvents.where('event').equals('ai_ask').count()
    expect(news).toBeLessThanOrEqual(MAX_EVENTS)
  })
})

describe('tracking 输入白名单（隐私安全）', () => {
  it('非法 category / 非法 result 静默丢弃', async () => {
    await track({ category: 'hack' as never, event: 'x' })
    await track({ category: 'ai', event: 'y', result: 'evil' as never })
    expect(await db.trackingEvents.count()).toBe(0)
  })

  it('空 event / 超长 event / 超长 label 静默丢弃', async () => {
    await track({ category: 'ai', event: '' })
    await track({ category: 'ai', event: 'x'.repeat(41) })
    await track({ category: 'ai', event: 'ok', label: 'l'.repeat(41) })
    expect(await db.trackingEvents.count()).toBe(0)
    // 恰好 40 字符合法
    await track({ category: 'ai', event: 'e'.repeat(40), label: 'l'.repeat(40) })
    expect(await db.trackingEvents.count()).toBe(1)
  })

  it('track 永不发起网络请求（埋点纯本地，无外发）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await track({ category: 'ai', event: 'ai_ask', result: 'success' })
    await getTrackingSummary()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('tracking 健壮性', () => {
  it('track 永不 reject（埋点失败不影响主流程）', async () => {
    // 未初始化时调用也不抛（内部 catch）
    await expect(track({ category: 'ai', event: 'ai_ask' })).resolves.toBeUndefined()
  })
})
