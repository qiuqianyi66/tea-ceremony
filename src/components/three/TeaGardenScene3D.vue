<script setup lang="ts">
/**
 * TeaGardenScene3D — 3D茶园场景容器（TresCanvas）
 * 真实感3D茶山：HDRI环境 + 程序化梯田地形 + 太阳光阴影 + 雾效 + 程序化茶树
 */
import { ref } from 'vue'
import { TresCanvas } from '@tresjs/core'
import TeaGardenSceneInner from './TeaGardenSceneInner.vue'
import type { PlantedTea } from '@/types/garden'
import type { WeatherMode } from './garden-weather'

defineProps<{
  plants: PlantedTea[]
}>()

const emit = defineEmits<{
  'select-plant': [id: number]
}>()

/** 子场景实例（用于调用浇水粒子动画等视觉反馈） */
const innerRef = ref<{ playWater?: (id: number) => void; setWeather?: (m: WeatherMode) => void; setAudioEnabled?: (on: boolean) => void }>()

function onSelectPlant(id: number): void {
  emit('select-plant', id)
}

/** 播放某棵茶树的浇水动画（纯视觉，不触碰状态机） */
function playWater(plantId: number): void {
  innerRef.value?.playWater?.(plantId)
}

/** 切换天气（晴天/雨天） */
function setWeather(mode: WeatherMode): void {
  innerRef.value?.setWeather?.(mode)
}

/** 环境音效开关 */
function setAudioEnabled(on: boolean): void {
  innerRef.value?.setAudioEnabled?.(on)
}

defineExpose({ playWater, setWeather, setAudioEnabled })
</script>

<template>
  <div class="tea-garden-3d">
    <TresCanvas
      :clear-color="'#2a3328'"
      :antialias="true"
      :alpha="false"
      :shadows="true"
      :window-size="true"
    >
      <TeaGardenSceneInner ref="innerRef" :plants="plants" @select-plant="onSelectPlant" />
    </TresCanvas>
  </div>
</template>

<style scoped>
.tea-garden-3d {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.tea-garden-3d :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>
