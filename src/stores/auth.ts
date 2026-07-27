/**
 * 用户认证状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/services/api'

export interface UserInfo {
  id: number
  username: string
  display_name?: string
  level: number
  xp: number
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const token = ref<string | null>(null)
  const isLoggedIn = computed(() => !!token.value)

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('tea-auth')
      if (saved) {
        const data = JSON.parse(saved)
        token.value = data.token
        user.value = data.user
      }
    } catch {}
  }

  function saveToStorage() {
    try {
      localStorage.setItem('tea-auth', JSON.stringify({
        token: token.value,
        user: user.value,
      }))
    } catch {}
  }

  async function login(username: string, password: string): Promise<boolean> {
    const result = await authApi.login(username, password) as Record<string, unknown> | null
    if (result && typeof result === 'object' && 'access_token' in result) {
      token.value = result.access_token as string
      user.value = result.user as UserInfo
      saveToStorage()
      return true
    }
    // 仅开发模式允许模拟登录
    if (import.meta.env.DEV) {
      token.value = 'dev-token'
      user.value = { id: 1, username, display_name: username, level: 1, xp: 0 }
      saveToStorage()
      return true
    }
    return false
  }

  async function register(username: string, password: string, displayName?: string): Promise<boolean> {
    const result = await authApi.register(username, password, displayName) as Record<string, unknown> | null
    if (result && typeof result === 'object' && 'access_token' in result) {
      token.value = result.access_token as string
      user.value = result.user as UserInfo
      saveToStorage()
      return true
    }
    // 仅开发模式允许模拟注册
    if (import.meta.env.DEV) {
      token.value = 'dev-token'
      user.value = { id: 1, username, display_name: displayName || username, level: 1, xp: 0 }
      saveToStorage()
      return true
    }
    return false
  }

  function logout() {
    token.value = null
    user.value = null
    try { localStorage.removeItem('tea-auth') } catch {}
  }

  // 初始化时加载
  loadFromStorage()

  return { user, token, isLoggedIn, login, register, logout }
})
