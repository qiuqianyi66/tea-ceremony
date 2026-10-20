/**
 * 用户 XP 存储回归测试。
 *
 * 历史缺陷（与 settings 同款，2026-10-20 排雷发现未修）：userXp 表主键是 `++id`，
 * 旧 save() 用 `put({key, value})` 不带 id → 每次存 XP 新增一行重复记录；
 * load() 用 get({key}) 命中最早那一行 → 用户后续涨的 XP 永远读不到最新值。
 * 线上后果：成长/等级系统的 XP 显示冻结在首次写入值，且每存一次堆一行脏数据。
 *
 * 本文件只锁行为，不锁实现：写入后必须读回最新值；同一 key 不允许堆积重复行。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { db, initDB } from '@/services/storage'
import { xpStorage } from '@/services/storage/xp'

describe('xpStorage 覆盖写入', () => {
  beforeEach(async () => {
    await initDB()
    await db.userXp.clear()
  })

  it('二次写入后读回最新 XP', async () => {
    await xpStorage.save(10)
    expect(await xpStorage.load()).toBe(10)

    await xpStorage.save(50)
    expect(await xpStorage.load()).toBe(50)
  })

  it('多次写入不产生重复行', async () => {
    await xpStorage.save(1)
    await xpStorage.save(2)
    await xpStorage.save(3)
    const rows = await db.userXp.where('key').equals('tea-xp').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value).toBe(3)
  })

  it('写入会合并历史遗留的重复行', async () => {
    // 模拟旧版本留下的两行同 key 脏数据
    await db.userXp.add({ key: 'tea-xp', value: 100 })
    await db.userXp.add({ key: 'tea-xp', value: 200 })

    await xpStorage.save(300)
    const rows = await db.userXp.where('key').equals('tea-xp').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value).toBe(300)
  })

  it('未写入时返回 0', async () => {
    expect(await xpStorage.load()).toBe(0)
  })
})
