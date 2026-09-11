/**
 * 冲泡状态机 — 从 tea.ts 拆出
 * 管理：BrewPhase 流转 / 水温 / 投茶量 / 出汤次数
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { BrewPhase } from '@/types/brewing'
import type { BrewState } from '@/types/brewing'

export const useBrewStore = defineStore('brew', () => {
  const state = ref<BrewState>({
    phase: BrewPhase.IDLE,
    currentTemp: 20,
    targetTemp: 80,
    steepTime: 0,
    infusionsDone: 0,
    teaWeight: 3,
  })

  /** 选茶后重置冲泡状态 */
  function resetForTea(bestTemp: number) {
    state.value = {
      phase: BrewPhase.IDLE,
      currentTemp: 20,
      targetTemp: bestTemp,
      steepTime: 0,
      infusionsDone: 0,
      teaWeight: 3,
    }
  }

  function setTeaWeight(weight: number) {
    state.value.teaWeight = Math.max(1, Math.min(8, weight))
  }

  function setTargetTemp(temp: number) {
    state.value.targetTemp = Math.max(20, Math.min(100, temp))
  }

  function startHeating() {
    state.value.phase = BrewPhase.HEATING
  }

  function updateTemp(temp: number) {
    state.value.currentTemp = Math.min(temp, state.value.targetTemp)
    if (state.value.currentTemp >= state.value.targetTemp) {
      state.value.phase = BrewPhase.WARMING
    }
  }

  function completeWarming() {
    state.value.phase = BrewPhase.RINSING
  }

  function completeRinsing() {
    state.value.phase = BrewPhase.READY
    state.value.steepTime = 0
  }

  function startSteeping() {
    state.value.phase = BrewPhase.STEEPING
    state.value.steepTime = 0
  }

  function updateSteepTime(time: number) {
    state.value.steepTime = time
  }

  function stopSteeping() {
    state.value.phase = BrewPhase.DONE
    state.value.infusionsDone++
  }

  function nextInfusion() {
    state.value.phase = BrewPhase.STEEPING
    state.value.steepTime = 0
  }

  function reset() {
    state.value.phase = BrewPhase.IDLE
    state.value.steepTime = 0
    state.value.currentTemp = 20
  }

  return {
    state,
    resetForTea,
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
    reset,
  }
})
