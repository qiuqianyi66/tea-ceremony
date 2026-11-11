import { onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAudio } from '@/composables/useAudio'
import { useBrewStore } from '@/stores/brew'
import { useTeaStore } from '@/stores/tea'
import { BrewPhase } from '@/types/brewing'

/**
 * 冲泡阶段状态机（从 BrewView.vue 拆出，2026-10-22 B8）。
 * 只管「阶段怎么走」：升温/温杯/醒茶/浸泡/出汤的定时器与推进函数 + 捧杯收尾。
 * 粒子音效同步在 useBrewAtmosphere，注水手势在 useBrewPourGesture，展示派生在 useBrewPresentation。
 * 对外契约：BrewView 模板绑定的 ref/函数原样暴露，行为逐字不变。
 */

/**
 * 出汤结束后在 DONE 段停留的时长：留给「分茶 → 品饮」两段动画。
 * 数值依据 useBrewAnimation 的阻尼系数：分茶约 0.5s 过 70% 才起品饮，品饮再约 1.2s 到七成，1800ms 可覆盖完整动作且不额外空等。
 */
export const FAIRNESS_DWELL_MS = 1800

export function useBrewPhaseMachine() {
  const router = useRouter()
  const brew = useBrewStore()
  // 冲泡状态直连 brewStore（与 teaStore 委托的是同一对象），teaStore 只保留茶叶/茶器业务
  const brewState = brew.state
  const teaStore = useTeaStore()
  const audio = useAudio()

  // ============ 定时器 ============
  let warmTimer: ReturnType<typeof setTimeout> | null = null
  // window.setInterval 返回 number；显式声明避免依赖全局 setTimeout/setInterval
  // 的类型解析（@types/node 会将其覆盖为 NodeJS.Timeout）。
  let heatInterval: number | null = null
  let steepInterval: number | null = null
  let rinseInterval: number | null = null
  let steepStartedAt: number | null = null
  let outflowTimer: ReturnType<typeof setTimeout> | null = null
  // 出汤动画结束到「分茶 + 品饮」演完之间的停留（见 stopSteeping 注释）
  let fairnessTimer: ReturnType<typeof setTimeout> | null = null

  const rinseCountdown = ref(0)
  const isPouringOut = ref(false)

  // 捧杯收尾：最后一泡出汤后停 2 秒，浮一句情绪文案再进品鉴
  const FINALE_LINES = ['这一口是热的', '日常琐碎即浪漫', '雨落在湖上']
  const finaleLine = ref('')
  const showFinale = ref(false)
  let finaleTimer: ReturnType<typeof setTimeout> | null = null

  function goTasteAfterFinale() {
    finaleLine.value =
      FINALE_LINES[Math.floor(Math.random() * FINALE_LINES.length)] ?? FINALE_LINES[0]!
    showFinale.value = true
    finaleTimer = setTimeout(() => {
      showFinale.value = false
      router.push('/taste')
    }, 2000)
  }

  // ============ 升温计时（备器页已 startHeating，本页挂载后接续递增水温）============
  function ensureHeatingInterval() {
    if (heatInterval) return
    if (brewState.currentTemp >= brewState.targetTemp) {
      brew.updateTemp(brewState.targetTemp)
      return
    }
    heatInterval = window.setInterval(() => {
      const current = brewState.currentTemp
      const target = brewState.targetTemp
      if (current < target) {
        brew.updateTemp(Math.min(current + 1, target))
      }
    }, 80)
  }

  function stopHeating() {
    if (heatInterval) {
      clearInterval(heatInterval)
      heatInterval = null
    }
  }

  // 返回备器页调整茶器/参数：停止升温并回到 IDLE（resetBrew 保留已选茶器与水温/投茶量）
  function backToSetup() {
    stopHeating()
    brew.reset()
    router.push('/tools')
  }

  // ============ 冲泡阶段控制 ============
  // 零点击闭环：水温到 target 自动进 WARMING 后，0.8s 注水动画期间停在 WARMING
  // （主按钮显示「温杯中…」disabled，防止重复触发），随后自动完成温杯并进入醒茶倒计时。
  function autoWarming() {
    audio.playPourWater(1.0) // 注水声效随自动触发点播放，与注水动画同步
    if (warmTimer) clearTimeout(warmTimer)
    warmTimer = setTimeout(() => {
      warmTimer = null
      brew.completeWarming()
      startRinsing()
    }, 800)
  }

  function handleWarming() {
    audio.playPourWater(1.0) // 先播音效
    brew.completeWarming() // 再切换阶段
    if (warmTimer) clearTimeout(warmTimer)
    warmTimer = setTimeout(() => startRinsing(), 800)
  }

  function startRinsing() {
    if (rinseInterval) clearInterval(rinseInterval)
    rinseCountdown.value = 5
    rinseInterval = window.setInterval(() => {
      rinseCountdown.value--
      if (rinseCountdown.value <= 0) {
        if (rinseInterval) {
          clearInterval(rinseInterval)
          rinseInterval = null
        }
        brew.completeRinsing()
      }
    }, 1000)
  }

  function startSteeping() {
    if (steepInterval) clearInterval(steepInterval)
    brew.startSteeping()
    steepStartedAt = performance.now()
    steepInterval = window.setInterval(() => {
      if (steepStartedAt === null) return
      brew.updateSteepTime(Math.floor((performance.now() - steepStartedAt) / 1000))
    }, 250)
  }

  function stopSteeping() {
    if (steepInterval) {
      clearInterval(steepInterval)
      steepInterval = null
    }
    if (steepStartedAt !== null) {
      brew.updateSteepTime(
        Math.max(brewState.steepTime, Math.floor((performance.now() - steepStartedAt) / 1000)),
      )
      steepStartedAt = null
    }
    brew.stopSteeping()
    audio.playPourTea(1.5) // 出汤声
    isPouringOut.value = true
    if (outflowTimer) clearTimeout(outflowTimer)
    // 出汤动画 1.8s 后结束；随后在 DONE 段停 2.4s 让分茶与品饮演完，再推进下一泡或捧杯收尾。
    // 流程：煮水自动 → 醒茶自动倒计时 → READY 拖一次注水 → 浸泡 → 出汤全自动 → 分茶/品饮。
    // 停留时长取自 useBrewAnimation 的实际时序：fairnessPour 约 0.5s 过 70% 才起 drink，
    // drink 再约 1.5s 到七成，2.4s 够两款动画都看见，又不至于让整泡变得滞重。
    outflowTimer = setTimeout(() => {
      isPouringOut.value = false
      outflowTimer = null
      if (brewState.phase !== BrewPhase.DONE) {
        handleMainAction()
        return
      }
      fairnessTimer = setTimeout(() => {
        fairnessTimer = null
        handleMainAction()
      }, FAIRNESS_DWELL_MS)
    }, 1800)
  }

  function handleMainAction() {
    // 停留期内用户自己点了「继续冲泡」，以点击为准：撤掉待触发的推进，避免走两次
    if (fairnessTimer) {
      clearTimeout(fairnessTimer)
      fairnessTimer = null
    }
    const phase = brewState.phase

    if (phase === BrewPhase.IDLE) {
      // 正常不会到达（onMounted 已重定向），兜底回备器页
      backToSetup()
    } else if (phase === BrewPhase.WARMING) {
      handleWarming()
    } else if (phase === BrewPhase.READY) {
      startSteeping()
    } else if (phase === BrewPhase.STEEPING) {
      stopSteeping()
    } else if (phase === BrewPhase.DONE) {
      if (brewState.infusionsDone < (teaStore.currentTea?.infusions ?? 0)) {
        isPouringOut.value = false
        brew.nextInfusion()
        startSteeping()
      } else {
        audio.playSuccess()
        goTasteAfterFinale()
      }
    }
  }

  onUnmounted(() => {
    // 清理本状态机持有的全部定时器（粒子/音效清理在 useBrewAtmosphere）
    if (warmTimer) clearTimeout(warmTimer)
    if (outflowTimer) clearTimeout(outflowTimer)
    if (fairnessTimer) clearTimeout(fairnessTimer)
    if (finaleTimer) clearTimeout(finaleTimer)
    if (steepInterval) clearInterval(steepInterval)
    if (rinseInterval) clearInterval(rinseInterval)
    stopHeating()
  })

  return {
    brew,
    brewState,
    audio,
    rinseCountdown,
    isPouringOut,
    finaleLine,
    showFinale,
    ensureHeatingInterval,
    stopHeating,
    backToSetup,
    autoWarming,
    handleMainAction,
    startSteeping,
  }
}
