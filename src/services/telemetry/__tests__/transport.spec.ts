/**
 * 传输层单测：src/services/telemetry/transport.ts（契约 §7）
 * 重点：beacon 失败降级、fetch 超时降级、连续 3 次失败开熔断、熔断期不发、60s 后半开放行。
 * 全部用假时钟 / 立即失败的 fetch，不真等 8s 或 60s。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BREAKER_OPEN_MS, BREAKER_THRESHOLD, FETCH_TIMEOUT_MS } from '../config'
import { isBreakerOpen, resetTransportForTest, send } from '../transport'
import type { TelemetryErrorEvent } from '../types'

const events: TelemetryErrorEvent[] = [
  {
    clientEventId: 'a1b2c3d4-0000-4000-8000-000000000001',
    type: 'error',
    occurredAt: '2026-10-17T00:00:00.000Z',
    route: '/brew',
    payload: {
      kind: 'error',
      message: 'boom',
      source: '/assets/index.js',
      fingerprint: '0123456789abcdef',
    },
  },
]

/** 最小 Response 替身：不依赖 jsdom 是否实现 fetch/Response */
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

function stubBeacon(returnValue: boolean): ReturnType<typeof vi.fn> {
  const beacon = vi.fn(() => returnValue)
  Object.defineProperty(navigator, 'sendBeacon', {
    value: beacon,
    configurable: true,
    writable: true,
  })
  return beacon
}

beforeEach(() => {
  resetTransportForTest()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  resetTransportForTest()
  Reflect.deleteProperty(navigator, 'sendBeacon')
})

describe('降级链（契约 §7）', () => {
  it('sendBeacon 返回 false → 降级到 fetch(keepalive)', async () => {
    const beacon = stubBeacon(false)
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await send(events, { preferBeacon: true })

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/v1/telemetry/batch')
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(result.ok).toBe(true)
    expect(result.accepted).toBe(1)
  })

  it('sendBeacon 返回 true → 不再发 fetch', async () => {
    const beacon = stubBeacon(true)
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await send(events, { preferBeacon: true })

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it('preferBeacon=false 时不调用 sendBeacon', async () => {
    const beacon = stubBeacon(true)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => okResponse()),
    )

    await send(events, { preferBeacon: false })
    expect(beacon).not.toHaveBeenCalled()
  })

  it('keepalive 网络错误 → 降级到普通 fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('keepalive body too large'))
      .mockResolvedValueOnce(okResponse())
    vi.stubGlobal('fetch', fetchMock)

    const result = await send(events, { preferBeacon: false })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit | undefined
    expect(secondInit?.keepalive).toBe(false)
    expect(result.ok).toBe(true)
  })

  it('HTTP 500 不再降级（换 fetch 模式同样被拒）', async () => {
    const fetchMock = vi.fn(async () => errorResponse(500))
    vi.stubGlobal('fetch', fetchMock)

    const result = await send(events, { preferBeacon: false })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(false)
    expect(result.status).toBe(500)
    expect(result.retryable).toBe(true)
  })

  it('HTTP 400 标记为不可重试', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => errorResponse(400)),
    )
    const result = await send(events, { preferBeacon: false })
    expect(result.ok).toBe(false)
    expect(result.retryable).toBe(false)
  })

  it('fetch 超时（8s）后降级；两级都超时则整体失败', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const promise = send(events, { preferBeacon: false })
    // 第 2 级 keepalive 超时 → 降级
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS)
    // 第 3 级普通 fetch 超时 → 整体失败
    await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS)

    const result = await promise
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.ok).toBe(false)
    expect(result.retryable).toBe(true)
  })
})

describe('熔断器（契约 §7）', () => {
  it(`连续 ${BREAKER_THRESHOLD} 次失败后打开，期间不再发请求`, async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('offline')
    })
    vi.stubGlobal('fetch', fetchMock)

    for (let i = 0; i < BREAKER_THRESHOLD; i++) {
      const result = await send(events, { preferBeacon: false })
      expect(result.ok).toBe(false)
    }
    expect(isBreakerOpen()).toBe(true)

    const callsBefore = fetchMock.mock.calls.length
    const blocked = await send(events, { preferBeacon: false })
    expect(fetchMock.mock.calls.length).toBe(callsBefore)
    expect(blocked.ok).toBe(false)
    expect(blocked.error).toBe('breaker-open')
  })

  it(`${BREAKER_OPEN_MS / 1000}s 后放行 1 次试探；成功则关闭熔断`, async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new TypeError('offline')
    })
    vi.stubGlobal('fetch', fetchMock)

    for (let i = 0; i < BREAKER_THRESHOLD; i++) await send(events, { preferBeacon: false })
    expect(isBreakerOpen()).toBe(true)

    // 时间未到：仍然拦
    vi.advanceTimersByTime(BREAKER_OPEN_MS - 1)
    const stillBlocked = await send(events, { preferBeacon: false })
    expect(stillBlocked.error).toBe('breaker-open')

    // 到期后半开：放行一次试探，后端恢复 → 关闭
    vi.advanceTimersByTime(1)
    fetchMock.mockImplementation(async () => okResponse())
    const probe = await send(events, { preferBeacon: false })
    expect(probe.ok).toBe(true)
    expect(isBreakerOpen()).toBe(false)
  })

  it('半开试探失败 → 重新打开熔断', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new TypeError('offline')
    })
    vi.stubGlobal('fetch', fetchMock)

    for (let i = 0; i < BREAKER_THRESHOLD; i++) await send(events, { preferBeacon: false })

    vi.advanceTimersByTime(BREAKER_OPEN_MS)
    const probe = await send(events, { preferBeacon: false })
    expect(probe.ok).toBe(false)
    expect(isBreakerOpen()).toBe(true)

    // 重新打开后立刻发又被拦（不必再等，但要等下一个窗口）
    const again = await send(events, { preferBeacon: false })
    expect(again.error).toBe('breaker-open')
  })

  it('一次成功即清零失败计数（偶发失败不累积到熔断）', async () => {
    let fail = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (fail) throw new TypeError('offline')
        return okResponse()
      }),
    )

    await send(events, { preferBeacon: false }) // 失败 1
    fail = false
    await send(events, { preferBeacon: false }) // 成功
    fail = true
    await send(events, { preferBeacon: false }) // 失败 1（计数已归零）
    await send(events, { preferBeacon: false }) // 失败 2

    expect(isBreakerOpen()).toBe(false)
  })
})
