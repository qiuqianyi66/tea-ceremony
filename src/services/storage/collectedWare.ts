/** 已收藏茶器存储 */

import { db, initDB } from './db'

export const collectedWareStorage = {
  async load(): Promise<Set<string>> {
    await initDB()
    const records = await db.collectedWare.toArray()
    return new Set(records.map((r) => r.id))
  },

  async save(wareIds: Set<string>): Promise<void> {
    await initDB()
    await db.transaction('rw', db.collectedWare, async () => {
      await db.collectedWare.clear()
      const records = Array.from(wareIds).map((id) => ({
        id,
        unlockedAt: new Date().toISOString(),
      }))
      if (records.length > 0) {
        await db.collectedWare.bulkPut(records)
      }
    })
  },

  async add(wareId: string): Promise<Set<string>> {
    await initDB()
    // collectedWare 表主键是自增 ++id，wareId 只是二级索引；直接 put({id}) 不带主键
    // 会每次新增一行重复记录，而 remove 只删首行 → 残留脏数据。故先按业务 id 查重，
    // 已收藏则幂等跳过（与 achievements.unlock 同款防御，2026-10-20 排雷发现）。
    const existing = await db.collectedWare.where('id').equals(wareId).first()
    if (!existing) {
      await db.collectedWare.add({ id: wareId, unlockedAt: new Date().toISOString() })
    }
    return this.load()
  },

  async remove(wareId: string): Promise<Set<string>> {
    await initDB()
    // collectedWare 使用自增主键，按业务 id 找到记录后再删除。
    const record = await db.collectedWare.where('id').equals(wareId).first()
    if (record) await db.collectedWare.delete(record.id)
    return this.load()
  },
}
