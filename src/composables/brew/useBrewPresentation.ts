import { computed, ref, watch } from 'vue'
import { getSoupColor } from '@/data/teas'
import type { useTeaStore } from '@/stores/tea'
import { BrewPhase } from '@/types/brewing'
import { colorTokens } from '@/styles/colorTokens'
import type { Ref } from 'vue'

/**
 * 冲泡展示派生状态（从 BrewView.vue 拆出，2026-10-22 B8）：
 * 按钮标签、阶段描述、仪式步骤、茶汤色、火苗高度、泡数、读屏播报——全是纯派生，无副作用。
 * 依赖注入：brewState（brew store）、teaStore、pourSpeed、rinseCountdown。
 */

interface BrewStateLike {
  phase: BrewPhase
  currentTemp: number
  targetTemp: number
  steepTime: number
  infusionsDone: number
}

export function useBrewPresentation(
  brewState: BrewStateLike,
  teaStore: ReturnType<typeof useTeaStore>,
  pourSpeed: Ref<number>,
  rinseCountdown: Ref<number>,
) {
  // ============ 计算属性 ============
  const soupColor = computed(() => {
    if (!teaStore.currentTea) return colorTokens.paper
    // 注水越急，茶叶翻动越明显，显色略快；这是视觉反馈，不改变实际计时。
    const visualSteepTime = brewState.steepTime * (0.8 + pourSpeed.value * 0.4)
    return getSoupColor(teaStore.currentTea, visualSteepTime)
  })

  const flameHeight = computed(() => {
    if (brewState.phase !== BrewPhase.HEATING) return 0
    return Math.min(1, (brewState.currentTemp / Math.max(brewState.targetTemp, 1)) * 1.5)
  })

  const currentInfusion = computed(() => brewState.infusionsDone + 1)
  const completedInfusion = computed(() => Math.max(1, brewState.infusionsDone))
  const totalInfusions = computed(() => teaStore.currentTea?.infusions ?? 1)

  const recommendedSteepTime = computed(() => {
    if (!teaStore.currentTea) return 0
    return teaStore.currentTea.bestTime + brewState.infusionsDone * 5
  })

  // 当前阶段是否为 IDLE
  const isIdle = computed(() => brewState.phase === BrewPhase.IDLE)
  const hasTeaWare = computed(() => teaStore.selectedTeaWare !== null)
  const isPouring = computed(() =>
    [BrewPhase.WARMING, BrewPhase.RINSING, BrewPhase.STEEPING].includes(brewState.phase),
  )
  const teaStrength = computed(() => Math.round((0.8 + pourSpeed.value * 0.4) * 100))

  const ceremonySteps = [
    { phase: BrewPhase.IDLE, label: '备器' },
    { phase: BrewPhase.HEATING, label: '煮水' },
    { phase: BrewPhase.WARMING, label: '温杯' },
    { phase: BrewPhase.RINSING, label: '醒茶' },
    { phase: BrewPhase.STEEPING, label: '浸泡' },
    { phase: BrewPhase.DONE, label: '出汤' },
  ] as const
  const ceremonyStepIndex = computed(() => {
    const phase = brewState.phase
    if (phase === BrewPhase.READY) return 4
    return Math.max(
      0,
      ceremonySteps.findIndex((step) => step.phase === phase),
    )
  })

  // ============ 按钮标签 ============
  const mainActionLabel = computed(() => {
    switch (brewState.phase) {
      case BrewPhase.IDLE:
        return hasTeaWare.value ? '开始煮水' : '请选择茶器'
      case BrewPhase.HEATING:
        return `${brewState.currentTemp}°C`
      case BrewPhase.WARMING:
        return '温杯中…'
      case BrewPhase.RINSING:
        return `醒茶中 ${rinseCountdown.value}s`
      case BrewPhase.READY:
        return `第${currentInfusion.value}泡 · 开始冲泡`
      case BrewPhase.STEEPING:
        return `出汤 (${brewState.steepTime}s)`
      case BrewPhase.DONE:
        return brewState.infusionsDone < (teaStore.currentTea?.infusions ?? 0)
          ? '继续冲泡'
          : '开始品鉴 →'
    }
  })

  const phaseDescription = computed(() => {
    switch (brewState.phase) {
      case BrewPhase.IDLE:
        return '选择茶器，设定水温与投茶量'
      case BrewPhase.HEATING:
        return `电陶炉加热中... 目标 ${brewState.targetTemp}°C`
      case BrewPhase.WARMING:
        return '用热水温润茶器，提升茶汤品质'
      case BrewPhase.RINSING:
        return '醒茶（洗茶）中，唤醒茶香'
      case BrewPhase.READY:
        return `水已沸，茶器已备，推荐浸泡 ${recommendedSteepTime.value} 秒`
      case BrewPhase.STEEPING:
        return `第${currentInfusion.value}泡 · 自动续水 · 推荐 ${recommendedSteepTime.value} 秒`
      case BrewPhase.DONE:
        return `第${currentInfusion.value}泡（${brewState.steepTime}s）完成`
    }
  })

  // P2-6 无障碍：阶段自动流转对读屏用户不可见，用视觉隐藏 live region 播报。
  // 只播阶段切换与醒茶最后 3 秒倒计时，不追 steepTime / 水温高频变化（避免吵）。
  const liveAnnouncement = ref('')
  let lastLivePhase: BrewPhase | null = null
  watch(
    [() => brewState.phase, rinseCountdown],
    ([phase, countdown]) => {
      if (phase === BrewPhase.RINSING) {
        if (countdown > 0 && countdown <= 3) {
          liveAnnouncement.value = `醒茶中，还剩 ${countdown} 秒`
        }
        return
      }
      if (lastLivePhase !== phase) {
        lastLivePhase = phase
        liveAnnouncement.value = phaseDescription.value
      }
    },
    // 挂载即播报当前阶段（懒加载路由下阶段可能已推进，初始 HEATING 也不能漏报）
    { immediate: true },
  )

  return {
    soupColor,
    flameHeight,
    currentInfusion,
    completedInfusion,
    totalInfusions,
    recommendedSteepTime,
    isIdle,
    hasTeaWare,
    isPouring,
    teaStrength,
    ceremonySteps,
    ceremonyStepIndex,
    mainActionLabel,
    phaseDescription,
    liveAnnouncement,
  }
}
