<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { VNodeRef } from 'vue'
import { useRouter } from 'vue-router'
import TeaBrewScene3D from '@/components/three/TeaBrewScene3D.vue'
import { useBrewPhaseMachine } from '@/composables/brew/useBrewPhaseMachine'
import { useBrewAtmosphere } from '@/composables/brew/useBrewAtmosphere'
import { useBrewPourGesture } from '@/composables/brew/useBrewPourGesture'
import { useBrewPresentation } from '@/composables/brew/useBrewPresentation'
import type { BrewSkinId } from '@/components/three/brewSkins'
import { useTeaStore } from '@/stores/tea'
import { BrewPhase } from '@/types/brewing'
import CeremonyProgress from './brew/CeremonyProgress.vue'
import BrewSkinSwitcher from './brew/BrewSkinSwitcher.vue'
import BrewStageAnimation from './brew/BrewStageAnimation.vue'

// 编排层（2026-10-22 B8 拆分后）：本文件只做「组装 + 阶段编排 + 模板」。
// 阶段状态机 useBrewPhaseMachine / 氛围同步 useBrewAtmosphere / 注水手势 useBrewPourGesture /
// 展示派生 useBrewPresentation；动画区域 BrewStageAnimation；皮肤切换 BrewSkinSwitcher。
const router = useRouter()
const store = useTeaStore()
const machine = useBrewPhaseMachine()
const {
  brewState,
  audio,
  stopHeating,
  backToSetup,
  ensureHeatingInterval,
  autoWarming,
  handleMainAction,
  startSteeping,
  isPouringOut,
  rinseCountdown,
  finaleLine,
  showFinale,
} = machine
const atmosphere = useBrewAtmosphere(brewState, audio)
const gesture = useBrewPourGesture(brewState, audio, startSteeping)
// 解构到顶层：<script setup> 模板只对顶层绑定自动解包 ref，属性访问（gesture.x）不解包
const {
  pourProgress3D,
  canGesturePour,
  isPourGestureActive,
  pourGestureStyle,
  streamStyle,
  beginPourGesture,
  movePourGesture,
  endPourGesture,
  onPourKeydown,
} = gesture
// 粒子容器：useParticles 的 containerRef 是 ref 对象，包成函数 ref 透传给子组件（VNodeRef 契约）
const particleContainerRef: VNodeRef = (el) => {
  atmosphere.particleCanvas.containerRef.value = el as HTMLDivElement | null
}
const {
  soupColor,
  flameHeight,
  currentInfusion,
  completedInfusion,
  recommendedSteepTime,
  isIdle,
  isPouring,
  teaStrength,
  ceremonySteps,
  ceremonyStepIndex,
  mainActionLabel,
  phaseDescription,
  liveAnnouncement,
} = useBrewPresentation(brewState, store, gesture.pourSpeed, rinseCountdown)

// headless（CI/E2E 无 GPU、SwiftShader 软渲染）下不挂载 3D 场景，回退 CSS 插画，
// 避免软渲染逐帧阻塞主线程拖垮冲泡状态机；真实浏览器正常显示 3D。
const isHeadless = computed(
  () =>
    typeof navigator !== 'undefined' &&
    (navigator.webdriver === true || /HeadlessChrome/i.test(navigator.userAgent)),
)

// 环境皮肤：湖畔烟雨为默认（雨雾氛围最出片，也与项目茶山资产最接近）
const brewSkin = ref<BrewSkinId>('lake-rain')

// 阶段编排 watch（原 BrewView 内联逻辑，逐字保留）：离 HEATING 停升温；
// 自动进 WARMING 时走 0.8s 注水动画再完成温杯；每次阶段切换同步粒子音效。
watch(
  () => brewState.phase,
  (newPhase, oldPhase) => {
    if (oldPhase === BrewPhase.HEATING && newPhase !== BrewPhase.HEATING) {
      stopHeating()
    }
    if (newPhase === BrewPhase.WARMING) {
      autoWarming()
    }
    atmosphere.syncParticlesToPhase(newPhase)
  },
)

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
    <BrewSkinSwitcher v-model="brewSkin" />

    <h2 class="text-3xl font-bold text-[var(--color-wood)] mb-2">冲泡</h2>
    <p v-if="store.currentTea" class="text-lg text-[var(--color-wood)] mb-1">
      {{ store.currentTea.name }}
    </p>
    <p class="text-sm text-[var(--color-wood-light)] mb-6">{{ phaseDescription }}</p>

    <!-- P2-6 无障碍：视觉隐藏的读屏播报区（阶段流转 / 醒茶倒计时） -->
    <div class="sr-only" role="status" aria-live="polite">{{ liveAnnouncement }}</div>

    <!-- 工夫茶仪式进度 -->
    <CeremonyProgress :steps="ceremonySteps" :current-index="ceremonyStepIndex" />

    <!-- 冲泡动画区域（粒子 + headless CSS 回退 + 注水手势 + 出汤/茶汤色/醒茶倒计时） -->
    <BrewStageAnimation
      v-if="!isIdle"
      :is-headless="isHeadless"
      :phase="brewState.phase"
      :current-temp="brewState.currentTemp"
      :target-temp="brewState.targetTemp"
      :soup-color="soupColor"
      :flame-height="flameHeight"
      :rinse-countdown="rinseCountdown"
      :is-pouring="isPouring"
      :can-gesture-pour="canGesturePour"
      :is-pour-gesture-active="isPourGestureActive"
      :pour-gesture-style="pourGestureStyle"
      :stream-style="streamStyle"
      :is-pouring-out="isPouringOut"
      :completed-infusion="completedInfusion"
      :container-ref="particleContainerRef"
      :on-begin-pour="beginPourGesture"
      :on-move-pour="movePourGesture"
      :on-end-pour="endPourGesture"
      :on-pour-keydown="onPourKeydown"
    />

    <!-- ======== 信息展示 ======== -->
    <div v-if="!isIdle" class="text-center mb-4">
      <p class="text-4xl font-bold text-[var(--color-wood)]">
        {{ brewState.phase === BrewPhase.STEEPING ? brewState.steepTime + 's' : brewState.currentTemp + '°C' }}
      </p>
      <p class="text-sm text-[var(--color-wood-light)]">
        <template v-if="brewState.phase === BrewPhase.WARMING">自动温杯中…</template>
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
      :disabled="brewState.phase === BrewPhase.HEATING || brewState.phase === BrewPhase.RINSING || brewState.phase === BrewPhase.WARMING"
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
   与 3D 夜色暖光茶席背景协调
   暗色 6 令牌 = @theme -dark 变体（值见 DESIGN_SPEC），此处仅做别名重绑定；
   发光派生色（#f0e0c0 / #e8b860 / #e8c87a 茶金亮化）待令牌化，暂保留裸值。 */
.brew-dark {
  --color-wood: var(--color-wood-dark);
  --color-wood-light: var(--color-wood-light-dark);
  --color-cream: var(--color-cream-dark);
  --color-paper: var(--color-paper-dark);
  --color-tea-gold: var(--color-tea-gold-dark);
  --color-ink: var(--color-ink-dark);
  /* 胶片颗粒强度旋钮：参考 three.js FilmPass noise 默认 0.02、上限约 0.08，
     本场景实拍感取 0.04 起步，范围 0.03~0.05 可调（抖音截图感） */
  --grain-opacity: 0.04;
  color: var(--color-wood-dark);
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
  box-shadow: 0 0 20px rgba(232, 184, 96, 0.25);
}

.brew-dark input[type="range"] {
  background: rgba(42, 31, 21, 0.8) !important;
}

.brew-dark input[type="range"]::-webkit-slider-thumb {
  background: linear-gradient(135deg, #e8c87a, #c9a96e) !important;
  box-shadow: 0 0 12px rgba(232, 200, 133, 0.5);
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
