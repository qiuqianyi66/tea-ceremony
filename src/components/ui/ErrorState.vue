<script setup lang="ts">
/**
 * 错误态 — 说清问题 + 恢复方式
 * 用于接口失败、加载出错等场景
 */
defineProps<{
  title?: string
  message?: string
}>()

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl" aria-hidden="true">
      ⚠️
    </div>
    <h3 class="text-lg font-serif text-[var(--color-wood)]">{{ title ?? '出了点问题' }}</h3>
    <p v-if="message" class="mt-2 max-w-sm text-sm text-[var(--color-wood-light)]">{{ message }}</p>
    <button
      type="button"
      class="mt-5 rounded-lg bg-[var(--color-wood)] px-5 py-2 text-sm text-[var(--color-cream)] transition-colors hover:bg-[var(--color-wood-light)]"
      @click="emit('retry')"
    >
      重试
    </button>
  </div>
</template>
