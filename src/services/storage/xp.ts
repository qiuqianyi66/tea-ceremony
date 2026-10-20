/** 用户 XP 存储 */

import { db, initDB } from './db'

export const xpStorage = {
  async load(): Promise<number> {
    await initDB()
    // userXp 表主键是 ++id（历史 schema），key 非唯一索引；用 where().first()
    // 明确取首行（即下方 save 一直原地更新的那一行），避免 get({key}) 取行不确定。
    const record = await db.userXp.where('key').equals('tea-xp').first()
    return record?.value ?? 0
  },

  async save(xp: number): Promise<void> {
    await initDB()
    // userXp 表主键是 ++id（历史 schema），不带 id 的 put 只会新增一条重复行，
    // 而 load 取首行 → 同一 key 的后续写入永远读不到（XP 显示冻结在首次写入值）。
    // 故：保留最早一行就地更新，历史重复行一并清理，没有才插入。
    // 与 settings.ts 同款修法（2026-10-20 排雷发现 userXp 漏网，照修）。
    const ids = await db.userXp.where('key').equals('tea-xp').primaryKeys()
    if (ids.length === 0) {
      await db.userXp.add({ key: 'tea-xp', value: xp })
      return
    }
    await db.userXp.update(ids[0]!, { value: xp })
    if (ids.length > 1) await db.userXp.bulkDelete(ids.slice(1))
  },
}
