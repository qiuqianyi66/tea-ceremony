/**
 * 茶叶状态管理 - 基于 Dexie.js (IndexedDB) 异步存储
 * 域划分：冲泡 brewStore / 品鉴 tasteStore / 历史 recordStore / 成长 progressStore
 * 本 store 只保留：选茶/茶器、工艺系数、评分与记录编排
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

  // ============ 当前茶叶 ============
  const currentTea = ref<Tea | null>(null)

  // ============ 当前茶器 ============
  const selectedTeaWare = ref<TeaWare | null>(null)

  // ============ 冲泡状态（委托给 brewStore）============
  const brewState = computed(() => brewStore.state)

  // ============ 当前水源 ============
  const waterType = ref<string>('purified')

  // ============ 品鉴维度（委托给 tasteStore）============
  const tasteDimensions = computed(() => tasteStore.dimensions)

  // ============ 历史记录（委托给 recordStore）============
  const history = computed(() => recordStore.history)

  // ============ 成长进度（委托给 progressStore）============
  const userXp = computed(() => progress.userXp)
  const currentLevel = computed(() => progress.currentLevel)
  const nextLevel = computed(() => progress.nextLevel)
  const xpForNextLevel = computed(() => progress.xpForNextLevel)
  const achievements = computed(() => progress.achievements)
  const newAchievement = computed(() => progress.newAchievement)
  const collectedTeaWareIds = computed(() => progress.collectedTeaWareIds)
  const solarCheckins = computed(() => progress.solarCheckins)

  function addXp(amount: number) { return progress.addXp(amount) }
  function loadXp() { return progress.loadXp() }
  function initAchievements() { return progress.initAchievements() }
  function checkAchievements(record: TastingRecord) { return progress.checkAchievements(record) }
  function dismissNewAchievement() { progress.dismissNewAchievement() }
  function isTeaWareUnlocked(wareId: string) { return progress.isTeaWareUnlocked(wareId) }
  function checkTeaWareUnlock() { return progress.checkTeaWareUnlock() }
  function loadSolarCheckins() { return progress.loadSolarCheckins() }
  function checkInSolarTerm(termId: string) { return progress.checkInSolarTerm(termId) }

  // ============ 计算属性 ============
  const processFactor = computed(() => {
    if (!currentTea.value) return 1
    return calculateProcessFactor(
      brewState.value.currentTemp,
      currentTea.value.bestTemp,
      brewState.value.steepTime,
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

  function setTeaWeight(weight: number) {
    brewStore.setTeaWeight(weight)
  }

  function setTargetTemp(temp: number) {
    brewStore.setTargetTemp(temp)
  }

  function startHeating() { brewStore.startHeating() }
  function updateTemp(temp: number) { brewStore.updateTemp(temp) }
  function completeWarming() { brewStore.completeWarming() }
  function completeRinsing() { brewStore.completeRinsing() }
  function startSteeping() { brewStore.startSteeping() }
  function updateSteepTime(time: number) { brewStore.updateSteepTime(time) }
  function stopSteeping() { brewStore.stopSteeping() }
  function nextInfusion() { brewStore.nextInfusion() }
  function resetBrew() { brewStore.reset() }

  function resetTasteDimensions() { tasteStore.reset() }

  function calculateScore(): number {
    return calculateOverallScore(tasteDimensions.value, processFactor.value)
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
      brewTemp: brewState.value.currentTemp,
      brewTime: brewState.value.steepTime,
      infusions: brewState.value.infusionsDone,
      dimensions: { ...tasteDimensions.value },
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
    brewState,
    tasteDimensions,
    history,
    achievements,
    newAchievement,
    solarCheckins,
    loadSolarCheckins,
    checkInSolarTerm,
    processFactor,
    selectTea,
    selectTeaWare,
    setTeaWeight,
    setTargetTemp,
    startHeating,
    updateTemp,
    completeWarming,
    completeRinsing,
    startSteeping,
    updateSteepTime,
    stopSteeping,
    nextInfusion,
    resetBrew,
    resetTasteDimensions,
    calculateScore,
    saveRecord,
    loadHistory,
    dismissNewAchievement,
    collectedTeaWareIds,
    isTeaWareUnlocked,
    waterType,
    userXp,
    currentLevel,
    nextLevel,
    xpForNextLevel,
  }
})
