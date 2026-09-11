<script setup lang="ts">
/**
 * 品鉴第一步：观色（茶汤色展示 + 正常范围对比）
 */
defineProps<{
  soupColor: string
  soupMin?: string
  soupMax?: string
}>()
const emit = defineEmits<{ next: [] }>()
</script>

<template>
  <div class="flex flex-col items-center">
    <div class="w-48 h-48 rounded-2xl shadow-lg mb-6 transition-colors duration-500 relative"
      :style="{ backgroundColor: soupColor }">
      <IconSteam class="absolute top-4 right-4 w-8 h-8 text-white/60 animate-bounce" />
    </div>
    <div class="flex items-center gap-2 mb-2">
      <span class="text-sm text-[var(--color-wood)]">你的茶汤</span>
      <span class="w-8 h-8 rounded-full shadow-inner" :style="{ backgroundColor: soupColor }"></span>
      <template v-if="soupMin && soupMax">
        <span class="text-xs text-[var(--color-wood-light)] ml-2">正常范围</span>
        <span class="w-5 h-5 rounded-full" :style="{ backgroundColor: soupMin }"></span>
        <span class="text-[var(--color-wood-light)] text-xs">至</span>
        <span class="w-5 h-5 rounded-full" :style="{ backgroundColor: soupMax }"></span>
      </template>
    </div>
    <button @click="emit('next')"
      class="px-8 py-3 bg-[var(--color-wood)] text-[var(--color-cream)] rounded-lg hover:bg-[var(--color-wood-light)] transition-colors flex items-center gap-2">
      <IconChevronRight class="w-5 h-5" />
      观色完成，继续闻香
    </button>
  </div>
</template>
