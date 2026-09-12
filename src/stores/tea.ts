/**
 * 茶叶状态管理 - 基于 Dexie.js (IndexedDB) 异步存储
 * 域划分：冲泡 brewStore / 品鉴 tasteStore / 历史 recordStore / 成长 progressStore
 * 本 store 只保留：选茶/茶器、工艺系数、评分与记录编排；冲泡/品鉴/成长状态直连各域 store。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tea } from '@/types/tea'
import type { TeaWare } from '@/types/teaware'
import type { TasteDimensions, TastingRecord } from '@/types/tasting'
import { calculateProcessFactor, calculateOverallScore, generateRecordId } from '@/services/scoring'
import { historyStorage } from '@/services/storage'
import { WATER_TYPES } from '@/data/constants'
import { useBrewStore } from './brew'
import { useTasteStore } from './taste'
import { useRecordStore } from './record'
import { useProgressStore } from './progress'

export const useTeaStore = defineStore('tea', () => {
  const brewStore = useBrewStore()
  const tasteStore = useTasteStore()
  const recordStore = useRecordStore()
  const progress = useProgressStore()

  // ============ 当前茶叶 / 茶器 / 水源 ============
  const currentTea = ref<Tea | null>(null)
  const selectedTeaWare = ref<TeaWare | null>(null)
  const waterType = ref<string>('purified')

  // ============ 历史记录（委托给 recordStore）============
  const history = computed(() => recordStore.history)

  // ============ 计算属性 ============
  const processFactor = computed(() => {
    if (!currentTea.value) return 1
    return calculateProcessFactor(
      brewStore.state.currentTemp,
      currentTea.value.bestTemp,
      brewStore.state.steepTime,
      currentTea.value.bestTime,
      selectedTeaWare.value,
      WATER_TYPES.find(w => w.id === waterType.value)?.factor ?? 1.0,
    )
  })

  // ============ 动作 ============
  function selectTea(tea: Tea) {
    currentTea.value = tea
    selectedTeaWare.value = null
    brewStore.resetForTea(tea.bestTemp)
    tasteStore.reset()
  }

  function selectTeaWare(ware: TeaWare | null) {
    selectedTeaWare.value = ware
  }

  function calculateScore(): number {
    return calculateOverallScore(tasteStore.dimensions, processFactor.value)
  }

  async function saveRecord(aromaType?: string, notes?: string, weather?: string, mood?: string): Promise<TastingRecord> {
    if (!currentTea.value) {
      console.error('[saveRecord] currentTea is null, cannot save record')
      throw new Error('未选择茶叶，无法保存品鉴记录')
    }
    const record: TastingRecord = {
      id: generateRecordId(),
      teaId: currentTea.value.id,
      teaApiId: currentTea.value.apiId,
      teaName: currentTea.value.name,
      date: new Date().toISOString(),
      brewTemp: brewStore.state.currentTemp,
      brewTime: brewStore.state.steepTime,
      infusions: brewStore.state.infusionsDone,
      dimensions: { ...tasteStore.dimensions },
      overallScore: calculateScore(),
      processFactor: processFactor.value,
      aromaType,
      notes,
      weather,
      mood,
    }
    const allRecords = await historyStorage.add(record)
    recordStore.setAll(allRecords)

    const xpGain = 10 + Math.round(Math.max(0, record.overallScore - 5) * 4)
    await progress.addXp(xpGain)
    await progress.checkAchievements(record)
    await progress.checkTeaWareUnlock()
    return record
  }

  async function loadHistory() {
    await recordStore.load()
    await progress.initAchievements()
    await progress.loadXp()
    await progress.initCollectedWares()
  }

  return {
    currentTea,
    selectedTeaWare,
    history,
    processFactor,
    waterType,
    selectTea,
    selectTeaWare,
    calculateScore,
    saveRecord,
    loadHistory,
  }
})
