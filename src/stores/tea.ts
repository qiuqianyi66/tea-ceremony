/**
 * 茶叶状态管理 - 基于 Dexie.js (IndexedDB) 异步存储
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Tea } from '@/types/tea'
import type { TeaWare } from '@/types/teaware'
import type { BrewState } from '@/types/brewing'
import type { TasteDimensions, TastingRecord, Achievement } from '@/types/tasting'
import { BrewPhase } from '@/types/brewing'
import { calculateProcessFactor, calculateOverallScore, generateRecordId } from '@/services/scoring'
import { historyStorage, achievementStorage, xpStorage, collectedWareStorage } from '@/services/storage'
import { ACHIEVEMENTS, WATER_TYPES, TEA_LEVELS } from '@/data/constants'
import { getAllTypes, getTeaById } from '@/data/teas'
import { TeaType } from '@/types/tea'

export const useTeaStore = defineStore('tea', () => {
  const DEFAULT_COLLECTED_WARE_IDS = new Set(['gaiwan', 'yixing', 'glass'])

  // ============ 当前茶叶 ============
  const currentTea = ref<Tea | null>(null)

  // ============ 当前茶器 ============
  const selectedTeaWare = ref<TeaWare | null>(null)
  const collectedTeaWareIds = ref<Set<string>>(new Set(DEFAULT_COLLECTED_WARE_IDS))

  // ============ 茶修等级 ============
  const userXp = ref(0)
  const currentLevel = computed(() => {
    let level: typeof TEA_LEVELS[number] = TEA_LEVELS[0]
    for (const l of TEA_LEVELS) {
      if (userXp.value >= l.minXp) level = l
    }
    return level
  })
  const nextLevel = computed(() => {
    const idx = TEA_LEVELS.findIndex(l => l.id === currentLevel.value.id)
    if (idx < TEA_LEVELS.length - 1) return TEA_LEVELS[idx + 1] as typeof TEA_LEVELS[number] | undefined
    return undefined
  })
  const xpForNextLevel = computed(() => nextLevel.value?.minXp ?? userXp.value)

  async function addXp(amount: number) {
    userXp.value += amount
    await xpStorage.save(userXp.value)
  }

  async function loadXp() {
    userXp.value = await xpStorage.load()
  }

  // ============ 冲泡状态 ============
  const brewState = ref<BrewState>({
    phase: BrewPhase.IDLE,
    currentTemp: 20,
    targetTemp: 80,
    steepTime: 0,
    infusionsDone: 0,
    teaWeight: 3,
  })

  // ============ 当前水源 ============
  const waterType = ref<string>('purified')

  // ============ 品鉴维度 ============
  const tasteDimensions = ref<TasteDimensions>({
    bitterness: 3,
    sweetness: 3,
    aftertaste: 3,
    body: 3,
    aroma: 3,
    rhyme: 3,
    shape: 3,
    mind: 3,
  })

  // ============ 历史记录 ============
  const history = ref<TastingRecord[]>([])

  // ============ 成就系统 ============
  const achievements = ref<Achievement[]>([])
  const newAchievement = ref<string | null>(null)

  async function initAchievements() {
    const saved = await achievementStorage.load()
    if (saved.length === 0) {
      const initial = ACHIEVEMENTS.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        unlocked: false,
      }))
      await achievementStorage.save(initial)
      achievements.value = initial
    } else {
      achievements.value = saved
    }
  }

  async function checkAchievements(record: TastingRecord) {
    const all = [...achievements.value]
    let unlocked = false

    for (const ach of all) {
      if (ach.unlocked) continue

      switch (ach.id) {
        case 'first_brew': {
          if (history.value.length >= 1) {
            ach.unlocked = true
            ach.unlockedAt = new Date().toISOString()
            newAchievement.value = ach.id
            unlocked = true
          }
          break
        }
        case 'all_types': {
          const typesInHistory = new Set(history.value.map(r => {
            const tea = getTeaById(r.teaId)
            return tea?.type
          }).filter((t): t is TeaType => t !== undefined))
          if (typesInHistory.size >= Object.values(TeaType).length) {
            ach.unlocked = true
            ach.unlockedAt = new Date().toISOString()
            newAchievement.value = ach.id
            unlocked = true
          }
          break
        }
        case 'temp_accuracy': {
          if (history.value.length >= 5) {
            const recent5 = history.value.slice(0, 5)
            const allAccurate = recent5.every(r => {
              const tea = getTeaById(r.teaId)
              if (!tea) return false
              return Math.abs(r.brewTemp - tea.bestTemp) < 5
            })
            if (allAccurate) {
              ach.unlocked = true
              ach.unlockedAt = new Date().toISOString()
              newAchievement.value = ach.id
              unlocked = true
            }
          }
          break
        }
        case 'total_brews_20': {
          if (history.value.length >= 20) {
            ach.unlocked = true
            ach.unlockedAt = new Date().toISOString()
            newAchievement.value = ach.id
            unlocked = true
          }
          break
        }
        case 'high_score': {
          if (record.overallScore >= 9) {
            ach.unlocked = true
            ach.unlockedAt = new Date().toISOString()
            newAchievement.value = ach.id
            unlocked = true
          }
          break
        }
      }
    }

    if (unlocked) {
      await achievementStorage.save(all)
      achievements.value = all
    }
  }

  function dismissNewAchievement() {
    newAchievement.value = null
  }

  // ============ 茶器收藏 ============
  function isTeaWareUnlocked(wareId: string): boolean {
    return collectedTeaWareIds.value.has(wareId)
  }

  async function checkTeaWareUnlock() {
    const historyCount = history.value.length
    const greenTeaCount = history.value.filter(r => {
      const tea = getTeaById(r.teaId)
      return tea?.type === TeaType.GREEN
    }).length
    const highScoreStreak = getHighScoreStreak()

    let changed = false

    // 青瓷盖碗：品鉴 3 款绿茶后解锁
    if (!collectedTeaWareIds.value.has('celadon') && greenTeaCount >= 3) {
      collectedTeaWareIds.value = new Set([...collectedTeaWareIds.value, 'celadon'])
      changed = true
    }
    // 段泥石瓢壶：累计品鉴 5 次
    if (!collectedTeaWareIds.value.has('duanning') && historyCount >= 5) {
      collectedTeaWareIds.value = new Set([...collectedTeaWareIds.value, 'duanning'])
      changed = true
    }
    // 建盏天目杯：连续 3 次评分 8 分以上
    if (!collectedTeaWareIds.value.has('jianzhan') && highScoreStreak >= 3) {
      collectedTeaWareIds.value = new Set([...collectedTeaWareIds.value, 'jianzhan'])
      changed = true
    }

    if (changed) {
      await collectedWareStorage.save(collectedTeaWareIds.value)
    }
  }

  function getHighScoreStreak(): number {
    let streak = 0
    for (const r of history.value) {
      if (r.overallScore >= 8) streak++
      else break
    }
    return streak
  }

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

  function selectTeaWare(ware: TeaWare | null) {
    selectedTeaWare.value = ware
  }

  function setTeaWeight(weight: number) {
    brewState.value.teaWeight = Math.max(1, Math.min(8, weight))
  }

  function setTargetTemp(temp: number) {
    brewState.value.targetTemp = Math.max(20, Math.min(100, temp))
  }

  function startHeating() {
    brewState.value.phase = BrewPhase.HEATING
  }

  function updateTemp(temp: number) {
    brewState.value.currentTemp = Math.min(temp, brewState.value.targetTemp)
    if (brewState.value.currentTemp >= brewState.value.targetTemp) {
      brewState.value.phase = BrewPhase.WARMING
    }
  }

  function completeWarming() {
    brewState.value.phase = BrewPhase.RINSING
  }

  function completeRinsing() {
    brewState.value.phase = BrewPhase.READY
    brewState.value.steepTime = 0
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
      rhyme: 3,
      shape: 3,
      mind: 3,
    }
  }

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
    history.value = await historyStorage.add(record)

    const xpGain = 10 + Math.round(Math.max(0, record.overallScore - 5) * 4)
    await addXp(xpGain)
    await checkAchievements(record)
    await checkTeaWareUnlock()
    return record
  }

  async function loadHistory() {
    history.value = await historyStorage.load()
    await initAchievements()
    await loadXp()
    const savedWareIds = await collectedWareStorage.load()
    // 首次运行时 IndexedDB 为空，但三件基础茶器应默认解锁。
    if (savedWareIds.size === 0) {
      collectedTeaWareIds.value = new Set(DEFAULT_COLLECTED_WARE_IDS)
      await collectedWareStorage.save(collectedTeaWareIds.value)
    } else {
      collectedTeaWareIds.value = savedWareIds
    }
  }

  return {
    currentTea,
    selectedTeaWare,
    brewState,
    tasteDimensions,
    history,
    achievements,
    newAchievement,
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
