<script setup lang="ts">
import type { VNodeRef } from 'vue'
import { BrewPhase } from '@/types/brewing'

/**
 * 冲泡动画区域（从 BrewView.vue 拆出，2026-10-22 B8）：
 * 粒子容器 + headless CSS 回退（火焰/炉灶/蒸汽）+ 注水手势 scene + 舒展/出汤/茶汤色/醒茶倒计时。
 * 纯受控展示组件：所有状态由 props 注入，交互经 emit 回调交回父级（原函数直传，行为不变）。
 * 依赖的样式类（tea-stove/pouring-scene/water-stream 等）在 src/assets/main.css 全局，无需 scoped。
 */
defineProps<{
  isHeadless: boolean
  phase: BrewPhase
  currentTemp: number
  targetTemp: number
  soupColor: string
  flameHeight: number
  rinseCountdown: number
  isPouring: boolean
  canGesturePour: boolean
  isPourGestureActive: boolean
  pourGestureStyle: Record<string, string>
  streamStyle: Record<string, string>
  isPouringOut: boolean
  completedInfusion: number
  containerRef: VNodeRef
  onBeginPour: (event: PointerEvent) => void
  onMovePour: (event: PointerEvent) => void
  onEndPour: (event: PointerEvent) => void
  onPourKeydown: (event: KeyboardEvent) => void
}>()
</script>

<template>
  <!-- ======== 冲泡动画区域（非 IDLE）======== -->
  <div class="relative w-64 h-64 mb-6">
    <!-- tsParticles 容器（3D 场景接管视觉，保留 DOM 以便回退）-->
    <div
      :ref="containerRef"
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
          height: phase === BrewPhase.HEATING ? `${20 * flameHeight + i * 5}px` : '0px',
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
          backgroundColor: phase === BrewPhase.STEEPING || phase === BrewPhase.DONE
            ? soupColor
            : currentTemp > 60 ? '#87CEEB' : '#B0E0E6',
          height: phase === BrewPhase.STEEPING ? '80%' : '70%',
        }"
      >
        <div
          v-if="phase === BrewPhase.HEATING && currentTemp > 70"
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
        aria-label="向右拖动壶嘴注水，或按回车键注水"
        @pointerdown="onBeginPour"
        @pointermove="onMovePour"
        @pointerup="onEndPour"
        @pointercancel="onEndPour"
        @keydown="onPourKeydown"
      >◒</div>
      <div v-if="isPouring || isPourGestureActive" class="water-stream" :style="streamStyle"><span></span><span></span><span></span></div>
      <div v-if="isPouring || isPourGestureActive" class="water-splash"><i></i><i></i><i></i><i></i></div>
      <div v-if="isPouring || isPourGestureActive" class="tea-ripple tea-ripple-one"></div>
      <div v-if="isPouring || isPourGestureActive" class="tea-ripple tea-ripple-two"></div>
      <p v-if="canGesturePour && !isPourGestureActive" class="pour-hint">向右拖动壶嘴注水</p>
    </div>

    <!-- 浸泡时茶叶缓慢舒展，让等待本身成为体验的一部分 -->
    <div v-if="phase === BrewPhase.STEEPING" class="tea-leaves" aria-hidden="true">
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
      v-if="phase === BrewPhase.STEEPING || phase === BrewPhase.DONE"
      class="absolute -right-8 bottom-4 w-20 h-24 bg-white/80 rounded-lg shadow-sm flex flex-col items-center justify-center p-2"
    >
      <div class="w-12 h-12 rounded-full mb-1 transition-colors duration-500"
        :style="{ backgroundColor: soupColor }"></div>
      <p class="text-xs text-[var(--color-wood-light)]">茶汤</p>
    </div>

    <!-- 醒茶提示 -->
    <div
      v-if="phase === BrewPhase.RINSING"
      class="absolute -left-8 bottom-4 w-20 text-center"
    >
      <p class="text-xs text-[var(--color-wood-light)]">醒茶倒计时</p>
      <p class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ rinseCountdown }}</p>
    </div>
  </div>
</template>
