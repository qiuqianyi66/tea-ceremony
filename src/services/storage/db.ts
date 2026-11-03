/**
 * Dexie 数据库实例 + 版本迁移 + 初始化
 */

import Dexie from 'dexie'
import type { Achievement, TastingRecord } from '@/types/tasting'
import type { ErrorBufferRecord } from '@/types/errors'
// 仅类型引用（编译期擦除），不会造成 storage ↔ telemetry 的运行时循环依赖
import type { OutboxRecord } from '@/services/telemetry/types'
import type { TrackEvent } from '@/types/tracking'
import type { WebVitalRecord } from '@/types/vitals'

// ============ 数据库定义 ============

class TeaCeremonyDB extends Dexie {
  tastings!: Dexie.Table<TastingRecord, string>
  achievements!: Dexie.Table<Achievement, string>
  settings!: Dexie.Table<{ key: string; value: unknown; migratedAt?: string }, string>
  userXp!: Dexie.Table<{ key: string; value: number }, string>
  collectedWare!: Dexie.Table<{ id: string; unlockedAt: string }, string>
  trackingEvents!: Dexie.Table<TrackEvent, number>
  webVitals!: Dexie.Table<WebVitalRecord, number>
  errorBuffer!: Dexie.Table<ErrorBufferRecord, number>
  telemetryOutbox!: Dexie.Table<OutboxRecord, number>

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
    this.version(2)
      .stores({
        tastings: '++id, teaId, date, overallScore, [teaId+date], brewTemp, steepTime',
        achievements: '++id, id, unlocked',
        settings: '++id, key',
        userXp: '++id, key',
        collectedWare: '++id, id, unlockedAt',
      })
      .upgrade((tx) => {
        // 迁移：为现有记录添加索引字段
        return tx
          .table('tastings')
          .toCollection()
          .modify((record) => {
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

    // 版本 5：行为埋点（T2.2）——纯本地事件日志，只存结构化行为，不存用户输入
    this.version(5).stores({
      tastings: '++id, teaId, date, overallScore, [teaId+date], brewTemp, steepTime',
      achievements: '++id, id, unlocked',
      settings: '++id, key',
      userXp: '++id, key',
      collectedWare: '++id, id, unlockedAt',
      trackingEvents: '++id, category, event, ts',
    })

    // 版本 6：Web Vitals 真实用户指标（P1-9）——纯本地，无外发（ADR-006）
    this.version(6).stores({
      tastings: '++id, teaId, date, overallScore, [teaId+date], brewTemp, steepTime',
      achievements: '++id, id, unlocked',
      settings: '++id, key',
      userXp: '++id, key',
      collectedWare: '++id, id, unlockedAt',
      trackingEvents: '++id, category, event, ts',
      webVitals: '++id, name, rating, ts',
    })

    // 版本 7：前端本地错误缓冲（P2-9）——纯本地，无外发（ADR-006）
    this.version(7).stores({
      tastings: '++id, teaId, date, overallScore, [teaId+date], brewTemp, steepTime',
      achievements: '++id, id, unlocked',
      settings: '++id, key',
      userXp: '++id, key',
      collectedWare: '++id, id, unlockedAt',
      trackingEvents: '++id, category, event, ts',
      webVitals: '++id, name, rating, ts',
      errorBuffer: '++id, kind, ts',
    })

    // 版本 8：匿名遥测待发队列（ADR-022）——outbox 是投递队列，与本地错误缓冲语义不同，
    // 需要 attempts/nextAttemptAt/status 三个投递状态字段，故单独立表
    this.version(8).stores({
      tastings: '++id, teaId, date, overallScore, [teaId+date], brewTemp, steepTime',
      achievements: '++id, id, unlocked',
      settings: '++id, key',
      userXp: '++id, key',
      collectedWare: '++id, id, unlockedAt',
      trackingEvents: '++id, category, event, ts',
      webVitals: '++id, name, rating, ts',
      errorBuffer: '++id, kind, ts',
      telemetryOutbox: '++id, status, nextAttemptAt, createdAt',
    })
  }
}

// 单例实例
export const db = new TeaCeremonyDB()

// ============ 初始化与迁移 ============

// 并发安全：缓存同一个 Promise。原写法用「完成后才置位的布尔标记」，并发调用方（应用启动时多个
// service 同时 initDB、或测试里 beforeEach 与未完成的上一次调用重叠）会一起进 db.open() 与迁移，
// 迁移期间的读写会和 clear() 之类交错，导致数据看起来「凭空多一条/少一条」。
let initPromise: Promise<void> | null = null

/** 打开数据库并完成一次性迁移；并发调用共享同一个 Promise，失败后允许重试。 */
export function initDB(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      await db.open()
      console.log('[Dexie] 数据库打开成功')
      // 首次运行：从 localStorage 迁移数据
      await migrateFromLocalStorage()
    } catch (error) {
      console.error('[Dexie] 数据库初始化失败:', error)
      initPromise = null // 失败不缓存，下次调用重试
      throw error
    }
  })()
  return initPromise
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
      const wareRecords = wareIds.map((id) => ({ id, unlockedAt: new Date().toISOString() }))
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
