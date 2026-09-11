/** 用户 XP 存储 */

import { db, initDB } from './db'

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
