<script setup lang="ts">
/**
 * 基础卡片 — 纸色底 + 茶汤金微边 + 柔圆角
 * 用于承载品鉴卡、列表项、设置块等
 */
withDefaults(defineProps<{
  padding?: 'none' | 'sm' | 'md' | 'lg'
  tone?: 'paper' | 'glass'
}>(), {
  padding: 'md',
  tone: 'paper',
})
</script>

<template>
  <article
    class="rounded-2xl shadow-sm transition-shadow"
    :class="{
      'bg-[var(--color-paper)] border border-[var(--color-tea-gold)]/20': tone === 'paper',
      'backdrop-blur-md bg-white/60': tone === 'glass',
      'p-0': padding === 'none',
      'p-3': padding === 'sm',
      'p-5': padding === 'md',
      'p-7': padding === 'lg',
    }"
  >
    <slot />
  </article>
</template>
