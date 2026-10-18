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
    // settings 表主键是 ++id（历史 schema），不带 id 的 put 只会新增一条重复行，
    // 而 get({key}) 取的是最早那条 → 同一 key 的后续写入永远读不到（设置改了不生效）。
    // 故：保留最早一行就地更新，历史重复行一并清理，没有才插入。
    const ids = await db.settings.where('key').equals(key).primaryKeys()
    if (ids.length === 0) {
      await db.settings.add({ key, value })
      return
    }
    await db.settings.update(ids[0]!, { value })
    if (ids.length > 1) await db.settings.bulkDelete(ids.slice(1))
  },

  async delete(key: string): Promise<void> {
    await initDB()
    // 同 set：按 key 查而非按自增主键删，否则一行都删不掉
    await db.settings.where('key').equals(key).delete()
  },
}
