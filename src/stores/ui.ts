/**
 * 全局 UI 状态 — toast / loading / 错误弹窗
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

interface Toast {
  id: number
  message: string
  type: 'info' | 'success' | 'error'
}

let toastId = 0

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<Toast[]>([])
  const globalLoading = ref(false)
  const drawerOpen = ref(false)

  function showToast(message: string, type: Toast['type'] = 'info', duration = 2500) {
    const id = ++toastId
    toasts.value.push({ id, message, type })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }

  function setLoading(v: boolean) { globalLoading.value = v }
  function setDrawerOpen(v: boolean) { drawerOpen.value = v }

  return {
    toasts, globalLoading, drawerOpen,
    showToast, setLoading, setDrawerOpen,
  }
})
