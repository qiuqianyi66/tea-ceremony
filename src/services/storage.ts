/**
 * 本地存储服务
 * 封装 localStorage，提供类型安全的数据读写
 */

import type { TastingRecord } from '@/types/tasting'
import type { Achievement } from '@/types/tasting'

const KEYS = {
  HISTORY: 'tea-history',
  ACHIEVEMENTS: 'tea-achievements',
  SETTINGS: 'tea-settings',
} as const

/** 通用存储操作 */
function load<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : defaultValue
  } catch {
    return defaultValue
  }
}

function save<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.error('存储失败:', e)
  }
}

/** 品鉴历史 */
export const historyStorage = {
  load(): TastingRecord[] {
    return load<TastingRecord[]>(KEYS.HISTORY, [])
  },

  save(records: TastingRecord[]): void {
    save(KEYS.HISTORY, records)
  },

  add(record: TastingRecord): TastingRecord[] {
    const records = this.load()
    records.unshift(record)
    this.save(records)
    return records
  },

  clear(): void {
    save(KEYS.HISTORY, [])
  },
}

/** 成就数据 */
export const achievementStorage = {
  load(): Achievement[] {
    return load<Achievement[]>(KEYS.ACHIEVEMENTS, [])
  },

  save(achievements: Achievement[]): void {
    save(KEYS.ACHIEVEMENTS, achievements)
  },

  unlock(achievementId: string): Achievement[] {
    const achievements = this.load()
    const target = achievements.find(a => a.id === achievementId)
    if (target && !target.unlocked) {
      target.unlocked = true
      target.unlockedAt = new Date().toISOString()
      this.save(achievements)
    }
    return achievements
  },
}
