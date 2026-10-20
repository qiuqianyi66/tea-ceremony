/**
 * 已收藏茶器存储回归测试。
 *
 * 历史缺陷（2026-10-20 排雷发现）：collectedWare 表主键是自增 ++id，wareId 只是二级索引，
 * 旧 add() 用 `put({id})` 不带主键 → 同一茶器反复解锁就堆重复行；而 remove 只删首行 →
 * 残留脏数据（load 用 Set 去重掩盖，用户不可见但存储泄漏）。
 * 本文件锁：add 对同一 wareId 幂等，不产生重复行。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { db, initDB } from '@/services/storage'
import { collectedWareStorage } from '@/services/storage/collectedWare'

describe('collectedWareStorage add 幂等', () => {
  beforeEach(async () => {
    await initDB()
    await db.collectedWare.clear()
  })

  it('同一茶器 add 两次只产生一行', async () => {
    await collectedWareStorage.add('jianzhan')
    await collectedWareStorage.add('jianzhan')

    const rows = await db.collectedWare.where('id').equals('jianzhan').toArray()
    expect(rows).toHaveLength(1)
    const loaded = await collectedWareStorage.load()
    expect(loaded.has('jianzhan')).toBe(true)
    expect(loaded.size).toBe(1)
  })

  it('不同茶器各自一行', async () => {
    await collectedWareStorage.add('jianzhan')
    await collectedWareStorage.add('gaiwan')
    const rows = await db.collectedWare.toArray()
    expect(rows).toHaveLength(2)
  })

  it('remove 后不再在集合中', async () => {
    await collectedWareStorage.add('jianzhan')
    await collectedWareStorage.add('gaiwan')
    await collectedWareStorage.remove('jianzhan')
    const loaded = await collectedWareStorage.load()
    expect(loaded.has('jianzhan')).toBe(false)
    expect(loaded.has('gaiwan')).toBe(true)
  })
})
