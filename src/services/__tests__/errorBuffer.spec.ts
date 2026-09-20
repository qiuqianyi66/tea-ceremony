/**
 * 前端本地错误缓冲单测（P2-9）：src/services/errorBuffer.ts
 * 覆盖：写入/读取、容量上限裁剪、无网络外发（隐私安全）、recordError 永不 reject。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, initDB } from '@/services/storage'
import { clearErrors, listErrors, MAX_ERRORS, recordError } from '@/services/errorBuffer'

beforeEach(async () => {
  await initDB()
  await db.errorBuffer.clear()
})

describe('errorBuffer 基础写入与读取', () => {
  it('写入错误后按时间倒序读出（最近在前）', async () => {
    await recordError({ kind: 'error', message: '第一处', source: '/app.js', lineno: 1, colno: 2 })
    await recordError({ kind: 'unhandledrejection', message: '第二处', stack: 'at fn (app.js:3)' })

    const list = await listErrors()
    expect(list).toHaveLength(2)
    expect(list[0].message).toBe('第二处')
    expect(list[1].message).toBe('第一处')
    expect(list[1].kind).toBe('error')
    expect(list[1].source).toBe('/app.js')
    expect(typeof list[0].ts).toBe('string')
  })

  it('clearErrors 清空全部记录', async () => {
    await recordError({ kind: 'error', message: 'x' })
    await clearErrors()
    expect(await db.errorBuffer.count()).toBe(0)
    expect(await listErrors()).toEqual([])
  })
})

describe('errorBuffer 容量上限（防本地无限膨胀）', () => {
  it(`超过 ${MAX_ERRORS} 条时裁剪最旧，总数不超上限`, async () => {
    const now = Date.now()
    // 先写 100 条"旧错误"（ts 靠前）
    for (let i = 0; i < 100; i++) {
      await db.errorBuffer.add({ kind: 'error', message: `old_${i}`, ts: new Date(now - 100000 + i).toISOString() })
    }
    // 再写 MAX_ERRORS 条新错误 → 触发裁剪
    for (let i = 0; i < MAX_ERRORS; i++) {
      await recordError({ kind: 'error', message: `new_${i}` })
    }
    const count = await db.errorBuffer.count()
    expect(count).toBeLessThanOrEqual(MAX_ERRORS)
    // 最旧的 old_* 已被裁剪（保新弃旧）
    const olds = await db.errorBuffer.toArray()
    expect(olds.every((r) => !r.message.startsWith('old_'))).toBe(true)
  })
})

describe('errorBuffer 隐私与健壮性', () => {
  it('recordError 永不发起网络请求（纯本地，无外发）', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await recordError({ kind: 'error', message: 'x' })
    await listErrors()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })

  it('recordError 永不 reject（缓冲失败不影响主流程）', async () => {
    await expect(recordError({ kind: 'error', message: 'x' })).resolves.toBeUndefined()
  })
})
