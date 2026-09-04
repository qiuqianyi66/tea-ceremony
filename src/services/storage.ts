/**
 * IndexedDB 存储服务 - 基于 Dexie.js
 * 替代 localStorage，突破 5MB 限制，支持索引查询、事务、批量操作
 * 保持与原 storage.ts 相同的 API 接口，便于无缝迁移
 */

import Dexie from 'dexie'
import type { TastingRecord } from '@/types/tasting'
import type { Achievement } from '@/types/tasting'
import { recordsApi } from './api'

// ============ 数据库定义 ============

class TeaCeremonyDB extends Dexie {
  // 表定义
  tastings!: Dexie.Table<TastingRecord, string>
  achievements!: Dexie.Table<Achievement, string>
  settings!: Dexie.Table<{ key: string; value: any; migratedAt?: string }, string>
  userXp!: Dexie.Table<{ key: string; value: number }, string>
  collectedWare!: Dexie.Table<{ id: string; unlockedAt: string }, string>

  constructor() {
    super('teaCeremonyDB')

    // 版本 1：基础表结构
    this.version(1).stores({
      // 复合索引去 multiEntry：数组 keyPath 配 multiEntry 在 Chromium/Firefox
      // 会抛 InvalidAccessError，导致整库打开失败（离线历史不可用）。历史查重
      // 实际用 filter，无需 multiEntry 语义。
      tastings: '++id, teaId, date, overallScore, [teaId+date]',
      achievements: '++id, id, unlocked',
      settings: '++id, key',
      userXp: '++id, key',
      collectedWare: '++id, id',
    })

    // 版本 2：添加更多索引优化查询
    this.version(2).stores({
      tastings: '++id, teaId, date, overallScore, [teaId+date], brewTemp, steepTime',
      achievements: '++id, id, unlocked',
      settings: '++id, key',
      userXp: '++id, key',
      collectedWare: '++id, id, unlockedAt',
    }).upgrade(tx => {
      // 迁移：为现有记录添加索引字段
      return tx.table('tastings').toCollection().modify(record => {
        // 确保 date 字段存在且格式正确
        if (!record.date) record.date = new Date().toISOString()
      })
    })

    // 版本 3：以合法复合索引重建（兼容已用 v1/v2 建过库的旧浏览器）
    this.version(3).stores({
      tastings: '++id, teaId, date, overallScore, [teaId+date], brewTemp, steepTime',
      achievements: '++id, id, unlocked',
      settings: '++id, key',
      userXp: '++id, key',
      collectedWare: '++id, id, unlockedAt',
    })
  }
}

// 单例实例
export const db = new TeaCeremonyDB()

// ============ 初始化与迁移 ============

let migrationDone = false

export async function initDB(): Promise<void> {
  if (migrationDone) return

  try {
    await db.open()
    migrationDone = true
    console.log('[Dexie] 数据库打开成功')

    // 首次运行：从 localStorage 迁移数据
    await migrateFromLocalStorage()
  } catch (error) {
    console.error('[Dexie] 数据库初始化失败:', error)
    throw error
  }
}

/** 从 localStorage 迁移历史数据到 IndexedDB */
async function migrateFromLocalStorage(): Promise<void> {
  const historyKey = 'tea-history'
  const achievementKey = 'tea-achievements'
  const xpKey = 'tea-xp'

  // 检查是否已迁移（通过设置表标记）
  const migrated = await db.settings.get({ key: 'migrated' })
  if (migrated) return

  console.log('[Dexie] 开始从 localStorage 迁移数据...')

  // 迁移品鉴历史
  try {
    const historyRaw = localStorage.getItem(historyKey)
    if (historyRaw) {
      const records: TastingRecord[] = JSON.parse(historyRaw)
      if (records.length > 0) {
        // 批量写入（事务中）
        await db.tastings.bulkPut(records)
        console.log(`[Dexie] 迁移品鉴记录 ${records.length} 条`)
      }
    }
  } catch (e) {
    console.warn('[Dexie] 迁移品鉴历史失败:', e)
  }

  // 迁移成就数据
  try {
    const achievementRaw = localStorage.getItem(achievementKey)
    if (achievementRaw) {
      const achievements: Achievement[] = JSON.parse(achievementRaw)
      if (achievements.length > 0) {
        await db.achievements.bulkPut(achievements)
        console.log(`[Dexie] 迁移成就数据 ${achievements.length} 条`)
      }
    }
  } catch (e) {
    console.warn('[Dexie] 迁移成就数据失败:', e)
  }

  // 迁移 XP
  try {
    const xpRaw = localStorage.getItem(xpKey)
    if (xpRaw) {
      const xp = parseInt(xpRaw, 10) || 0
      await db.userXp.put({ key: 'tea-xp', value: xp })
      console.log(`[Dexie] 迁移 XP: ${xp}`)
    }
  } catch (e) {
    console.warn('[Dexie] 迁移 XP 失败:', e)
  }

  // 迁移收藏茶器
  try {
    const collectedRaw = localStorage.getItem('tea-collected-ware')
    if (collectedRaw) {
      const wareIds: string[] = JSON.parse(collectedRaw)
      const wareRecords = wareIds.map(id => ({ id, unlockedAt: new Date().toISOString() }))
      await db.collectedWare.bulkPut(wareRecords)
      console.log(`[Dexie] 迁移收藏茶器 ${wareRecords.length} 个`)
    }
  } catch (e) {
    console.warn('[Dexie] 迁移收藏茶器失败:', e)
  }

  // 标记迁移完成
  await db.settings.put({ key: 'migrated', value: true, migratedAt: new Date().toISOString() })
  console.log('[Dexie] 迁移完成')

  // 可选：清理 localStorage（保留备份一段时间）
  // localStorage.removeItem(historyKey)
  // localStorage.removeItem(achievementKey)
}

// ============ 品鉴历史存储 ============

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

// ============ 成就存储 ============

export const achievementStorage = {
  async load(): Promise<Achievement[]> {
    await initDB()
    return db.achievements.toArray()
  },

  async save(achievements: Achievement[]): Promise<void> {
    await initDB()
    await db.transaction('rw', db.achievements, async () => {
      await db.achievements.clear()
      if (achievements.length > 0) {
        await db.achievements.bulkPut(achievements)
      }
    })
  },

  async unlock(achievementId: string): Promise<Achievement[]> {
    await initDB()
    // id 是业务字段，表的自增主键不是业务 ID。
    const achievement = await db.achievements.where('id').equals(achievementId).first()
    if (achievement && !achievement.unlocked) {
      achievement.unlocked = true
      achievement.unlockedAt = new Date().toISOString()
      await db.achievements.put(achievement)
    }
    return this.load()
  },
}

// ============ XP 存储 ============

export const xpStorage = {
  async load(): Promise<number> {
    await initDB()
    const record = await db.userXp.get({ key: 'tea-xp' })
    return record?.value ?? 0
  },

  async save(xp: number): Promise<void> {
    await initDB()
    await db.userXp.put({ key: 'tea-xp', value: xp })
  },
}

// ============ 收藏茶器存储 ============

export const collectedWareStorage = {
  async load(): Promise<Set<string>> {
    await initDB()
    const records = await db.collectedWare.toArray()
    return new Set(records.map(r => r.id))
  },

  async save(wareIds: Set<string>): Promise<void> {
    await initDB()
    await db.transaction('rw', db.collectedWare, async () => {
      await db.collectedWare.clear()
      const records = Array.from(wareIds).map(id => ({
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
    await db.collectedWare.put({ id: wareId, unlockedAt: new Date().toISOString() })
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

// ============ 设置存储 ============

export const settingsStorage = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    await initDB()
    const record = await db.settings.get({ key })
    return record?.value ?? defaultValue
  },

  async set<T>(key: string, value: T): Promise<void> {
    await initDB()
    await db.settings.put({ key, value })
  },

  async delete(key: string): Promise<void> {
    await initDB()
    await db.settings.delete(key)
  },
}

// ============ 导出类型 ============
export type { TeaCeremonyDB }
