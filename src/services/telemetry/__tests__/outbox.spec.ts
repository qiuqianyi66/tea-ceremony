/**
 * outbox 队列单测：src/services/telemetry/outbox.ts
 * 重点：入队、容量淘汰、takeBatch 只取到期项、markFailed 退避递增、dead 不再取。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { db, initDB } from '@/services/storage'
import { MAX_ATTEMPTS, OUTBOX_MAX } from '../config'
import {
  clearOutbox,
  enqueue,
  markDead,
  markFailed,
  markSent,
  pendingCount,
  requeueInflight,
  takeBatch,
} from '../outbox'
import type { TelemetryErrorEvent, TelemetryEvent } from '../types'

function makeEvent(clientEventId: string): TelemetryErrorEvent {
  return {
    clientEventId,
    type: 'error',
    occurredAt: '2026-10-17T00:00:00.000Z',
    route: '/brew',
    payload: {
      kind: 'error',
      message: 'boom',
      source: '/assets/index.js',
      fingerprint: '0123456789abcdef',
    },
  }
}

function makeEvents(count: number, prefix = 'e'): TelemetryEvent[] {
  return Array.from({ length: count }, (_, i) => makeEvent(`${prefix}${i}`))
}

beforeEach(async () => {
  await initDB()
  await clearOutbox()
})

describe('enqueue / pendingCount', () => {
  it('入队后可按待发数统计', async () => {
    await enqueue(makeEvents(3))
    expect(await pendingCount()).toBe(3)
    expect(await db.telemetryOutbox.count()).toBe(3)
  })

  it('空数组入队是 no-op', async () => {
    await enqueue([])
    expect(await pendingCount()).toBe(0)
  })

  it('新记录默认 queued、attempts=0、立即到期', async () => {
    await enqueue(makeEvents(1))
    const [record] = await db.telemetryOutbox.toArray()
    expect(record?.status).toBe('queued')
    expect(record?.attempts).toBe(0)
    expect(record?.nextAttemptAt).toBeLessThanOrEqual(Date.now())
  })
})

describe('容量上限（淘汰最旧）', () => {
  it(`已有 ${OUTBOX_MAX} 条时再入队，淘汰最旧的等量记录`, async () => {
    await enqueue(makeEvents(OUTBOX_MAX))
    expect(await pendingCount()).toBe(OUTBOX_MAX)

    await enqueue(makeEvents(50, 'new'))
    expect(await pendingCount()).toBe(OUTBOX_MAX)

    const ids = (await db.telemetryOutbox.toArray()).map((r) => r.event.clientEventId)
    // 最旧的 50 条（e0..e49）被淘汰，新入队的都在
    expect(ids).not.toContain('e0')
    expect(ids).toContain('e50')
    expect(ids.filter((id) => id.startsWith('new'))).toHaveLength(50)
  })

  it('单次入队超过上限时只保留最新的一批', async () => {
    await enqueue(makeEvents(OUTBOX_MAX + 50))
    expect(await pendingCount()).toBe(OUTBOX_MAX)
    const ids = (await db.telemetryOutbox.toArray()).map((r) => r.event.clientEventId)
    expect(ids).not.toContain('e0')
    expect(ids).toContain('e50')
  })
})

describe('takeBatch', () => {
  it('只取到期项，未来到期的留在队列里', async () => {
    await enqueue(makeEvents(3))
    const all = await db.telemetryOutbox.toArray()
    const future = all[0]
    expect(future?.id).toBeDefined()
    await db.telemetryOutbox.update(future!.id!, { nextAttemptAt: Date.now() + 60_000 })

    const batch = await takeBatch(10)
    expect(batch).toHaveLength(2)
    expect(batch.map((r) => r.event.clientEventId)).not.toContain(future!.event.clientEventId)
    expect(await pendingCount()).toBe(3)
  })

  it('按 limit 截断', async () => {
    await enqueue(makeEvents(10))
    expect(await takeBatch(4)).toHaveLength(4)
  })

  it('取出的记录标为 inflight，重复取不会拿到同一批', async () => {
    await enqueue(makeEvents(2))
    const first = await takeBatch(10)
    expect(first).toHaveLength(2)
    expect(first.every((r) => r.status === 'inflight')).toBe(true)

    expect(await takeBatch(10)).toHaveLength(0)
  })
})

describe('markSent / markFailed / markDead', () => {
  it('markSent 后出队', async () => {
    await enqueue(makeEvents(2))
    const batch = await takeBatch(10)
    await markSent(batch.map((r) => r.id!))
    expect(await pendingCount()).toBe(0)
    expect(await db.telemetryOutbox.count()).toBe(0)
  })

  it('markFailed 递增 attempts 并按退避推迟 nextAttemptAt', async () => {
    await enqueue(makeEvents(1))
    const batch = await takeBatch(10)
    const id = batch[0]!.id!
    const before = Date.now()

    await markFailed([id], 5_000)

    const record = await db.telemetryOutbox.get(id)
    expect(record?.attempts).toBe(1)
    expect(record?.status).toBe('queued')
    expect(record?.nextAttemptAt).toBeGreaterThanOrEqual(before + 5_000)

    // 未到期不再被取到
    expect(await takeBatch(10)).toHaveLength(0)
  })

  it(`失败 ${MAX_ATTEMPTS} 次后标 dead，之后不再被取`, async () => {
    await enqueue(makeEvents(1))
    const batch = await takeBatch(10)
    const id = batch[0]!.id!

    for (let i = 0; i < MAX_ATTEMPTS; i++) await markFailed([id], 0)

    const record = await db.telemetryOutbox.get(id)
    expect(record?.status).toBe('dead')
    expect(record?.attempts).toBe(MAX_ATTEMPTS)

    // 即使强行把到期时间拉到过去，dead 也不会被取
    await db.telemetryOutbox.update(id, { nextAttemptAt: 0 })
    expect(await takeBatch(10)).toHaveLength(0)
    expect(await pendingCount()).toBe(0)
  })

  it('markDead 直接终结记录', async () => {
    await enqueue(makeEvents(1))
    const batch = await takeBatch(10)
    await markDead(batch.map((r) => r.id!))
    expect(await pendingCount()).toBe(0)
    expect((await db.telemetryOutbox.toArray())[0]?.status).toBe('dead')
  })

  it('requeueInflight 把卡住的 inflight 放回队列', async () => {
    await enqueue(makeEvents(1))
    expect(await takeBatch(10)).toHaveLength(1)
    expect(await takeBatch(10)).toHaveLength(0)

    await requeueInflight()
    expect(await takeBatch(10)).toHaveLength(1)
  })
})
