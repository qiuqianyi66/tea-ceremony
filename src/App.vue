<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-[var(--color-cream)]">
    <RouterView v-slot="{ Component, route }">
      <Transition name="page">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>
  </div>
</template>

<style>
.page-enter-active, .page-leave-active { transition: opacity .32s ease, transform .32s ease; }
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to { opacity: 0; transform: translateY(-5px); }
@media (prefers-reduced-motion: reduce) {
  .page-enter-active, .page-leave-active { transition: none; }
}
</style>
