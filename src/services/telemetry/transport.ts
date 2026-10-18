/**
 * 遥测传输层（契约 §7：多级兜底 + 熔断）
 *
 * 降级链：sendBeacon（仅 preferBeacon）→ fetch(keepalive) → 普通 fetch + 8s 超时。
 * 熔断：连续 3 次失败打开 60s，期间只入队不发；到期放行 1 次试探，成功即关闭。
 *
 * 承重墙：send() 永不 throw，所有失败都 resolve 成 `{ ok: false }`，
 * 调用方（index.ts flush）不需要 try/catch。与 teaAI.ts 的降级同级。
 */
import { API_BASE } from '@/services/apiBase'
import {
  BATCH_MAX,
  BREAKER_OPEN_MS,
  BREAKER_THRESHOLD,
  FETCH_TIMEOUT_MS,
  TELEMETRY_PATH,
} from './config'
import { getAppVersion, getClientId, getSessionId } from './identity'
import type {
  TelemetryApiResponse,
  TelemetryBatchData,
  TelemetryBatchRequest,
  TelemetryBatchResult,
  TelemetryEvent,
} from './types'

/** 不探 API_BASE 是否为空：apiBase.ts 已保证含 /api 前缀 */
const ENDPOINT = `${API_BASE}${TELEMETRY_PATH}`

export interface SendOptions {
  /** true 时优先用 sendBeacon（只在 pagehide / visibilitychange→hidden 冲刷时用） */
  preferBeacon: boolean
}

interface BreakerState {
  /** 连续失败次数（成功即清零） */
  failures: number
  /** 熔断打开时刻；null 表示关闭 */
  openedAt: number | null
  /** 半开状态是否已有试探在飞（保证只放行 1 次） */
  probing: boolean
}

const breaker: BreakerState = { failures: 0, openedAt: null, probing: false }

/** 令牌取自 Date.now()：测试用 vi.useFakeTimers() 即可控制熔断时间窗 */
function now(): number {
  return Date.now()
}

function successResult(accepted: number, data?: TelemetryBatchData): TelemetryBatchResult {
  return {
    ok: true,
    accepted: data?.accepted ?? accepted,
    duplicated: data?.duplicated ?? 0,
    rejected: data?.rejected ?? 0,
    retryable: false,
  }
}

function failureResult(error: string, retryable: boolean, status?: number): TelemetryBatchResult {
  const base: TelemetryBatchResult = {
    ok: false,
    accepted: 0,
    duplicated: 0,
    rejected: 0,
    retryable,
    error,
  }
  // exactOptionalPropertyTypes：不能显式赋 undefined，用条件展开
  return status === undefined ? base : { ...base, status }
}

/** 熔断闸门：返回是否放行。半开只放行一个试探 */
function acquireSlot(): { allowed: boolean; reason: string } {
  if (breaker.openedAt === null) return { allowed: true, reason: 'closed' }

  if (now() - breaker.openedAt < BREAKER_OPEN_MS) {
    return { allowed: false, reason: 'breaker-open' }
  }
  if (breaker.probing) return { allowed: false, reason: 'breaker-half-open' }
  breaker.probing = true
  return { allowed: true, reason: 'half-open' }
}

function recordSuccess(): void {
  breaker.failures = 0
  breaker.openedAt = null
  breaker.probing = false
}

function recordFailure(): void {
  breaker.failures += 1
  breaker.probing = false
  // 半开试探失败 → 立即重新打开；关闭态攒够阈值 → 打开
  if (breaker.openedAt !== null || breaker.failures >= BREAKER_THRESHOLD) {
    breaker.openedAt = now()
  }
}

function buildRequest(events: TelemetryEvent[]): TelemetryBatchRequest {
  return {
    clientId: getClientId(),
    sessionId: getSessionId(),
    appVersion: getAppVersion(),
    sentAt: new Date().toISOString(),
    events,
  }
}

/**
 * sendBeacon 分支：只能拿到 true/false，拿不到响应体。
 * 返回 true 视为送达（accepted 按事件数乐观计）——服务端 client_event_id 幂等，重复投递无副作用。
 */
function sendViaBeacon(body: string): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false
  try {
    const blob = new Blob([body], { type: 'application/json' })
    return navigator.sendBeacon(ENDPOINT, blob) === true
  } catch {
    // blob 过大 / 队列满都可能抛，交给下一级 fetch
    return false
  }
}

type AttemptOutcome =
  | { kind: 'ok'; result: TelemetryBatchResult }
  | { kind: 'http-error'; result: TelemetryBatchResult }
  | { kind: 'network-error' }

/**
 * 单次 fetch 尝试。
 * - 网络错误 / 超时 → network-error，交给下一级重试（keepalive 失败常因体积超 64KB，普通 fetch 能救）
 * - HTTP 非 2xx → http-error，不再降级（换一种 fetch 同样会被拒）
 * - credentials: 'omit' → 匿名端点不需要凭据，也避免复用 http.ts 带来的 401 跳登录副作用
 */
async function postJson(body: string, keepalive: boolean, sent: number): Promise<AttemptOutcome> {
  const controller = new AbortController()
  // keepalive 也挂超时：挂起的请求会让 flush 永远 pending，记录卡在 inflight 无法重试
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive,
      credentials: 'omit',
      signal: controller.signal,
    })

    if (!res.ok) {
      // 400 = 请求体不合契约（重试不会变好）；其余 5xx/429 值得退避重试
      return {
        kind: 'http-error',
        result: failureResult(`HTTP ${res.status}`, res.status !== 400, res.status),
      }
    }

    let payload: TelemetryApiResponse<TelemetryBatchData> | null = null
    try {
      payload = (await res.json()) as TelemetryApiResponse<TelemetryBatchData>
    } catch {
      // 200 但响应体不是 JSON：服务端已收到请求，按送达处理（不重试，避免重复风暴）
      payload = null
    }
    return { kind: 'ok', result: successResult(sent, payload?.data) }
  } catch {
    return { kind: 'network-error' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 发送一批事件（契约 §7 降级链）。
 * 永不 reject：熔断打开时直接返回 `{ ok: false, error: 'breaker-open' }`，调用方据此只入队。
 */
export async function send(
  events: TelemetryEvent[],
  opts: SendOptions,
): Promise<TelemetryBatchResult> {
  if (events.length === 0) return successResult(0)

  // 防御性截断：契约 §1 规定单请求 ≤50，多余部分仍留在 outbox（调用方按 BATCH_MAX 取批）
  const batch = events.length > BATCH_MAX ? events.slice(0, BATCH_MAX) : events

  const slot = acquireSlot()
  if (!slot.allowed) return failureResult(slot.reason, true)

  let body: string
  try {
    body = JSON.stringify(buildRequest(batch))
  } catch {
    // 序列化失败多半是单条数据异常，重试无意义
    recordFailure()
    return failureResult('serialize-failed', false)
  }

  // 第 1 级：sendBeacon（只在页面即将卸载时才有价值）
  if (opts.preferBeacon && sendViaBeacon(body)) {
    recordSuccess()
    return successResult(batch.length)
  }

  // 第 2 级：fetch(keepalive)
  const keepaliveOutcome = await postJson(body, true, batch.length)
  if (keepaliveOutcome.kind === 'ok') {
    recordSuccess()
    return keepaliveOutcome.result
  }
  if (keepaliveOutcome.kind === 'http-error') {
    recordFailure()
    return keepaliveOutcome.result
  }

  // 第 3 级：普通 fetch（AbortController 8s 超时已在 postJson 内）
  const plainOutcome = await postJson(body, false, batch.length)
  if (plainOutcome.kind === 'ok') {
    recordSuccess()
    return plainOutcome.result
  }
  recordFailure()
  return plainOutcome.kind === 'http-error'
    ? plainOutcome.result
    : failureResult('network-error', true)
}

/** 熔断器当前是否打开（本地诊断 / 测试断言用） */
export function isBreakerOpen(): boolean {
  return breaker.openedAt !== null && now() - breaker.openedAt < BREAKER_OPEN_MS
}

/** 重置熔断与内部状态（仅测试用） */
export function resetTransportForTest(): void {
  breaker.failures = 0
  breaker.openedAt = null
  breaker.probing = false
}
