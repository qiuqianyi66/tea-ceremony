/**
 * 遥测身份（clientId / sessionId / 版本）与随机 ID
 *
 * 单独成文件的原因：transport 拼请求体需要身份，index 负责调度也需要；
 * 若都写在 index.ts 会与 transport 形成循环导入。
 *
 * 隐私边界（ADR-022）：只有随机 UUID，不关联 user_id，不落 IP / UA。
 */
import { APP_VERSION, CLIENT_ID_KEY, SESSION_ID_KEY } from './config'

let memoryClientId: string | null = null
let memorySessionId: string | null = null

/**
 * 生成 UUID v4。
 * 不用 `crypto.randomUUID()`：它只在安全上下文（HTTPS / localhost）可用，而站点当前跑在 HTTP 上。
 * `crypto.getRandomValues()` 不受安全上下文限制，缺失时（极老内核）退 Math.random。
 */
export function randomId(): string {
  const bytes = new Uint8Array(16)
  const cryptoObj = typeof crypto === 'undefined' ? undefined : crypto
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    cryptoObj.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  // 版本位 4 与变体位 10xx（RFC 4122），服务端按 UUID 校验
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** 设备级匿名 ID（localStorage 持久化；隐私模式下退化到内存，不抛错） */
export function getClientId(): string {
  if (memoryClientId) return memoryClientId
  let id = randomId()
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY)
    if (existing) id = existing
    else localStorage.setItem(CLIENT_ID_KEY, id)
  } catch {
    // localStorage 不可用（隐私模式/配额满）：本次会话用内存值，仍能上报
  }
  memoryClientId = id
  return id
}

/** 会话级 ID（sessionStorage；标签页关闭即换新） */
export function getSessionId(): string {
  if (memorySessionId) return memorySessionId
  let id = randomId()
  try {
    const existing = sessionStorage.getItem(SESSION_ID_KEY)
    if (existing) id = existing
    else sessionStorage.setItem(SESSION_ID_KEY, id)
  } catch {
    // 同 clientId：sessionStorage 不可用时退内存
  }
  memorySessionId = id
  return id
}

/**
 * 重置设备 ID（ADR-022 §2：用户可重置）。
 * 给设置页留的开关，重置后后续事件算作新设备。
 */
export function resetClientId(): string {
  const id = randomId()
  memoryClientId = id
  try {
    localStorage.setItem(CLIENT_ID_KEY, id)
  } catch {
    // 隐私模式：内存值已更新，持久化失败不影响本次会话
  }
  return id
}

export function getAppVersion(): string {
  return APP_VERSION
}

/** 清空内存缓存与存储键（仅测试用） */
export function resetIdentityForTest(): void {
  memoryClientId = null
  memorySessionId = null
  try {
    localStorage.removeItem(CLIENT_ID_KEY)
    sessionStorage.removeItem(SESSION_ID_KEY)
  } catch {
    // 存储不可用时无需清理
  }
}
