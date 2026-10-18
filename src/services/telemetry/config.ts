/**
 * 遥测 SDK 全部可调参数（唯一来源；禁止在其他文件硬编码数字）
 * 依据：docs/reference/telemetry-contract.md + ADR-022
 */

// ============ 传输 ============

/** 单请求事件上限（契约 §1：≤50 条/请求） */
export const BATCH_MAX = 50

/** outbox 容量上限（契约 §8：500 条），超限淘汰最旧 */
export const OUTBOX_MAX = 500

/** 遥测端点路径；API_BASE 已含 /api（见 services/apiBase.ts） */
export const TELEMETRY_PATH = '/v1/telemetry/batch'

/** 单次 fetch 超时（契约 §7：8s AbortController） */
export const FETCH_TIMEOUT_MS = 8_000

/**
 * 退避表：第 n 次失败后等待（契约 §7）。
 * 表长即「允许的等待轮次」；等待全部用完后再失败一次就标 dead。
 */
export const BACKOFF_MS = [1_000, 5_000, 30_000, 120_000, 600_000] as const

/** dead 判定阈值：失败次数达到它就终止重试（5 轮等待 + 1 次收尾失败） */
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1

/** 取第 attempts 次失败对应的退避毫秒数（索引夹紧，越界取首项） */
export function backoffDelay(attempts: number): number {
  const index = Math.min(Math.max(attempts, 0), BACKOFF_MS.length - 1)
  return BACKOFF_MS[index] ?? BACKOFF_MS[0]
}

// ============ 熔断（契约 §7）============

/** 连续失败多少次打开熔断 */
export const BREAKER_THRESHOLD = 3

/** 熔断打开时长；到时放行 1 次试探（半开） */
export const BREAKER_OPEN_MS = 60_000

// ============ 采样与限流（契约 §8）============

/** 全局令牌桶速率（次/分钟） */
export const RATE_LIMIT_PER_MIN = 10

/** 令牌桶容量 */
export const RATE_BUCKET_CAP = 10

/** 同指纹去重窗口：窗口内只放行 1 条 */
export const DEDUPE_WINDOW_MS = 5 * 60_000

// ============ 字段长度上限（契约 §2/§3）============

export const MAX_ROUTE_LEN = 128
export const MAX_MESSAGE_LEN = 500
export const MAX_SOURCE_LEN = 256
export const MAX_STACK_LEN = 4000

/** 指纹归一化后截断长度（契约 §5） */
export const MESSAGE_TRUNCATE_LEN = 300

/** 指纹行号分桶粒度（契约 §5：10 行内视为同一处） */
export const LINENO_BUCKET = 10

// ============ 调度 ============

/** 有事件时 debounce 多久触发一次 flush（不抢首屏带宽，也不无限堆积） */
export const FLUSH_DEBOUNCE_MS = 2_000

/** 兜底 flush 间隔（用 setTimeout 递归，非 setInterval 常驻轮询） */
export const FALLBACK_FLUSH_MS = 60_000

/** 启动补发积压的延迟：让首屏资源先跑完 */
export const STARTUP_FLUSH_DELAY_MS = 3_000

// ============ 身份与开关 ============

export const CLIENT_ID_KEY = 'tea-telemetry-client-id'
export const SESSION_ID_KEY = 'tea-telemetry-session-id'

/** 设置表键名（ADR-022 §7：用户可关闭） */
export const TELEMETRY_ENABLED_KEY = 'telemetry-enabled'

/** 默认开启：可观测性优先，隐私由「不采集用户内容」保证 */
export const TELEMETRY_ENABLED_DEFAULT = true

/** 与 package.json 的 version 同步（待确认：后续改为构建期注入） */
export const APP_VERSION = '1.0.0'

// ============ SLO 目标（契约 §6，前后端共享常量）============

export const SLO_TARGETS = {
  LCP: 2_500,
  INP: 200,
  CLS: 0.1,
  FCP: 1_800,
  TTFB: 800,
} as const

/** 契约 §3.2 允许的指标名，用于运行时收窄（web-vitals 的 Metric.name 更宽） */
export const VITAL_NAMES = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const
