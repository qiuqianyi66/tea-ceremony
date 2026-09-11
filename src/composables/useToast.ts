/**
 * 轻量 toast：替代 alert()，非阻塞、自动消失。
 * 用法：const { toast, toasts } = useToast(); toast('保存成功', 'success')
 * 模板里渲染 toasts 数组即可。
 */
import { reactive } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const toasts = reactive<ToastItem[]>([])
let nextId = 1

function push(message: string, type: ToastType = 'info', duration = 2600) {
  const id = nextId++
  toasts.push({ id, message, type })
  setTimeout(() => {
    const idx = toasts.findIndex(t => t.id === id)
    if (idx >= 0) toasts.splice(idx, 1)
  }, duration)
}

export function useToast() {
  return {
    toasts,
    toast: push,
    success: (m: string, d?: number) => push(m, 'success', d),
    error: (m: string, d?: number) => push(m, 'error', d),
    info: (m: string, d?: number) => push(m, 'info', d),
  }
}
