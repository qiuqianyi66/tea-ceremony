/**
 * 茶室主题状态管理
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { TEA_ROOM_THEMES, getThemeById, type TeaRoomTheme } from '@/data/themes'

export const useThemeStore = defineStore('theme', () => {
  const currentThemeId = ref<string>(
    localStorage.getItem('tea-theme') || 'ming',
  )
  const currentTheme = ref<TeaRoomTheme>(getThemeById(currentThemeId.value))

  function setTheme(id: string) {
    currentThemeId.value = id
    currentTheme.value = getThemeById(id)
    localStorage.setItem('tea-theme', id)
    applyTheme(currentTheme.value)
  }

  function applyTheme(theme: TeaRoomTheme) {
    const root = document.documentElement
    root.style.setProperty('--color-wood', theme.colors.wood)
    root.style.setProperty('--color-wood-light', theme.colors.woodLight)
    root.style.setProperty('--color-tea-gold', theme.colors.teaGold)
    root.style.setProperty('--color-paper', theme.colors.paper)
    root.style.setProperty('--color-ink', theme.colors.ink)
    root.style.setProperty('--color-cream', theme.colors.cream)
  }

  // 初始化时应用保存的主题
  applyTheme(currentTheme.value)

  return {
    currentThemeId,
    currentTheme,
    setTheme,
  }
})
