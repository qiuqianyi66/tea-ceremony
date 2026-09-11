/**
 * 成长进度 — 从 tea.ts 拆出
 * 管理：茶修 XP/等级、成就、茶器收藏、节气打卡
 * 历史记录依赖 recordStore（成就/茶器判定基于品鉴历史）
 */
import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import type { Achievement, TastingRecord } from '@/types/tasting'
import { achievementStorage, xpStorage, collectedWareStorage, settingsStorage } from '@/services/storage'
import { ACHIEVEMENTS, TEA_LEVELS } from '@/data/constants'
import { getTeaById } from '@/data/teas'
import { TeaType } from '@/types/tea'
import { useRecordStore } from './record'

export const useProgressStore = defineStore('progress', () => {
  const recordStore = useRecordStore()
  const DEFAULT_COLLECTED_WARE_IDS = new Set(['gaiwan', 'yixing', 'glass'])

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
          if (recordStore.history.length >= 1) {
            ach.unlocked = true
            ach.unlockedAt = new Date().toISOString()
            newAchievement.value = ach.id
            unlocked = true
          }
          break
        }
        case 'all_types': {
          const typesInHistory = new Set(recordStore.history.map(r => {
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
          if (recordStore.history.length >= 5) {
            const recent5 = recordStore.history.slice(0, 5)
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
          if (recordStore.history.length >= 20) {
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
      // Vue reactive 数组的元素是 Proxy，Proxy 无法被 IndexedDB 结构化克隆，
      // 写入前必须 toRaw 还原为普通对象，否则品鉴保存会抛 DataCloneError。
      await achievementStorage.save(all.map(ach => toRaw(ach)))
      achievements.value = all
    }
  }

  function dismissNewAchievement() {
    newAchievement.value = null
  }

  // ============ 茶器收藏 ============
  const collectedTeaWareIds = ref<Set<string>>(new Set(DEFAULT_COLLECTED_WARE_IDS))

  function isTeaWareUnlocked(wareId: string): boolean {
    return collectedTeaWareIds.value.has(wareId)
  }

  async function checkTeaWareUnlock() {
    const historyCount = recordStore.history.length
    const greenTeaCount = recordStore.history.filter(r => {
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
    for (const r of recordStore.history) {
      if (r.overallScore >= 8) streak++
      else break
    }
    return streak
  }

  /** 初始化茶器收藏（首次运行时 IndexedDB 为空，三件基础茶器默认解锁） */
  async function initCollectedWares() {
    const savedWareIds = await collectedWareStorage.load()
    if (savedWareIds.size === 0) {
      collectedTeaWareIds.value = new Set(DEFAULT_COLLECTED_WARE_IDS)
      await collectedWareStorage.save(collectedTeaWareIds.value)
    } else {
      collectedTeaWareIds.value = savedWareIds
    }
  }

  // ============ 节气打卡 ============
  const solarCheckins = ref<Record<string, string>>({})

  async function loadSolarCheckins() {
    solarCheckins.value = await settingsStorage.get<Record<string, string>>('solar-checkins', {})
  }

  /** 当前节气打卡（每节气一次）；已打卡返回 false */
  async function checkInSolarTerm(termId: string): Promise<boolean> {
    if (solarCheckins.value[termId]) return false
    solarCheckins.value = { ...solarCheckins.value, [termId]: new Date().toISOString() }
    // 写入前 toRaw 去代理，防止 Dexie 结构化克隆抛 DataCloneError
    await settingsStorage.set('solar-checkins', toRaw(solarCheckins.value))
    return true
  }

  return {
    userXp,
    currentLevel,
    nextLevel,
    xpForNextLevel,
    addXp,
    loadXp,
    achievements,
    newAchievement,
    initAchievements,
    checkAchievements,
    dismissNewAchievement,
    collectedTeaWareIds,
    isTeaWareUnlocked,
    checkTeaWareUnlock,
    initCollectedWares,
    solarCheckins,
    loadSolarCheckins,
    checkInSolarTerm,
  }
})
