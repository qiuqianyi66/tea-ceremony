/**
 * 遥测 SDK 端到端单测：src/services/telemetry/index.ts
 * 重点：reportError → outbox → flush 成功清空；后端 500 时留在队列且 attempts 递增；
 *       开关关闭时零采集；pagehide 走 beacon；vital 每页每指标 1 条。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, initDB, settingsStorage } from '@/services/storage'
import {
  clearTelemetryOutbox,
  flush,
  initTelemetry,
  isTelemetryEnabled,
  reportError,
  reportVital,
  resetTelemetryForTest,
  setTelemetryEnabled,
} from '@/services/telemetry'
import { pendingCount } from '../outbox'
import { TELEMETRY_ENABLED_KEY } from '../config'

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      code: 'OK',
      message: 'success',
      data: { accepted: 1, duplicated: 0, rejected: 0 },
    }),
  } as unknown as Response
}

function errorResponse(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as unknown as Response
}

/** 轮询等待异步落库（outbox 读写走 IndexedDB，不保证在同一 microtask 完成） */
async function waitUntil(check: () => Promise<boolean>, timeoutMs = 3_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error('waitUntil 超时')
}

beforeEach(async () => {
  await initDB()
  await clearTelemetryOutbox()
  // 设置表是本文件唯一会跨用例泄漏的状态（开关用例会写 false）
  await settingsStorage.delete(TELEMETRY_ENABLED_KEY)
  resetTelemetryForTest()
})

afterEach(() => {
  resetTelemetryForTest()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'sendBeacon')
})

describe('端到端：错误上报', () => {
  it('reportError → outbox 有 1 条 → flush 成功 → outbox 清空', async () => {
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    await reportError({ kind: 'error', message: 'boom', source: '/assets/index.js', lineno: 1234 })
    expect(await pendingCount()).toBe(1)

    await flush()
    expect(await pendingCount()).toBe(0)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/telemetry/batch')
    const body = JSON.parse(String(init.body)) as {
      clientId: string
      sessionId: string
      appVersion: string
      events: Array<{ type: string; payload: { fingerprint: string; source: string } }>
    }
    expect(body.events).toHaveLength(1)
    expect(body.clientId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.sessionId).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.events[0]?.type).toBe('error')
    expect(body.events[0]?.payload.fingerprint).toMatch(/^[0-9a-f]{16}$/)
    // 契约 §3.1：source 只留 pathname
    expect(body.events[0]?.payload.source).toBe('/assets/index.js')
  })

  it('后端 500 时 flush 失败：事件留在 outbox 且 attempts 递增', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => errorResponse(500)),
    )

    await reportError({ kind: 'error', message: 'boom-500', source: '/assets/b.js', lineno: 1 })
    await flush()

    expect(await pendingCount()).toBe(1)
    const records = await db.telemetryOutbox.toArray()
    expect(records).toHaveLength(1)
    expect(records[0]?.attempts).toBe(1)
    expect(records[0]?.status).toBe('queued')
    // 退避表首项 1s：下次到期时间在未来
    expect(records[0]?.nextAttemptAt ?? 0).toBeGreaterThan(Date.now())
  })

  it('同指纹 5 分钟内只入队 1 条', async () => {
    await reportError({ kind: 'error', message: 'same', source: '/a.js', lineno: 10 })
    await reportError({ kind: 'error', message: 'same', source: '/a.js', lineno: 11 })
    expect(await pendingCount()).toBe(1)
  })

  it('入队即触发 debounce 调度（2s 后自动 flush）', async () => {
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    await reportError({ kind: 'error', message: 'debounce', source: '/c.js', lineno: 1 })
    expect(await pendingCount()).toBe(1)

    // 真等 debounce（FLUSH_DEBOUNCE_MS = 2s），比替身更能证明调度真的挂上了
    await waitUntil(async () => (await pendingCount()) === 0, 5_000)
    expect(fetchMock).toHaveBeenCalled()
  }, 10_000)
})

describe('端到端：指标上报', () => {
  it('vital 每页每指标只入队 1 条，值保留 3 位小数', async () => {
    await reportVital({ name: 'LCP', value: 1234.5678, rating: 'good', navigationType: 'navigate' })
    await reportVital({ name: 'LCP', value: 2000, rating: 'good' })

    expect(await pendingCount()).toBe(1)
    const record = (await db.telemetryOutbox.toArray())[0]
    const event = record?.event
    expect(event?.type).toBe('vital')
    if (event?.type !== 'vital') throw new Error('expected vital event')
    expect(event.payload.name).toBe('LCP')
    expect(event.payload.value).toBe(1234.568)
    expect(event.payload.navigationType).toBe('navigate')
  })

  it('非法指标名 / 评级被静默丢弃', async () => {
    await reportVital({ name: 'FID', value: 12, rating: 'good' })
    await reportVital({ name: 'CLS', value: 0.05, rating: 'weird' })
    expect(await pendingCount()).toBe(0)
  })
})

describe('开关（ADR-022 §7）', () => {
  it('关闭后 initTelemetry 不注册监听，reportXxx 直接 return', async () => {
    await settingsStorage.set(TELEMETRY_ENABLED_KEY, false)
    resetTelemetryForTest()
    const addSpy = vi.spyOn(window, 'addEventListener')

    await initTelemetry()
    await reportError({ kind: 'error', message: 'disabled', source: '/a.js', lineno: 1 })
    await reportVital({ name: 'LCP', value: 1000, rating: 'good' })

    expect(isTelemetryEnabled()).toBe(false)
    expect(addSpy).not.toHaveBeenCalled()
    expect(await pendingCount()).toBe(0)
    addSpy.mockRestore()
  })

  it('开启时 initTelemetry 注册 pagehide 并在卸载时用 beacon 冲刷', async () => {
    const beacon = vi.fn(() => true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beacon,
      configurable: true,
      writable: true,
    })

    await initTelemetry()
    expect(isTelemetryEnabled()).toBe(true)

    await reportError({ kind: 'error', message: 'on-pagehide', source: '/a.js', lineno: 1 })
    expect(await pendingCount()).toBe(1)

    window.dispatchEvent(new Event('pagehide'))
    await waitUntil(async () => (await pendingCount()) === 0)
    expect(beacon).toHaveBeenCalledTimes(1)
  })

  it('关闭后再开启会重新挂监听并恢复上报', async () => {
    await initTelemetry()
    await setTelemetryEnabled(false)
    expect(isTelemetryEnabled()).toBe(false)

    await reportError({ kind: 'error', message: 'off', source: '/a.js', lineno: 1 })
    expect(await pendingCount()).toBe(0)

    const addSpy = vi.spyOn(window, 'addEventListener')
    await setTelemetryEnabled(true)
    expect(isTelemetryEnabled()).toBe(true)
    // 关键：关闭时复位了 initialized，重新开启必须重新挂上 pagehide / online 监听
    expect(addSpy).toHaveBeenCalled()

    await reportError({ kind: 'error', message: 'on-again', source: '/b.js', lineno: 1 })
    expect(await pendingCount()).toBe(1)
    addSpy.mockRestore()
  })
})
