/**
 * usePagination — 前端分页
 * 用于历史记录、收藏列表等
 */
import { computed, ref } from 'vue'

export function usePagination<T>(items: () => T[], pageSize = 20) {
  const page = ref(1)

  const total = computed(() => items().length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
  const pageItems = computed(() => {
    const start = (page.value - 1) * pageSize
    return items().slice(start, start + pageSize)
  })

  function goTo(p: number) {
    page.value = Math.min(Math.max(1, p), totalPages.value)
  }
  function next() { goTo(page.value + 1) }
  function prev() { goTo(page.value - 1) }

  return { page, pageItems, total, totalPages, goTo, next, prev }
}
