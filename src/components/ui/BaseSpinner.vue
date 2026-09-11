<script setup lang="ts">
/**
 * 基础加载指示器 — 茶汤金旋转环
 */
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  label?: string
}>(), {
  size: 'md',
  label: '加载中',
})
</script>

<template>
  <div class="inline-flex items-center gap-2" role="status" :aria-label="label">
    <span
      class="animate-spin rounded-full border-2 border-[var(--color-tea-gold)] border-t-transparent"
      :class="{
        'h-3 w-3': size === 'sm',
        'h-5 w-5': size === 'md',
        'h-8 w-8': size === 'lg',
      }"
    />
    <span v-if="label" class="text-xs text-[var(--color-wood-light)]">{{ label }}</span>
  </div>
</template>
