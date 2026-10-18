/**
 * 前端遥测 SDK 对外唯一出口（契约 docs/reference/telemetry-contract.md，ADR-022）
 *
 * 硬约束：
 * 1. 所有导出函数永不 throw 到业务层（承重墙，与 teaAI.ts 的降级同级）。
 * 2. 不用 setInterval 常驻轮询：有事件时 debounce 2s 触发一次 flush，另有 60s 兜底
 *    （仅页面可见时跑，后台标签页不耗电不耗带宽）。
 * 3. 开关关闭时：不注册任何监听、reportXxx 直接 return（ADR-022 §7）。
 */
import type { ErrorBufferRecord } from '@/types/errors'
import { initDB, settingsStorage } from '@/services/storage'
import {
  BATCH_MAX,
  FALLBACK_FLUSH_MS,
  FLUSH_DEBOUNCE_MS,
  MAX_MESSAGE_LEN,
  MAX_ROUTE_LEN,
  MAX_SOURCE_LEN,
  MAX_STACK_LEN,
  STARTUP_FLUSH_DELAY_MS,
  TELEMETRY_ENABLED_DEFAULT,
  TELEMETRY_ENABLED_KEY,
  VITAL_NAMES,
  backoffDelay,
} from './config'
import { fingerprint, toPathname } from './fingerprint'
import { getSessionId, randomId, resetIdentityForTest } from './identity'
import {
  clearOutbox,
  enqueue,
  markDead,
  markFailed,
  markSent,
  pendingCount,
  requeueInflight,
  takeBatch,
} from './outbox'
import { TokenBucket, resetSamplerForTest, shouldEmitError, shouldEmitVital } from './sampler'
import { isBreakerOpen, resetTransportForTest, send } from './transport'
import type {
  TelemetryErrorEvent,
  TelemetryEvent,
  TelemetryVitalEvent,
  TelemetryVitalName,
  TelemetryVitalRating,
  TelemetryVitalPayload,
} from './types'

/** reportVital 的入参：只取 web-vitals Metric 与 WebVitalRecord 的共有字段，SDK 不依赖 web-vitals 类型 */
export interface VitalInput {
  name: string
  value: number
  rating: string
  navigationType?: string
}

export interface FlushOptions {
  /** true 时优先 sendBeacon（页面卸载路径专用） */
  preferBeacon?: boolean
}

const bucket = new TokenBucket()

let initialized = false
/** 默认开启：initTelemetry 读到设置后会被覆盖 */
let enabled = true
let flushing = false
let debounceTimer: number | null = null
let fallbackTimer: number | null = null
let startupTimer: number | null = null

// ============ 内部工具 ============

function narrowVitalName(name: string): TelemetryVitalName | null {
  const hit = VITAL_NAMES.find((item) => item === name)
  return hit ?? null
}

function narrowRating(rating: string): TelemetryVitalRating | null {
  if (rating === 'good' || rating === 'needs-improvement' || rating === 'poor') return rating
  return null
}

function currentRoute(): string {
  if (typeof window === 'undefined') return '/'
  try {
    return window.location.pathname.slice(0, MAX_ROUTE_LEN) || '/'
  } catch {
    return '/'
  }
}

/** debounce 触发：有事件时合并 2s 内的高频上报，避免一串错误打出 N 个请求 */
function scheduleFlush(): void {
  if (!enabled || typeof window === 'undefined' || debounceTimer !== null) return
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null
    void flush()
  }, FLUSH_DEBOUNCE_MS)
}

function clearFallbackTimer(): void {
  if (typeof window === 'undefined' || fallbackTimer === null) return
  window.clearTimeout(fallbackTimer)
  fallbackTimer = null
}

/** 兜底 flush：setTimeout 递归而非 setInterval，页面隐藏时不排下一轮 */
function startFallbackLoop(): void {
  if (!enabled || typeof window === 'undefined' || fallbackTimer !== null) return
  fallbackTimer = window.setTimeout(() => {
    fallbackTimer = null
    void flush().then(() => {
      if (enabled && document.visibilityState !== 'hidden') startFallbackLoop()
    })
  }, FALLBACK_FLUSH_MS)
}

function clearTimers(): void {
  if (typeof window === 'undefined') return
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (startupTimer !== null) {
    window.clearTimeout(startupTimer)
    startupTimer = null
  }
  clearFallbackTimer()
}

// ============ 事件监听（页面卸载 / 网络恢复）============

function handlePageHide(): void {
  // 页面要走了，beacon 是唯一还有机会送达的通道
  void flush({ preferBeacon: true })
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    clearFallbackTimer()
    void flush({ preferBeacon: true })
    return
  }
  startFallbackLoop()
}

function handleOnline(): void {
  // 网络恢复：立刻重试，不等 60s 兜底
  void flush()
}

function attachListeners(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('online', handleOnline)
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

function detachListeners(): void {
  if (typeof window === 'undefined') return
  window.removeEventListener('pagehide', handlePageHide)
  window.removeEventListener('online', handleOnline)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
}

// ============ 对外 API ============

/**
 * 初始化遥测（幂等）。
 * 顺序有意义：先读开关 → 再动 IndexedDB / 存储，关闭时零副作用。
 */
export async function initTelemetry(): Promise<void> {
  if (initialized) return
  initialized = true
  try {
    enabled = await settingsStorage.get(TELEMETRY_ENABLED_KEY, TELEMETRY_ENABLED_DEFAULT)
    if (!enabled) return

    await initDB()
    // 上个会话若在发送中被关闭，记录会卡在 inflight，先放回队列（服务端幂等去重）
    await requeueInflight()
    // 提前钉住会话 ID，保证本次会话所有事件同一 sessionId
    getSessionId()
    attachListeners()

    // 首屏带宽优先：积压补发延后 3s
    if (typeof window !== 'undefined') {
      startupTimer = window.setTimeout(() => {
        startupTimer = null
        void flush()
      }, STARTUP_FLUSH_DELAY_MS)
    }
    startFallbackLoop()
  } catch {
    // 初始化失败静默：遥测不可用不影响业务
  }
}

/** 上报一条脚本错误（由 errorBuffer.recordError 追加调用） */
export async function reportError(entry: Omit<ErrorBufferRecord, 'ts' | 'id'>): Promise<void> {
  if (!enabled) return
  try {
    const source = toPathname(entry.source ?? '')
    const errorFingerprint = fingerprint(entry.kind, source, entry.lineno, entry.message)
    // 采样在前：被去重拦下的事件连入队都不做，省 IndexedDB 写入
    if (!shouldEmitError(errorFingerprint)) return

    const event: TelemetryErrorEvent = {
      clientEventId: randomId(),
      type: 'error',
      occurredAt: new Date().toISOString(),
      route: currentRoute(),
      payload: {
        kind: entry.kind,
        message: entry.message.slice(0, MAX_MESSAGE_LEN),
        source: source.slice(0, MAX_SOURCE_LEN),
        fingerprint: errorFingerprint,
        ...(entry.lineno === undefined ? {} : { lineno: entry.lineno }),
        ...(entry.colno === undefined ? {} : { colno: entry.colno }),
        ...(entry.stack ? { stack: entry.stack.slice(0, MAX_STACK_LEN) } : {}),
      },
    }

    await enqueue([event])
    scheduleFlush()
  } catch {
    // 永不 throw
  }
}

/** 上报一条 Web Vitals 指标（由 vitals.saveVital 追加调用） */
export async function reportVital(metric: VitalInput): Promise<void> {
  if (!enabled) return
  try {
    const name = narrowVitalName(metric.name)
    const rating = narrowRating(metric.rating)
    // 契约 §3.2 只允许五个指标与三档评级，其余静默丢弃（web-vitals 还可能有 FID 等旧指标）
    if (!name || !rating) return

    const route = currentRoute()
    if (!shouldEmitVital(name, route)) return

    const payload: TelemetryVitalPayload = {
      name,
      // 与本地 webVitals 表一致：保留 3 位小数
      value: Math.round(metric.value * 1000) / 1000,
      rating,
      ...(metric.navigationType ? { navigationType: metric.navigationType } : {}),
    }
    const event: TelemetryVitalEvent = {
      clientEventId: randomId(),
      type: 'vital',
      occurredAt: new Date().toISOString(),
      route,
      payload,
    }

    await enqueue([event])
    scheduleFlush()
  } catch {
    // 永不 throw
  }
}

/**
 * 冲刷 outbox：取到期的 queued 记录 → 发送 → 按结果出队 / 退避 / 标 dead。
 * 令牌桶超限或熔断打开时只入队不发（契约 §8 / §7）。
 */
export async function flush(opts: FlushOptions = {}): Promise<void> {
  if (!enabled || flushing) return
  try {
    // 熔断打开时先短路：不取批、不消耗令牌，更不消耗重试次数
    if (isBreakerOpen()) return
    const pending = await pendingCount()
    if (pending === 0) return
    // 先查后取：令牌桶不该被空批次消耗掉额度
    if (!bucket.take()) return

    flushing = true
    const records = await takeBatch(BATCH_MAX)
    if (records.length === 0) return

    const ids = records
      .map((record) => record.id)
      .filter((id): id is number => typeof id === 'number')
    if (ids.length === 0) return

    const events: TelemetryEvent[] = records.map((record) => record.event)
    const result = await send(events, { preferBeacon: opts.preferBeacon === true })

    if (result.ok) {
      await markSent(ids)
      return
    }
    if (!result.retryable) {
      // 契约错误（如 400）：重试不会变好，标 dead 免得占队列
      await markDead(ids)
      return
    }
    if (result.error === 'breaker-open' || result.error === 'breaker-half-open') {
      // 被熔断拦下不是投递失败，不该累积 attempts（否则熔断期反复冲刷会把事件刷成 dead）
      await requeueInflight()
      return
    }
    const attempts = Math.max(...records.map((record) => record.attempts))
    await markFailed(ids, backoffDelay(attempts))
  } catch {
    // 永不 throw；异常时记录留在 inflight，下次启动 requeueInflight 会放回队列
  } finally {
    flushing = false
  }
}

/** 同步读取当前开关状态（运行时标志，供 UI 快速回显） */
export function isTelemetryEnabled(): boolean {
  return enabled
}

/** 读取持久化的开关值（设置页首次渲染用；与运行时标志可能有一瞬差异） */
export async function getTelemetryEnabledSetting(): Promise<boolean> {
  try {
    return await settingsStorage.get(TELEMETRY_ENABLED_KEY, TELEMETRY_ENABLED_DEFAULT)
  } catch {
    return TELEMETRY_ENABLED_DEFAULT
  }
}

/** 设置开关（设置页调用）：关闭时立即摘监听停调度，开启时重新初始化 */
export async function setTelemetryEnabled(value: boolean): Promise<void> {
  try {
    await settingsStorage.set(TELEMETRY_ENABLED_KEY, value)
  } catch {
    // 持久化失败也要让本次会话生效，只是下次刷新会回到旧值
  }

  if (!value) {
    enabled = false
    // 复位 initialized：重新开启时要能重新读设置、重新挂监听
    initialized = false
    detachListeners()
    clearTimers()
    return
  }

  enabled = true
  if (initialized) return
  await initTelemetry()
}

/** 熔断中？（设置页/健康页可展示，或排查上报静默问题时用） */
export function isTelemetryCircuitOpen(): boolean {
  return isBreakerOpen()
}

/** 仅测试用：重置全部模块级状态（定时器 / 监听 / 熔断 / 采样 / 身份） */
export function resetTelemetryForTest(): void {
  detachListeners()
  clearTimers()
  initialized = false
  enabled = true
  flushing = false
  bucket.reset()
  resetSamplerForTest()
  resetTransportForTest()
  resetIdentityForTest()
}

// 便于测试与排查：清空队列（用户隐私管理也用这个）
export { clearOutbox as clearTelemetryOutbox }
