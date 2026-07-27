/**
 * 茶叶状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tea } from '@/types/tea'
import type { BrewState, BrewConfig } from '@/types/brewing'
import type { TasteDimensions, TastingRecord } from '@/types/tasting'
import { BrewPhase } from '@/types/brewing'
import { calculateProcessFactor, calculateOverallScore, generateRecordId } from '@/services/scoring'
import { historyStorage } from '@/services/storage'

export const useTeaStore = defineStore('tea', () => {
  // ============ 当前茶叶 ============
  const currentTea = ref<Tea | null>(null)

  // ============ 冲泡状态 ============
  const brewState = ref<BrewState>({
    phase: BrewPhase.IDLE,
    currentTemp: 20,
    targetTemp: 80,
    steepTime: 0,
    infusionsDone: 0,
    teaWeight: 3,
  })

  // ============ 品鉴维度 ============
  const tasteDimensions = ref<TasteDimensions>({
    bitterness: 3,
    sweetness: 3,
    aftertaste: 3,
    body: 3,
    aroma: 3,
  })

  // ============ 历史记录 ============
  const history = ref<TastingRecord[]>([])

  // ============ 计算属性 ============
  const processFactor = computed(() => {
    if (!currentTea.value) return 1
    return calculateProcessFactor(
      brewState.value.currentTemp,
      currentTea.value.bestTemp,
      brewState.value.steepTime,
      currentTea.value.bestTime,
    )
  })

  // ============ 动作 ============
  function selectTea(tea: Tea) {
    currentTea.value = tea
    brewState.value = {
      phase: BrewPhase.IDLE,
      currentTemp: 20,
      targetTemp: tea.bestTemp,
      steepTime: 0,
      infusionsDone: 0,
      teaWeight: 3,
    }
    resetTasteDimensions()
  }

  function startHeating() {
    brewState.value.phase = BrewPhase.HEATING
  }

  function updateTemp(temp: number) {
    brewState.value.currentTemp = Math.min(temp, brewState.value.targetTemp)
    if (brewState.value.currentTemp >= brewState.value.targetTemp) {
      brewState.value.phase = BrewPhase.READY
    }
  }

  function startSteeping() {
    brewState.value.phase = BrewPhase.STEEPING
    brewState.value.steepTime = 0
  }

  function updateSteepTime(time: number) {
    brewState.value.steepTime = time
  }

  function stopSteeping() {
    brewState.value.phase = BrewPhase.DONE
    brewState.value.infusionsDone++
  }

  function nextInfusion() {
    brewState.value.phase = BrewPhase.STEEPING
    brewState.value.steepTime = 0
  }

  function resetBrew() {
    brewState.value.phase = BrewPhase.IDLE
    brewState.value.steepTime = 0
    brewState.value.currentTemp = 20
  }

  function resetTasteDimensions() {
    tasteDimensions.value = {
      bitterness: 3,
      sweetness: 3,
      aftertaste: 3,
      body: 3,
      aroma: 3,
    }
  }

  function calculateScore(): number {
    return calculateOverallScore(tasteDimensions.value, processFactor.value)
  }

  function saveRecord(): TastingRecord {
    const record: TastingRecord = {
      id: generateRecordId(),
      teaId: currentTea.value!.id,
      teaName: currentTea.value!.name,
      date: new Date().toISOString(),
      brewTemp: brewState.value.currentTemp,
      brewTime: brewState.value.steepTime,
      infusions: brewState.value.infusionsDone,
      dimensions: { ...tasteDimensions.value },
      overallScore: calculateScore(),
      processFactor: processFactor.value,
    }
    history.value = historyStorage.add(record)
    return record
  }

  function loadHistory() {
    history.value = historyStorage.load()
  }

  return {
    currentTea,
    brewState,
    tasteDimensions,
    history,
    processFactor,
    selectTea,
    startHeating,
    updateTemp,
    startSteeping,
    updateSteepTime,
    stopSteeping,
    nextInfusion,
    resetBrew,
    resetTasteDimensions,
    calculateScore,
    saveRecord,
    loadHistory,
  }
})
