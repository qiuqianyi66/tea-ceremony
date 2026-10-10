/**
 * AI 会话记忆：后端 sessionId 持久化（localStorage）。
 * 与 authStorage 同模式：其他模块不直接碰 localStorage，全走这里。
 * 仅登录用户使用；游客不读不写（sessionId 为 null，走本地 history）。
 */
const KEY = 'tea-ai-session'

export function loadAiSessionId(): number | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const id = Number(raw)
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function saveAiSessionId(id: number): void {
  try {
    localStorage.setItem(KEY, String(id))
  } catch {
    // 隐私模式 / 存储满：静默失败，下次请求后端重新开会话
  }
}

export function clearAiSessionId(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
