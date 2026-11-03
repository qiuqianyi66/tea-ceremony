/**
 * initDB 并发安全性（还原 bug：原实现用「完成后才置位的布尔标记」，
 * 并发调用会各自进 db.open() 与一次性迁移，迁移期间的读写会与 clear() 交错）。
 */
import { describe, expect, it, vi } from 'vitest'
import { db, initDB } from '@/services/storage/db'

describe('initDB 并发安全', () => {
  it('并发调用只真正打开一次数据库', async () => {
    const openSpy = vi.spyOn(db, 'open')
    await Promise.all([initDB(), initDB(), initDB()])
    expect(openSpy).toHaveBeenCalledTimes(1)
    expect(db.isOpen()).toBe(true)
    openSpy.mockRestore()
  })
})
