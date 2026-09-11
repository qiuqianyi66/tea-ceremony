<script setup lang="ts">
/**
 * 全局 toast 容器 — 渲染 uiStore.toasts（自动消失由 store 控制）
 * 挂在 App 根部，Teleport 到 body，避免被页面定位/层级影响
 */
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col items-end gap-2"
      role="status"
      aria-live="polite"
    >
      <TransitionGroup name="toast">
        <div
          v-for="t in ui.toasts"
          :key="t.id"
          class="pointer-events-auto rounded-xl border px-4 py-2.5 text-sm leading-snug shadow-lg backdrop-blur-sm"
          :class="[
            'border-[var(--color-tea-gold)]/40 bg-[#1a120a]/92 text-[#f5f1e6]',
            t.type === 'success' && 'border-[#aed581]/50',
            t.type === 'error' && 'border-[#ef5350]/55',
          ]"
        >
          {{ t.message }}
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
