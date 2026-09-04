<script setup lang="ts">
/**
 * TeaBrewScene3D — 冲泡页 3D 真实感茶席背景（TresJS 容器）
 *
 * 视觉风格：夜色暖光·炭火煮茶。仅负责 TresCanvas 容器与 props 透传，
 * 场景内容与动画逻辑在 TeaBrewSceneInner（TresCanvas 内子组件，须在其中调用 useLoop）。
 *
 * 性能自适应：headless 环境（CI/E2E 无 GPU、SwiftShader 软渲染）下用 on-demand
 * 静态渲染模式，避免逐帧动画阻塞主线程拖垮业务流程；真实浏览器保持 always 动画。
 */
import { computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { BrewPhase } from '@/types/brewing'
import TeaBrewSceneInner from './TeaBrewSceneInner.vue'

const isHeadless = computed(() => typeof navigator !== 'undefined' && /HeadlessChrome/i.test(navigator.userAgent))

defineProps<{
  phase: BrewPhase
  soupColor: string
  currentTemp: number
  targetTemp: number
  isPouringOut: boolean
  infusion: number
}>()
</script>

<template>
  <div class="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
    <TresCanvas
      :clear-color="'#1c1612'"
      :antialias="true"
      :alpha="false"
      :render-mode="isHeadless ? 'on-demand' : 'always'"
    >
      <TeaBrewSceneInner
        :phase="phase"
        :soup-color="soupColor"
        :current-temp="currentTemp"
        :target-temp="targetTemp"
        :is-pouring-out="isPouringOut"
        :infusion="infusion"
      />
    </TresCanvas>
  </div>
</template>
