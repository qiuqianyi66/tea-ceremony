/** KV 设置存储 */

import { db, initDB } from './db'

export const settingsStorage = {
  async get<T>(key: string, defaultValue: T): Promise<T> {
    await initDB()
    const record = await db.settings.get({ key })
    return (record?.value as T) ?? defaultValue
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
