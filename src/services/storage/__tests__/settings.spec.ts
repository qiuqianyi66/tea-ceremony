/**
 * KV 设置存储回归测试。
 *
 * 历史缺陷（2026-10-17 修复）：settings 表主键是 `++id`，旧 set() 用
 * `put({key, value})` 不带 id → 每次写入新增一行重复记录；而 get() 命中最早那一行
 * → 同一 key 的后续写入永远读不到。线上后果：用户关掉遥测后刷新页面又自动打开。
 *
 * 本文件只锁行为，不锁实现：写入后必须读回最新值；同一 key 不允许堆积重复行。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { db, initDB } from '@/services/storage'
import { settingsStorage } from '@/services/storage/settings'

describe('settingsStorage 覆盖写入', () => {
  beforeEach(async () => {
    await initDB()
    await db.settings.clear()
  })

  it('同一 key 二次写入后读回最新值', async () => {
    await settingsStorage.set('telemetry-enabled', true)
    expect(await settingsStorage.get('telemetry-enabled', false)).toBe(true)

    await settingsStorage.set('telemetry-enabled', false)
    expect(await settingsStorage.get('telemetry-enabled', true)).toBe(false)
  })

  it('同一 key 多次写入不产生重复行', async () => {
    await settingsStorage.set('a', 1)
    await settingsStorage.set('a', 2)
    await settingsStorage.set('a', 3)
    const rows = await db.settings.where('key').equals('a').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value).toBe(3)
  })

  it('写入会合并历史遗留的重复行', async () => {
    // 模拟旧版本留下的两行同 key 脏数据
    await db.settings.add({ key: 'legacy', value: 'old-1' })
    await db.settings.add({ key: 'legacy', value: 'old-2' })

    await settingsStorage.set('legacy', 'new')
    const rows = await db.settings.where('key').equals('legacy').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value).toBe('new')
  })

  it('delete 按 key 删除（不是按自增主键）', async () => {
    await settingsStorage.set('gone', true)
    await settingsStorage.delete('gone')
    expect(await settingsStorage.get('gone', 'fallback')).toBe('fallback')
    expect(await db.settings.where('key').equals('gone').count()).toBe(0)
  })

  it('未写入的 key 返回默认值', async () => {
    expect(await settingsStorage.get('never-set', 'dft')).toBe('dft')
  })
})
