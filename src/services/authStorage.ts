/**
 * 认证持久化：统一读写 localStorage 'tea-auth'
 * 其他模块不直接碰 localStorage，全部走这里。
 */

const KEY = 'tea-auth'

export interface AuthPayload {
  token: string
  user: unknown
}

export function loadAuth(): AuthPayload | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (typeof data?.token === 'string') return data as AuthPayload
    return null
  } catch {
    return null
  }
}

export function saveAuth(payload: AuthPayload): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // 隐私模式 / 存储满：静默失败，下次重新登录
  }
}

export function clearAuth(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

/** 读 token（http.ts 注入 Authorization 头用） */
export function getAuthToken(): string | null {
  return loadAuth()?.token ?? null
}
