/**
 * 品鉴记录导出单测（P2-12）：src/services/storage/export.ts
 * 覆盖：载荷组装（含全部记录）、空库、无网络外发（隐私）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExportPayload, db, initDB } from '@/services/storage'

const sampleRecord = (id: string) => ({
  id,
  teaId: 'longjing',
  teaName: '西湖龙井',
  date: `2026-09-${id}T08:00:00.000Z`,
  overallScore: 8.5,
  syncStatus: 'synced' as const,
})

beforeEach(async () => {
  await initDB()
  await db.tastings.clear()
})

describe('buildExportPayload', () => {
  it('导出全部品鉴记录并带元信息', async () => {
    await db.tastings.bulkPut([sampleRecord('01'), sampleRecord('02'), sampleRecord('03')])

    const payload = await buildExportPayload()
    expect(payload).not.toBeNull()
    expect(payload?.app).toBe('一盏茶')
    expect(payload?.schemaVersion).toBe(1)
    expect(payload?.recordCount).toBe(3)
    expect(payload?.records).toHaveLength(3)
    expect(payload?.records[0]).toMatchObject({ teaId: 'longjing', overallScore: 8.5 })
    expect(typeof payload?.exportedAt).toBe('string')
  })

  it('空库导出 recordCount 为 0，不报错', async () => {
    const payload = await buildExportPayload()
    expect(payload).not.toBeNull()
    expect(payload?.recordCount).toBe(0)
    expect(payload?.records).toEqual([])
  })

  it('导出过程不发起网络请求（纯本地，无外发）', async () => {
    await db.tastings.put(sampleRecord('01'))
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await buildExportPayload()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
