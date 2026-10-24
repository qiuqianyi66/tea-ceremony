<script setup lang="ts">
/**
 * 分区标题：图标 + 标题（TeaDetailView 六处逐字重复模式的收敛）。
 * 图标统一 inline-block -mt-1 w-5 h-5，标题统一 mb-3 text-lg font-bold。
 * icon 传全局注册名（plugins/icons.ts，如 "IconScrollText"）。
 */
defineProps<{ icon: string }>()
</script>

<template>
  <h2 class="mb-3 text-lg font-bold text-[var(--color-wood)]">
    <component :is="icon" class="inline-block -mt-1 w-5 h-5" />
    <slot />
  </h2>
</template>
