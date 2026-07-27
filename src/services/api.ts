/**
 * API 服务层
 * 封装后端 API 调用，支持 mock 降级（后端不可用时自动使用 localStorage）
 */

import type { TastingRecord } from '@/types/tasting'

// ============ 配置 ============

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// ============ 工具 ============

async function request<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    // 附加认证 token
    try {
      const authData = localStorage.getItem('tea-auth')
      if (authData) {
        const { token } = JSON.parse(authData)
        if (token && token !== 'dev-token') headers['Authorization'] = `Bearer ${token}`
      }
    } catch {}
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { ...headers, ...options?.headers as Record<string, string> },
      ...options,
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    return await res.json()
  } catch {
    return null  // 后端不可用，返回 null
  }
}

// ============ 认证 API ============

export const authApi = {
  async register(username: string, password: string, displayName?: string) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, display_name: displayName }),
    })
  },

  async login(username: string, password: string) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
  },
}

// ============ 品鉴记录 API ============

export const recordsApi = {
  async list(): Promise<TastingRecord[]> {
    const data = await request<TastingRecord[]>('/records/')
    return data ?? []
  },

  async create(record: Partial<TastingRecord>) {
    return request('/records/', {
      method: 'POST',
      body: JSON.stringify(record),
    })
  },

  async delete(id: number) {
    return request(`/records/${id}`, { method: 'DELETE' })
  },
}

// ============ 茶叶 API ============

export const teasApi = {
  async list(type?: string) {
    const query = type ? `?type=${type}` : ''
    return request(`/teas/${query}`)
  },
}
