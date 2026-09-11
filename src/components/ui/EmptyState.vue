<script setup lang="ts">
/**
 * 空态 — 标题 + 描述 + CTA 按钮位
 * 用于列表无数据、未登录、首次使用等场景
 */
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/60 text-3xl" aria-hidden="true">
      🍃
    </div>
    <h3 class="text-lg font-serif text-[var(--color-wood)]">{{ title }}</h3>
    <p v-if="description" class="mt-2 max-w-sm text-sm text-[var(--color-wood-light)]">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
