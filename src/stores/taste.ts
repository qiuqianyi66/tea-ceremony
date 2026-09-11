/**
 * 品鉴状态 — 从 tea.ts 拆出
 * 管理：八维评分 + 重置逻辑
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TasteDimensions } from '@/types/tasting'

const DEFAULT_DIMENSIONS: TasteDimensions = {
  bitterness: 3,
  sweetness: 3,
  aftertaste: 3,
  body: 3,
  aroma: 3,
  rhyme: 3,
  shape: 3,
  mind: 3,
}

export const useTasteStore = defineStore('taste', () => {
  const dimensions = ref<TasteDimensions>({ ...DEFAULT_DIMENSIONS })

  function reset() {
    dimensions.value = { ...DEFAULT_DIMENSIONS }
  }

  function update(key: keyof TasteDimensions, value: number) {
    dimensions.value = { ...dimensions.value, [key]: value }
  }

  return { dimensions, reset, update }
})
