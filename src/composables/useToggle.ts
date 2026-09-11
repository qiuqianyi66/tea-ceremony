/**
 * useToggle — 布尔状态切换
 * 用于抽屉开合、面板展开、开关等
 */
import { ref } from 'vue'

export function useToggle(initialValue = false) {
  const on = ref(initialValue)

  function toggle() {
    on.value = !on.value
  }
  function set(value: boolean) {
    on.value = value
  }

  return { on, toggle, set }
}
