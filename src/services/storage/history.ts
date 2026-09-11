/** 品鉴历史存储（IndexedDB + 离线同步） */

import type { TastingRecord } from '@/types/tasting'
import { db, initDB } from './db'
import { recordsApi } from '../api'

export const historyStorage = {
  /** 加载所有记录（按日期倒序） */
  async load(): Promise<TastingRecord[]> {
    await initDB()
    return db.tastings.orderBy('date').reverse().toArray()
  },

  /** 保存整个数组（替换所有） */
  async save(records: TastingRecord[]): Promise<void> {
    await initDB()
    await db.transaction('rw', db.tastings, async () => {
      await db.tastings.clear()
      if (records.length > 0) {
        await db.tastings.bulkPut(records)
      }
    })
  },

  /** 添加单条记录（自动去重） */
  async add(record: TastingRecord): Promise<TastingRecord[]> {
    await initDB()

    // 检查是否已存在相同茶叶同一天的记录（防重复）
    const recordDay = record.date.split('T')[0]
    const existing = await db.tastings
      .filter(item => item.teaId === record.teaId && item.date.startsWith(recordDay!))
      .first()

    if (existing) {
      console.log('[Dexie] 记录已存在，跳过添加:', existing.id)
      return this.load()
    }

    const pendingRecord = { ...record, syncStatus: 'pending' as const }
    await db.tastings.put(pendingRecord)

    try {
      await recordsApi.create(pendingRecord)
      await db.tastings.put({ ...pendingRecord, syncStatus: 'synced', syncError: undefined })
    } catch (error) {
      const syncError = error instanceof Error ? error.message : '同步失败'
      console.warn('[Dexie] 品鉴记录已保存在本地，稍后可重试同步:', syncError)
      await db.tastings.put({ ...pendingRecord, syncStatus: 'failed', syncError })
    }

    return this.load()
  },

  /** 登录或网络恢复后，重试尚未同步的本地记录。 */
  async syncPending(): Promise<{ synced: number; failed: number }> {
    await initDB()
    const pending = await db.tastings
      .filter(record => record.syncStatus === 'pending' || record.syncStatus === 'failed')
      .toArray()
    let synced = 0
    let failed = 0

    for (const record of pending) {
      try {
        await recordsApi.create(record)
        await db.tastings.put({ ...record, syncStatus: 'synced', syncError: undefined })
        synced += 1
      } catch (error) {
        failed += 1
        const syncError = error instanceof Error ? error.message : '同步失败'
        await db.tastings.put({ ...record, syncStatus: 'failed', syncError })
      }
    }

    return { synced, failed }
  },

  /** 根据茶叶 ID 查询记录 */
  async getByTea(teaId: string): Promise<TastingRecord[]> {
    await initDB()
    return db.tastings.filter(record => record.teaId === teaId).reverse().toArray()
  },

  /** 查询高分记录 */
  async getHighScores(minScore = 8): Promise<TastingRecord[]> {
    await initDB()
    return db.tastings.where('overallScore').aboveOrEqual(minScore).reverse().toArray()
  },

  /** 获取最近 N 条记录 */
  async getRecent(limit = 10): Promise<TastingRecord[]> {
    await initDB()
    return db.tastings.orderBy('date').reverse().limit(limit).toArray()
  },

  /** 清空所有记录 */
  async clear(): Promise<void> {
    await initDB()
    await db.tastings.clear()
  },

  /** 获取总数 */
  async count(): Promise<number> {
    await initDB()
    return db.tastings.count()
  },
}
