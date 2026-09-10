/**
 * 品鉴记录本地存储 + 云同步状态机单测（P2-2 云端同步增强）。
 *
 * 覆盖：
 * - add() 同步成功：pending → synced
 * - add() 网络失败：保留本地 + failed + syncError（不丢数据）
 * - add() 同茶同日去重（不重复落库、不重复创建）
 * - recordsApi.create 携带 client_id（后端按 client_id 幂等去重）
 * - syncPending() 重试 failed/pending：成功转 synced、失败保留 failed，返回计数
 *
 * mock 边界：recordsApi 是跨进程 HTTP 边界（行为测试三规则允许 mock 外部边界）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { historyStorage, db } from '@/services/storage'
import { recordsApi } from '@/services/api'
import type { TastingRecord } from '@/types/tasting'

vi.mock('@/services/api', () => ({
  recordsApi: {
    create: vi.fn(),
  },
}))

const createMock = vi.mocked(recordsApi.create)

function makeRecord(overrides: Partial<TastingRecord> = {}): TastingRecord {
  return {
    id: `rec_${Math.random().toString(36).slice(2, 8)}`,
    teaId: 'longjing',
    teaName: '西湖龙井',
    date: '2026-09-10T10:00:00.000Z',
    brewTemp: 80,
    brewTime: 45,
    infusions: 1,
    dimensions: { bitterness: 2, sweetness: 4, aftertaste: 5, body: 3, aroma: 5, rhyme: 4, shape: 3, mind: 5 },
    overallScore: 8.6,
    processFactor: 0.92,
    ...overrides,
  }
}

beforeEach(async () => {
  createMock.mockReset()
  await db.tastings.clear()
})

describe('add：本地保存 + 云同步', () => {
  it('同步成功：记录落库为 synced，无 syncError', async () => {
    createMock.mockResolvedValue({ id: 1 } as never)
    await historyStorage.add(makeRecord())

    const saved = await db.tastings.toArray()
    expect(saved).toHaveLength(1)
    expect(saved[0]!.syncStatus).toBe('synced')
    expect(saved[0]!.syncError).toBeUndefined()
  })

  it('网络失败：记录保留本地为 failed + syncError，不丢数据', async () => {
    createMock.mockRejectedValue(new Error('network down'))
    await historyStorage.add(makeRecord())

    const saved = await db.tastings.toArray()
    expect(saved).toHaveLength(1)
    expect(saved[0]!.syncStatus).toBe('failed')
    expect(saved[0]!.syncError).toBe('network down')
  })

  it('create 携带 client_id（后端幂等去重依据）', async () => {
    createMock.mockResolvedValue({ id: 1 } as never)
    const record = makeRecord()
    await historyStorage.add(record)

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(createMock.mock.calls[0]![0]!.id).toBe(record.id)
  })

  it('同茶同日去重：不重复落库、不重复创建', async () => {
    createMock.mockResolvedValue({ id: 1 } as never)
    await historyStorage.add(makeRecord())
    await historyStorage.add(makeRecord({ id: 'rec_second' }))

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(await db.tastings.count()).toBe(1)
  })
})

describe('syncPending：离线记录重试', () => {
  it('failed 重试成功 → synced 且清 syncError，返回计数', async () => {
    createMock.mockResolvedValue({ id: 1 } as never)
    await db.tastings.put({ ...makeRecord(), syncStatus: 'failed', syncError: '旧错误' })

    const result = await historyStorage.syncPending()
    expect(result).toEqual({ synced: 1, failed: 0 })

    const saved = await db.tastings.toArray()
    expect(saved[0]!.syncStatus).toBe('synced')
    expect(saved[0]!.syncError).toBeUndefined()
  })

  it('部分成功部分失败：分别计数、状态各自更新', async () => {
    createMock
      .mockResolvedValueOnce({ id: 1 } as never)
      .mockRejectedValueOnce(new Error('still down'))
    await db.tastings.put({ ...makeRecord(), id: 'a', syncStatus: 'failed' })
    await db.tastings.put({ ...makeRecord(), id: 'b', teaName: '铁观音', syncStatus: 'pending' })

    const result = await historyStorage.syncPending()
    expect(result).toEqual({ synced: 1, failed: 1 })

    const saved = await db.tastings.toArray()
    const byId = Object.fromEntries(saved.map(r => [r.id, r]))
    expect(byId.a!.syncStatus).toBe('synced')
    expect(byId.b!.syncStatus).toBe('failed')
  })

  it('全部失败：全部保留 failed，计数准确', async () => {
    createMock.mockRejectedValue(new Error('offline'))
    await db.tastings.put({ ...makeRecord(), id: 'x', syncStatus: 'pending' })
    await db.tastings.put({ ...makeRecord(), id: 'y', syncStatus: 'failed' })

    const result = await historyStorage.syncPending()
    expect(result).toEqual({ synced: 0, failed: 2 })

    const saved = await db.tastings.toArray()
    expect(saved.every(r => r.syncStatus === 'failed')).toBe(true)
  })
})
