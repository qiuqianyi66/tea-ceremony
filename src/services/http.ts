/**
 * HTTP 基础层：统一请求/超时/错误/认证 token 注入
 */
import { getAuthToken, clearAuth } from './authStorage'
import { useUiStore } from '@/stores/ui'
import router from '@/router'

// 生产环境通过 Nginx 代理到 /api；开发环境可通过 VITE_API_URL 指向后端。
// 统一补齐 /api，避免把 http://localhost:8000 配置成不带前缀的错误地址。
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
const DEV_MODE = import.meta.env.DEV && import.meta.env.VITE_DEV_MODE === 'true'
const REQUEST_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * 统一错误拦截（副作用，仍会抛 ApiError 由调用方处理）：
 * 401 → 清 token 跳登录；403 / 404 / 500 → toast 提示。
 * 登录/注册接口的 401 是正常业务错误（账号密码不对），不触发全局跳转。
 * 网络错误不在此处 toast：records/garden 依赖失败降级离线存储，全局提示会刷屏。
 */
function handleHttpError(status: number, path: string) {
  if (path.startsWith('/auth/')) return
  const ui = useUiStore()

  if (status === 401) {
    clearAuth()
    if (router.currentRoute.value.name !== 'login') {
      void router.push({ name: 'login' })
    }
    return
  }

  switch (status) {
    case 403:
      ui.showToast('无权限执行此操作', 'error')
      break
    case 404:
      ui.showToast('请求的资源不存在', 'error')
      break
    case 500:
      ui.showToast('服务器开小差了，请稍后重试', 'error')
      break
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const controller = options?.signal ? null : new AbortController()
  const timeoutId = window.setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS)

  // 附加认证 token
  const token = getAuthToken()
  if (token && token !== 'dev-token') {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { ...headers, ...options?.headers as Record<string, string> },
      ...options,
      signal: options?.signal ?? controller?.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      const message = errText || res.statusText || '请求失败'
      handleHttpError(res.status, path)
      throw new ApiError(`API ${res.status}: ${message}`, res.status)
    }

    // 204 No Content
    if (res.status === 204) return undefined as T

    return await res.json()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请检查网络连接')
    }
    if (error instanceof TypeError) {
      throw new ApiError('网络不可用，请稍后重试')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

/** 开发模式：返回 mock 数据而非抛错 */
async function requestOrMock<T>(path: string, options?: RequestInit, mockData?: T): Promise<T> {
  if (DEV_MODE) {
    try {
      return await request<T>(path, options)
    } catch {
      console.warn(`[DEV_MODE] API 调用失败，使用 mock 数据: ${path}`)
      return mockData as T
    }
  }
  return request<T>(path, options)
}

export { request, requestOrMock }
