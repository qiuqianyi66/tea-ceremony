<script setup lang="ts">
import { RouterView } from 'vue-router'
import PwaUpdateToast from '@/components/PwaUpdateToast.vue'
import { ToastContainer } from '@/components/ui'
</script>

<template>
  <div class="min-h-[100dvh] bg-[var(--color-cream)]">
    <RouterView v-slot="{ Component, route }">
      <Transition :name="route.meta.instant ? 'page-instant' : 'page'">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>
    <ToastContainer />
    <PwaUpdateToast />
  </div>
</template>

<style>
.page-enter-active, .page-leave-active { transition: opacity .32s ease, transform .32s ease; }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; transform: translateY(-5px); }
/* 重负载页（冲泡页）不做淡入：淡入期间主线程被着色器编译占住，会卡在近全透明 */
.page-instant-enter-active, .page-instant-leave-active { transition: none; }
@media (prefers-reduced-motion: reduce) {
  .page-enter-active, .page-leave-active { transition: none; }
}
</style>
