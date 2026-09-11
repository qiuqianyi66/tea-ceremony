/** 成就存储 */

import type { Achievement } from '@/types/tasting'
import { db, initDB } from './db'

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
