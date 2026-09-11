/**
 * 轻量 toast：基于 uiStore 的单一来源封装，替代 alert()，非阻塞、自动消失。
 * 用法：const { toast, toasts } = useToast(); toast('保存成功', 'success')
 * 全局渲染由 App.vue 挂载的 ToastContainer 负责。
 */
import { useUiStore } from '@/stores/ui'

export type ToastType = 'success' | 'error' | 'info'

export function useToast() {
  const ui = useUiStore()
  return {
    toasts: ui.toasts,
    toast: (message: string, type: ToastType = 'info', duration = 2600) => ui.showToast(message, type, duration),
    success: (m: string, d?: number) => ui.showToast(m, 'success', d),
    error: (m: string, d?: number) => ui.showToast(m, 'error', d),
    info: (m: string, d?: number) => ui.showToast(m, 'info', d),
  }
}
