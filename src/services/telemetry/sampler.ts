/**
 * 采样与限流（契约 §8）
 * - 全局令牌桶：10 次请求 / 分钟，桶容量 10
 * - error：同指纹 5 分钟窗口只放行 1 条，其余累加计数
 * - vital：每页每指标只发 1 条
 *
 * 状态全在 module 级（SDK 全局只有一份限流器），测试用 resetSamplerForTest() 清空。
 */
import { DEDUPE_WINDOW_MS, RATE_BUCKET_CAP, RATE_LIMIT_PER_MIN } from './config'

/** 令牌桶：按时间补充，取不到令牌说明本分钟请求额度已用完，事件只入队 */
export class TokenBucket {
  private readonly capacity: number
  private readonly refillPerMinute: number
  private readonly clock: () => number
  private tokens: number
  private lastRefill: number

  constructor(
    capacity: number = RATE_BUCKET_CAP,
    refillPerMinute: number = RATE_LIMIT_PER_MIN,
    clock: () => number = () => Date.now(),
  ) {
    this.capacity = capacity
    this.refillPerMinute = refillPerMinute
    this.clock = clock
    this.tokens = capacity
    this.lastRefill = clock()
  }

  private refill(): void {
    const now = this.clock()
    const elapsed = now - this.lastRefill
    if (elapsed <= 0) return
    this.tokens = Math.min(this.capacity, this.tokens + (elapsed * this.refillPerMinute) / 60_000)
    this.lastRefill = now
  }

  /** 取一个令牌；false 表示本窗口额度已耗尽 */
  take(): boolean {
    this.refill()
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }

  reset(): void {
    this.tokens = this.capacity
    this.lastRefill = this.clock()
  }
}

interface DedupeEntry {
  lastAt: number
  /** 窗口内被拦下的条数（契约 §8 要求累积；契约 §3.1 未定义带出字段，暂只本地可见） */
  suppressed: number
}

const errorWindows = new Map<string, DedupeEntry>()
const sentVitals = new Set<string>()

/**
 * 同指纹去重：窗口内只放行 1 条。
 * 返回 false 时累加被拦计数（避免统计里把「同一 bug 刷屏」当成多个 bug）。
 */
export function shouldEmitError(fingerprint: string, now: number = Date.now()): boolean {
  const entry = errorWindows.get(fingerprint)
  if (entry && now - entry.lastAt < DEDUPE_WINDOW_MS) {
    entry.suppressed += 1
    return false
  }
  errorWindows.set(fingerprint, { lastAt: now, suppressed: 0 })
  return true
}

/** 某指纹在去重窗口内被拦下的条数（调试 / 未来随下一条带出用） */
export function getSuppressedCount(fingerprint: string): number {
  return errorWindows.get(fingerprint)?.suppressed ?? 0
}

/** vital 每页每指标 1 条：key 用 route + 指标名，路由变化后重新放行 */
export function shouldEmitVital(name: string, route: string): boolean {
  const key = `${route}|${name}`
  if (sentVitals.has(key)) return false
  sentVitals.add(key)
  return true
}

/** 清空全部采样状态（仅测试用） */
export function resetSamplerForTest(): void {
  errorWindows.clear()
  sentVitals.clear()
}
