<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { useBrewStore } from '@/stores/brew'
import { getSoupColor } from '@/data/teas'
import { BrewPhase } from '@/types/brewing'
import { useParticleSystem } from '@/composables/useParticles'
import { useAudio } from '@/composables/useAudio'
import TeaBrewScene3D from '@/components/three/TeaBrewScene3D.vue'
import { BREW_SKIN_LIST, type BrewSkinId } from '@/components/three/brewSkins'
import CeremonyProgress from './brew/CeremonyProgress.vue'

const router = useRouter()
const store = useTeaStore()
const brew = useBrewStore()
// 冲泡状态直连 brewStore（与 teaStore 委托的是同一对象），teaStore 只保留茶叶/茶器业务
const brewState = brew.state
const audio = useAudio()

// headless（CI/E2E 无 GPU、SwiftShader 软渲染）下不挂载 3D 场景，回退 CSS 插画，
// 避免软渲染逐帧阻塞主线程拖垮冲泡状态机；真实浏览器正常显示 3D。
const isHeadless = computed(
  () => typeof navigator !== 'undefined' && (navigator.webdriver === true || /HeadlessChrome/i.test(navigator.userAgent)),
)

// 环境皮肤：湖畔烟雨为默认（雨雾氛围最出片，也与项目茶山资产最接近）
const brewSkin = ref<BrewSkinId>('lake-rain')

// ============ Canvas 粒子系统 ============
const particleCanvas = useParticleSystem({ width: 256, height: 256 })

let particlesStarted = false

function syncParticlesToPhase(phase: BrewPhase) {
  if (!particlesStarted) return

  // 先停止所有
  particleCanvas.stopFire()
  particleCanvas.stopSteam()
  particleCanvas.stopRipple()
  audio.stopAmbient()
  audio.stopBoiling()
  audio.stopCrackle()

  switch (phase) {
    case BrewPhase.HEATING:
      particleCanvas.startFire()
      audio.startBoiling()
      audio.startCrackle()
      if (brewState.currentTemp > 60) {
        particleCanvas.startSteam()
      }
      break
    case BrewPhase.WARMING:
    case BrewPhase.RINSING:
      particleCanvas.startSteam()
      audio.startAmbient()
      break
    case BrewPhase.READY:
      particleCanvas.startSteam()
      audio.startAmbient()
      break
    case BrewPhase.STEEPING:
      particleCanvas.startSteam()
      // 注：原实现在此同时 startRipple()，两个 createContainer 并发 engine.load
      // 同一容器元素，tsParticles 异步销毁/加载存在竞态，会导致动画循环泄漏、
      // 主线程卡死（E2E 实测）。浸泡阶段保留蒸汽表现即可，涟漪改由注水动画呈现。
      audio.startAmbient()
      break
    case BrewPhase.DONE:
      particleCanvas.startSteam()
      audio.startAmbient()
      break
  }
}

watch(() => brewState.phase, (newPhase, oldPhase) => {
  // 离开 HEATING 时清理加热定时器
  if (oldPhase === BrewPhase.HEATING && newPhase !== BrewPhase.HEATING) {
    stopHeating()
  }
  syncParticlesToPhase(newPhase)
})

watch(() => brewState.currentTemp, (temp) => {
  const target = brewState.targetTemp
  const intensity = target > 20 ? Math.min(1, temp / target) : 0
  particleCanvas.setFlameIntensity(Math.min(1, intensity * 1.5))
  if (particlesStarted && brewState.phase === BrewPhase.HEATING) {
    if (temp > 60) particleCanvas.startSteam()
    else particleCanvas.stopSteam()
  }
})

let mountedTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  // 备器（选器/水温/投茶量）已拆分到 /tools：若未经备器页直达 /brew（如刷新），引导回备器页
  if (brewState.phase === BrewPhase.IDLE) {
    router.replace('/tools')
    return
  }
  // 从备器页「开始煮水」进入时 phase 已是 HEATING，由本页接续升温定时器
  if (brewState.phase === BrewPhase.HEATING) {
    ensureHeatingInterval()
  }
  // 给 container 一点时间挂载
  mountedTimer = setTimeout(() => {
    particlesStarted = true
    syncParticlesToPhase(brewState.phase)
  }, 100)
})

onUnmounted(() => {
  // 清理粒子系统、音效、定时器
  if (mountedTimer) {
    clearTimeout(mountedTimer)
    mountedTimer = null
  }
  particleCanvas.destroy()
  audio.stopAll()
  stopHeating()
  if (warmTimer) clearTimeout(warmTimer)
  if (outflowTimer) clearTimeout(outflowTimer)
  if (finaleTimer) clearTimeout(finaleTimer)
  if (steepInterval) clearInterval(steepInterval)
  if (rinseInterval) clearInterval(rinseInterval)
})

// ============ 定时器 ============
let warmTimer: ReturnType<typeof setTimeout> | null = null
// window.setInterval 返回 number；显式声明避免依赖全局 setTimeout/setInterval
// 的类型解析（@types/node 会将其覆盖为 NodeJS.Timeout）。
let heatInterval: number | null = null
let steepInterval: number | null = null
let rinseInterval: number | null = null
let steepStartedAt: number | null = null
const rinseCountdown = ref(0)
const pourGestureProgress = ref(0)
const isPourGestureActive = ref(false)
const isPouringOut = ref(false)
const pourSpeed = ref(0.5)
let pourPointerStartX = 0
let pourPointerStartedAt = 0
let outflowTimer: ReturnType<typeof setTimeout> | null = null

// 捧杯收尾：最后一泡出汤后停 2 秒，浮一句情绪文案再进品鉴
const FINALE_LINES = ['这一口是热的', '日常琐碎即浪漫', '雨落在湖上']
const finaleLine = ref('')
const showFinale = ref(false)
let finaleTimer: ReturnType<typeof setTimeout> | null = null

function goTasteAfterFinale() {
  finaleLine.value = FINALE_LINES[Math.floor(Math.random() * FINALE_LINES.length)] ?? FINALE_LINES[0]!
  showFinale.value = true
  finaleTimer = setTimeout(() => {
    showFinale.value = false
    router.push('/taste')
  }, 2000)
}

const canGesturePour = computed(() => brewState.phase === BrewPhase.READY)
const pourGestureStyle = computed(() => ({
  transform: `translateX(${pourGestureProgress.value * 0.18}px) rotate(${-25 - pourGestureProgress.value * 0.12}deg)`,
}))
const streamStyle = computed(() => ({
  animationDuration: `${1.2 - pourSpeed.value * 0.55}s`,
}))
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
  return Math.max(0, ceremonySteps.findIndex(step => step.phase === phase))
})

// ============ 计算属性 ============
const soupColor = computed(() => {
  if (!store.currentTea) return '#F5F0E8'
  // 注水越急，茶叶翻动越明显，显色略快；这是视觉反馈，不改变实际计时。
  const visualSteepTime = brewState.steepTime * (0.8 + pourSpeed.value * 0.4)
  return getSoupColor(store.currentTea, visualSteepTime)
})

const flameHeight = computed(() => {
  if (brewState.phase !== BrewPhase.HEATING) return 0
  return Math.min(1, (brewState.currentTemp / Math.max(brewState.targetTemp, 1)) * 1.5)
})

const currentInfusion = computed(() => brewState.infusionsDone + 1)
const completedInfusion = computed(() => Math.max(1, brewState.infusionsDone))
const totalInfusions = computed(() => store.currentTea?.infusions ?? 1)

const recommendedSteepTime = computed(() => {
  if (!store.currentTea) return 0
  return store.currentTea.bestTime + brewState.infusionsDone * 5
})

// 当前阶段是否为 IDLE
const isIdle = computed(() => brewState.phase === BrewPhase.IDLE)
const hasTeaWare = computed(() => store.selectedTeaWare !== null)
const isPouring = computed(() => [BrewPhase.WARMING, BrewPhase.RINSING, BrewPhase.STEEPING].includes(brewState.phase))

// 拖拽注水进度同步给 3D：拖拽中实时传 0~1，松手/非拖拽阶段传 -1 交回 phase 自动。
// 让 3D 真手与茶壶倾斜跟着手指走，而不是按 phase 自动满姿态。
const pourProgress3D = computed(() =>
  isPourGestureActive.value ? pourGestureProgress.value / 100 : -1,
)

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
function handleWarming() {
  audio.playPourWater(1.0)  // 先播音效
  brew.completeWarming()  // 再切换阶段
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

function beginPourGesture(event: PointerEvent) {
  if (!canGesturePour.value) return
  pourPointerStartX = event.clientX
  pourPointerStartedAt = performance.now()
  pourGestureProgress.value = 0
  isPourGestureActive.value = true
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function movePourGesture(event: PointerEvent) {
  if (!isPourGestureActive.value) return
  // 向右拖动代表壶嘴向茶器倾斜，限制在 0~100 之间
  pourGestureProgress.value = Math.max(0, Math.min(100, event.clientX - pourPointerStartX))
}

function endPourGesture(event: PointerEvent) {
  if (!isPourGestureActive.value) return
  isPourGestureActive.value = false
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
  if (pourGestureProgress.value >= 60) {
    const elapsed = Math.max(performance.now() - pourPointerStartedAt, 120)
    pourSpeed.value = Math.max(0.1, Math.min(1, pourGestureProgress.value / elapsed * 4))
    audio.playPourWater(1 + pourGestureProgress.value / 100)
    startSteeping()
  }
  pourGestureProgress.value = 0
}

function stopSteeping() {
  if (steepInterval) {
    clearInterval(steepInterval)
    steepInterval = null
  }
  if (steepStartedAt !== null) {
    brew.updateSteepTime(Math.max(brewState.steepTime, Math.floor((performance.now() - steepStartedAt) / 1000)))
    steepStartedAt = null
  }
  brew.stopSteeping()
  audio.playPourTea(1.5)  // 出汤声
  isPouringOut.value = true
  if (outflowTimer) clearTimeout(outflowTimer)
  // 出汤动画 1.8s 后自动推进下一泡或捧杯收尾，不等用户再点「出汤完成」。
  // 流程：煮水自动 → 醒茶自动倒计时 → READY 拖一次注水 → 浸泡 → 出汤全自动。
  outflowTimer = setTimeout(() => {
    isPouringOut.value = false
    outflowTimer = null
    handleMainAction()
  }, 1800)
}

function handleMainAction() {
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
    if (brewState.infusionsDone < (store.currentTea?.infusions ?? 0)) {
      isPouringOut.value = false
      brew.nextInfusion()
      startSteeping()
    } else {
      audio.playSuccess()
      goTasteAfterFinale()
    }
  }
}

// ============ 按钮标签 ============
const mainActionLabel = computed(() => {
  switch (brewState.phase) {
    case BrewPhase.IDLE:
      return hasTeaWare.value ? '开始煮水' : '请选择茶器'
    case BrewPhase.HEATING:
      return `${brewState.currentTemp}°C`
    case BrewPhase.WARMING:
      return '温杯'
    case BrewPhase.RINSING:
      return `醒茶中 ${rinseCountdown.value}s`
    case BrewPhase.READY:
      return `第${currentInfusion.value}泡 · 开始冲泡`
    case BrewPhase.STEEPING:
      return `出汤 (${brewState.steepTime}s)`
    case BrewPhase.DONE:
      return brewState.infusionsDone < (store.currentTea?.infusions ?? 0)
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
      return `第${currentInfusion.value}泡 · 推荐 ${recommendedSteepTime.value} 秒`
    case BrewPhase.DONE:
      return `第${currentInfusion.value}泡（${brewState.steepTime}s）完成`
  }
})


</script>

<template>
  <div class="brew-dark min-h-[100dvh] p-4 sm:p-8 flex flex-col items-center relative overflow-hidden z-0">
    <!-- 3D 真实感茶席背景（状态机 / 手势 / 音频不受影响；headless 回退 CSS 插画） -->
    <TeaBrewScene3D
      v-if="!isHeadless"
      :phase="brewState.phase"
      :soup-color="soupColor"
      :current-temp="brewState.currentTemp"
      :target-temp="brewState.targetTemp"
      :is-pouring-out="isPouringOut"
      :infusion="currentInfusion"
      :skin="brewSkin"
      :pour-progress="pourProgress3D"
    />
    <!-- 环境皮肤切换：右上角极小文字按钮，验证三套氛围用 -->
    <div class="fixed top-3 right-3 z-40 flex gap-2 text-xs">
      <button
        v-for="s in BREW_SKIN_LIST"
        :key="s.id"
        type="button"
        @click="brewSkin = s.id"
        class="px-2 py-1 rounded-full transition-all"
        :class="brewSkin === s.id
          ? 'bg-[var(--color-tea-gold)]/80 text-[#1a120a]'
          : 'text-[var(--color-wood-light)]/70 hover:text-[var(--color-wood)]'"
      >
        {{ s.label }}
      </button>
    </div>

    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-2">冲泡</h2>
    <p v-if="store.currentTea" class="text-lg text-[var(--color-wood)] mb-1">
      {{ store.currentTea.name }}
    </p>
    <p class="text-sm text-[var(--color-wood-light)] mb-6">{{ phaseDescription }}</p>

    <!-- 工夫茶仪式进度 -->
    <CeremonyProgress :steps="ceremonySteps" :current-index="ceremonyStepIndex" />

    <!-- ======== 冲泡动画区域（非 IDLE）======== -->
    <div v-if="!isIdle" class="relative w-64 h-64 mb-6">
      <!-- tsParticles 容器（3D 场景接管视觉，保留 DOM 以便回退）-->
      <div
        :ref="particleCanvas.containerRef"
        class="absolute inset-0 w-full h-full pointer-events-none z-10"
        v-show="!isHeadless"
      ></div>
      <!-- 火焰粒子 (CSS 备用，3D 接管) -->
      <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-14" v-show="isHeadless">
        <div
          v-for="i in 5" :key="i"
          class="absolute bottom-0 rounded-full"
          :style="{
            width: `${6 + i * 2}px`,
            height: brewState.phase === BrewPhase.HEATING ? `${20 * flameHeight + i * 5}px` : '0px',
            left: `${i * 5 - 4}px`,
            background: 'linear-gradient(to top, #ff4500, #ff8c00, #ffd700)',
            animation: 'flame 0.3s ease-in-out infinite',
            animationDelay: `${i * 0.08}s`,
            transition: 'height 0.3s',
          }"
        ></div>
      </div>

      <!-- 炉 + 茶壶：CSS 版（3D 场景接管视觉，保留 DOM 以便回退）-->
      <div class="tea-stove absolute bottom-5 left-1/2 -translate-x-1/2" v-show="isHeadless">
        <div class="tea-kettle-handle"></div>
        <div class="tea-kettle-lid"></div>
        <div
          class="tea-kettle-body transition-all duration-500 overflow-hidden"
          :style="{
            backgroundColor: brewState.phase === BrewPhase.STEEPING || brewState.phase === BrewPhase.DONE
              ? soupColor
              : brewState.currentTemp > 60 ? '#87CEEB' : '#B0E0E6',
            height: brewState.phase === BrewPhase.STEEPING ? '80%' : '70%',
          }"
        >
          <div
            v-if="brewState.phase === BrewPhase.HEATING && brewState.currentTemp > 70"
            v-for="i in 3" :key="i"
            class="absolute w-1.5 h-1.5 bg-white/60 rounded-full"
            :style="{
              bottom: `${i * 25}%`,
              left: `${i * 30}%`,
              animation: 'bounce 1s ease-in-out infinite',
              animationDelay: `${i * 0.3}s`,
            }"
          ></div>
        </div>
        <div class="tea-kettle-spout"></div>
      </div>

      <!-- 蒸汽：CSS 版（3D 场景接管）-->
      <div class="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1" v-show="isHeadless">
        <div
          v-for="i in 3" :key="i"
          class="w-1 h-8 rounded-full bg-[var(--color-wood-light)]"
          :style="{ opacity: 0.2, animation: `steam 2s ease-out infinite`, animationDelay: `${i * 0.4}s` }"
        ></div>
      </div>

      <!-- 注水水流：用分层 CSS 模拟壶嘴、水柱、飞溅和茶面涟漪 -->
      <div v-if="isPouring || canGesturePour" class="pouring-scene" :class="{ 'gesture-ready': canGesturePour }">
        <div
          class="pouring-kettle"
          :style="pourGestureStyle"
          :class="{ 'pouring-kettle-active': isPourGestureActive }"
          role="button"
          tabindex="0"
          title="向右拖动壶嘴注水"
          @pointerdown="beginPourGesture"
          @pointermove="movePourGesture"
          @pointerup="endPourGesture"
          @pointercancel="endPourGesture"
        >◒</div>
        <div v-if="isPouring || isPourGestureActive" class="water-stream" :style="streamStyle"><span></span><span></span><span></span></div>
        <div v-if="isPouring || isPourGestureActive" class="water-splash"><i></i><i></i><i></i><i></i></div>
        <div v-if="isPouring || isPourGestureActive" class="tea-ripple tea-ripple-one"></div>
        <div v-if="isPouring || isPourGestureActive" class="tea-ripple tea-ripple-two"></div>
        <p v-if="canGesturePour && !isPourGestureActive" class="pour-hint">向右拖动壶嘴注水</p>
      </div>

      <!-- 浸泡时茶叶缓慢舒展，让等待本身成为体验的一部分 -->
      <div v-if="brewState.phase === BrewPhase.STEEPING" class="tea-leaves" aria-hidden="true">
        <span v-for="i in 4" :key="i" :style="{ animationDelay: `${i * 0.35}s` }"><IconLeaf class="w-6 h-6 text-[var(--color-tea-gold)]" /></span>
      </div>

      <!-- 出汤：倾壶、流线、杯中液面与落点涟漪 -->
      <div v-if="isPouringOut" class="outflow-scene" aria-live="polite">
        <div class="outflow-kettle">◒</div>
        <div class="outflow-stream"></div>
        <div class="outflow-cup">
          <div class="outflow-liquid" :style="{ backgroundColor: soupColor }"></div>
          <div class="outflow-cup-shine"></div>
        </div>
        <div class="outflow-drop"></div>
        <p class="outflow-label">出汤 · 第 {{ completedInfusion }} 泡</p>
      </div>

      <!-- 茶汤色展示（浸泡/出汤时）-->
      <div
        v-if="brewState.phase === BrewPhase.STEEPING || brewState.phase === BrewPhase.DONE"
        class="absolute -right-8 bottom-4 w-20 h-24 bg-white/80 rounded-lg shadow-sm flex flex-col items-center justify-center p-2"
      >
        <div class="w-12 h-12 rounded-full mb-1 transition-colors duration-500"
          :style="{ backgroundColor: soupColor }"></div>
        <p class="text-xs text-[var(--color-wood-light)]">茶汤</p>
      </div>

      <!-- 醒茶提示 -->
      <div
        v-if="brewState.phase === BrewPhase.RINSING"
        class="absolute -left-8 bottom-4 w-20 text-center"
      >
        <p class="text-xs text-[var(--color-wood-light)]">醒茶倒计时</p>
        <p class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ rinseCountdown }}</p>
      </div>
    </div>

    <!-- ======== 信息展示 ======== -->
    <div v-if="!isIdle" class="text-center mb-4">
      <p class="text-4xl font-bold text-[var(--color-wood)]">
        {{ brewState.phase === BrewPhase.STEEPING ? brewState.steepTime + 's' : brewState.currentTemp + '°C' }}
      </p>
      <p class="text-sm text-[var(--color-wood-light)]">
        <template v-if="brewState.phase === BrewPhase.WARMING">点击按钮用热水温润茶器</template>
        <template v-else-if="brewState.phase === BrewPhase.RINSING">醒茶中，倒去第一泡</template>
        <template v-else-if="brewState.phase === BrewPhase.STEEPING">
          目标 {{ recommendedSteepTime }}s · 投茶 {{ brewState.teaWeight }}g · 茶汤显色 {{ teaStrength }}%
        </template>
        <template v-else-if="brewState.phase === BrewPhase.DONE">
          实际浸泡 {{ brewState.steepTime }}s
        </template>
        <template v-else>
          目标 {{ brewState.targetTemp }}°C · {{ store.selectedTeaWare?.name }}
        </template>
      </p>
    </div>

    <!-- ======== 主按钮 ======== -->
    <button
      @click="handleMainAction"
      :disabled="brewState.phase === BrewPhase.HEATING || brewState.phase === BrewPhase.RINSING"
      class="mt-4 px-10 py-4 rounded-lg text-xl transition-all duration-300"
      :class="isIdle && !store.selectedTeaWare
        ? 'bg-[#E8E2D8] text-[#B5AC9C] cursor-not-allowed'
        : brewState.phase === BrewPhase.STEEPING
          ? 'bg-[var(--color-tea-gold)] text-white hover:bg-[#B89450]'
          : 'bg-[var(--color-wood)] text-[var(--color-cream)] hover:bg-[var(--color-wood-light)]'"
    >
      {{ mainActionLabel }}
    </button>

    <!-- ======== 返回备器调整（仅煮水阶段，流程推进后不再回退以免状态错乱）======== -->
    <button
      v-if="brewState.phase === BrewPhase.HEATING"
      @click="backToSetup"
      class="mt-3 text-sm text-[var(--color-wood-light)] hover:text-[var(--color-wood)] transition-colors"
    >
      ← 返回调整茶器 / 水温 / 投茶量
    </button>

    <!-- ======== 茶器信息 ======== -->
    <div v-if="store.selectedTeaWare && !isIdle" class="mt-4 text-xs text-[var(--color-wood-light)]">
      {{ store.selectedTeaWare.name }} · {{ store.selectedTeaWare.material }} · {{ store.selectedTeaWare.capacity }}ml
    </div>

    <!-- ======== 冲泡进度 ======== -->
    <div v-if="!isIdle && store.currentTea" class="mt-6 flex gap-2">
      <div
        v-for="i in store.currentTea.infusions" :key="i"
        class="w-6 h-6 rounded-full text-xs flex items-center justify-center transition-all"
        :class="i <= brewState.infusionsDone
          ? 'bg-[var(--color-tea-gold)] text-white'
          : i === brewState.infusionsDone + 1 && brewState.phase !== BrewPhase.DONE
            ? 'border-2 border-[var(--color-tea-gold)] text-[var(--color-tea-gold)]'
            : 'bg-[#E8E2D8] text-[#B5AC9C]'"
      >
        {{ i }}
      </div>
    </div>

    <!-- 胶片颗粒 + 暗角：全屏 overlay（pointer-events-none），压掉 3D CG 干净感，
         模拟视频里的实拍颗粒。opacity 默认 0.05，留作质感旋钮；reduced-transparency 下降零 -->
    <div class="film-vignette" aria-hidden="true"></div>
    <div class="film-grain" aria-hidden="true"></div>

    <!-- 捧杯收尾：最后一泡出汤后浮一句情绪文案，2 秒后自动进品鉴 -->
    <transition name="finale-fade">
      <div v-if="showFinale" class="finale-line" aria-live="polite">
        <p>{{ finaleLine }}</p>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* UI 方向 A：毛玻璃深色面板 + 琥珀描边 + 发光温度
   与 3D 夜色暖光茶席背景协调 */
.brew-dark {
  --color-wood: #e8d5b0;
  --color-wood-light: #b8a080;
  --color-cream: #1a120a;
  --color-paper: #2a1f15;
  --color-tea-gold: #c9a96e;
  --color-ink: #f5e6c8;
  /* 胶片颗粒强度旋钮：参考 three.js FilmPass noise 默认 0.02、上限约 0.08，
     本场景实拍感取 0.04 起步，范围 0.03~0.05 可调（抖音截图感） */
  --grain-opacity: 0.04;
  color: #e8d5b0;
}

.brew-dark :deep(.glass-panel) {
  background: rgba(26, 18, 12, 0.72) !important;
  backdrop-filter: blur(16px) saturate(1.2);
  -webkit-backdrop-filter: blur(16px) saturate(1.2);
  border: 1px solid rgba(201, 169, 110, 0.25) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(201, 169, 110, 0.1);
}

.brew-dark h2 {
  color: #f0e0c0 !important;
  text-shadow: 0 0 30px rgba(232, 184, 96, 0.3);
}

.brew-dark .text-4xl {
  color: #e8b860 !important;
  text-shadow: 0 0 24px rgba(232, 184, 96, 0.55), 0 0 60px rgba(232, 184, 96, 0.2);
  font-variant-numeric: tabular-nums;
}

.brew-dark button {
  border-color: rgba(201, 169, 110, 0.4) !important;
}
.brew-dark button:not(:disabled):hover {
  border-color: rgba(201, 169, 110, 0.8) !important;
  box-shadow: 0 0 20px rgba(201, 169, 110, 0.25);
}

.brew-dark input[type="range"] {
  background: rgba(42, 31, 21, 0.8) !important;
}
.brew-dark input[type="range"]::-webkit-slider-thumb {
  background: linear-gradient(135deg, #e8c87a, #c9a96e) !important;
  box-shadow: 0 0 12px rgba(232, 200, 122, 0.5);
  border: none !important;
}

/* 胶片颗粒：SVG feTurbulence 噪点平铺，steps 跳动模拟逐帧颗粒。
   强度由 --grain-opacity 控制（默认 0.04，范围 0.03~0.05）。 */
.film-grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 50;
  opacity: var(--grain-opacity, 0.04);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
  animation: grain-jitter 0.5s steps(3) infinite;
}

.film-vignette {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 49;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.42) 100%);
}

@keyframes grain-jitter {
  0% { background-position: 0 0; }
  33% { background-position: -40px 20px; }
  66% { background-position: 30px -30px; }
  100% { background-position: 0 0; }
}

/* 捧杯收尾文案：居中浮起，停留 2 秒 */
.finale-line {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 60;
}
.finale-line p {
  font-size: 1.6rem;
  letter-spacing: 0.1em;
  color: #f0e0c0;
  text-shadow: 0 0 30px rgba(0, 0, 0, 0.7);
}
.finale-fade-enter-active,
.finale-fade-leave-active {
  transition: opacity 0.6s ease;
}
.finale-fade-enter-from,
.finale-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-transparency: reduce) {
  .film-grain,
  .film-vignette {
    opacity: 0;
  }
}
</style>
