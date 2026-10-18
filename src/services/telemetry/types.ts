/**
 * 遥测契约 v1 类型（docs/reference/telemetry-contract.md §2/§3/§4）
 * 字段与后端 DTO 一一对应，禁止各自扩展；改这里 = 改契约，前后端必须同 PR。
 */

/** 脚本错误子类型（契约 §3.1） */
export type TelemetryErrorKind = 'error' | 'unhandledrejection' | 'resource'

/** Web Vitals 指标名（契约 §3.2） */
export type TelemetryVitalName = 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'

/** 指标评级（web-vitals 原值，不做映射） */
export type TelemetryVitalRating = 'good' | 'needs-improvement' | 'poor'

/** `type = "error"` 的 payload（契约 §3.1） */
export interface TelemetryErrorPayload {
  kind: TelemetryErrorKind
  /** 已脱敏，≤500 */
  message: string
  /** 只留 pathname，≤256 */
  source: string
  lineno?: number
  colno?: number
  /** 已脱敏，≤4000 */
  stack?: string
  /** 16 位小写 hex，见 fingerprint.ts */
  fingerprint: string
}

/** `type = "vital"` 的 payload（契约 §3.2） */
export interface TelemetryVitalPayload {
  name: TelemetryVitalName
  /** 保留 3 位小数 */
  value: number
  rating: TelemetryVitalRating
  navigationType?: string
}

interface TelemetryEventBase {
  /** 幂等键，UUID v4；服务端 client_event_id 唯一约束（契约 §9） */
  clientEventId: string
  occurredAt: string
  /** 路由 path，≤128 */
  route: string
}

export interface TelemetryErrorEvent extends TelemetryEventBase {
  type: 'error'
  payload: TelemetryErrorPayload
}

export interface TelemetryVitalEvent extends TelemetryEventBase {
  type: 'vital'
  payload: TelemetryVitalPayload
}

/** 判别联合：按 type 收窄 payload 形态 */
export type TelemetryEvent = TelemetryErrorEvent | TelemetryVitalEvent

/** 上报请求体（契约 §2） */
export interface TelemetryBatchRequest {
  /** 设备级匿名 UUID，用户可重置 */
  clientId: string
  /** 会话级 UUID */
  sessionId: string
  appVersion: string
  sentAt: string
  events: TelemetryEvent[]
}

/** 批量响应 data 部分（契约 §4） */
export interface TelemetryBatchData {
  accepted: number
  duplicated: number
  rejected: number
}

/** 服务端统一响应包装（契约 §1） */
export interface TelemetryApiResponse<T> {
  code: string
  message: string
  data: T
}

/**
 * 传输结果（客户端内部契约，不上报）。
 * ok=false 时调用方按 retryable 决定「退避重试」还是「标 dead」。
 */
export interface TelemetryBatchResult {
  ok: boolean
  accepted: number
  duplicated: number
  rejected: number
  /** false = 不值得重试（如 400 契约错误），调用方应标 dead */
  retryable: boolean
  /** HTTP 状态码；网络层失败时缺省 */
  status?: number
  /** 失败原因，仅本地诊断用 */
  error?: string
}

/** outbox 记录投递状态 */
export type OutboxStatus = 'queued' | 'inflight' | 'dead'

/** IndexedDB outbox 中的一条待发记录 */
export interface OutboxRecord {
  /** 自增主键（Dexie 生成） */
  id?: number
  event: TelemetryEvent
  status: OutboxStatus
  /** 已失败次数：决定退避位置与 dead 判定 */
  attempts: number
  /** 下次可发送时间戳（ms）；未到期不参与 takeBatch */
  nextAttemptAt: number
  /** 入队时间戳（ms）；容量淘汰按它排序 */
  createdAt: number
  lastError?: string
}
