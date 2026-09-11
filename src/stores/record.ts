/**
 * 品鉴历史 — 从 tea.ts 拆出
 * 管理：历史记录列表 + 加载
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { TastingRecord } from '@/types/tasting'
import { historyStorage } from '@/services/storage'

export const useRecordStore = defineStore('record', () => {
  const history = ref<TastingRecord[]>([])
  const loaded = ref(false)

  async function load() {
    history.value = await historyStorage.load()
    loaded.value = true
  }

  function add(record: TastingRecord) {
    history.value.unshift(record)
  }

  function setAll(records: TastingRecord[]) {
    history.value = records
  }

  function remove(id: string) {
    history.value = history.value.filter(r => r.id !== id)
  }

  /** 重试离线同步队列，成功后刷新本地列表 */
  async function syncPending(): Promise<{ synced: number; failed: number }> {
    const result = await historyStorage.syncPending()
    await load()
    return result
  }

  return { history, loaded, load, add, remove, setAll, syncPending }
})
