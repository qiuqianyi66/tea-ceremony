/**
 * Dexie 数据库实例 + 版本迁移 + 初始化
 */

import Dexie from 'dexie'
import type { TastingRecord } from '@/types/tasting'
import type { Achievement } from '@/types/tasting'
import type { PlantedTea } from '@/types/garden'

// ============ 数据库定义 ============

class TeaCeremonyDB extends Dexie {
  tastings!: Dexie.Table<TastingRecord, string>
  achievements!: Dexie.Table<Achievement, string>
  settings!: Dexie.Table<{ key: string; value: unknown; migratedAt?: string }, string>
  userXp!: Dexie.Table<{ key: string; value: number }, string>
  collectedWare!: Dexie.Table<{ id: string; unlockedAt: string }, string>
  gardenPlants!: Dexie.Table<PlantedTea, number>

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

    // 版本 4：茶园系统——种植的茶树
    this.version(4).stores({
      tastings: '++id, teaId, date, overallScore, [teaId+date], brewTemp, steepTime',
      achievements: '++id, id, unlocked',
      settings: '++id, key',
      userXp: '++id, key',
      collectedWare: '++id, id, unlockedAt',
      gardenPlants: '++id, regionId, teaId, status, plantedAt',
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

export type { TeaCeremonyDB }
