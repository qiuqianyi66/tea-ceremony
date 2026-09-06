<script setup lang="ts">
/**
 * TeaGardenScene3D — 3D茶园场景容器（TresCanvas）
 * 真实感3D茶山：HDRI环境 + 程序化梯田地形 + 太阳光阴影 + 雾效
 */
import { computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import TeaGardenSceneInner from './TeaGardenSceneInner.vue'

const isHeadless = computed(() => {
  if (typeof navigator === 'undefined') return false
  return navigator.webdriver === true || /HeadlessChrome/i.test(navigator.userAgent)
})
</script>

<template>
  <div class="tea-garden-3d">
    <TresCanvas
      :clear-color="'#87a5c4'"
      :antialias="true"
      :alpha="false"
      :shadows="true"
      :render-mode="isHeadless ? 'on-demand' : 'always'"
      :window-size="true"
    >
      <TeaGardenSceneInner />
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
