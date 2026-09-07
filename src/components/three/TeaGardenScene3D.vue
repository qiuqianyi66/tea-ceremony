<script setup lang="ts">
/**
 * TeaGardenScene3D — 3D茶园场景容器（TresCanvas）
 * 真实感3D茶山：HDRI环境 + 程序化梯田地形 + 太阳光阴影 + 雾效 + 程序化茶树
 */
import { TresCanvas } from '@tresjs/core'
import TeaGardenSceneInner from './TeaGardenSceneInner.vue'
import type { PlantedTea } from '@/types/garden'

defineProps<{
  plants: PlantedTea[]
}>()

const emit = defineEmits<{
  'select-plant': [id: number]
}>()

function onSelectPlant(id: number): void {
  emit('select-plant', id)
}
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
      <TeaGardenSceneInner :plants="plants" @select-plant="onSelectPlant" />
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
