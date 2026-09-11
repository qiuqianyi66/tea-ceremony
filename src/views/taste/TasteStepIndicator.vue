<script setup lang="ts">
/**
 * 品鉴步骤指示器：观 → 闻 → 品 → 果
 */
defineProps<{ current: number }>()
const steps = ['观', '闻', '品', '果']
</script>

<template>
  <div class="flex gap-2 mb-8">
    <div v-for="(s, i) in steps" :key="s" class="flex items-center gap-2">
      <div
        class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all"
        :class="current === i
          ? 'bg-[var(--color-wood)] text-[var(--color-cream)]'
          : current > i
            ? 'bg-[var(--color-tea-gold)] text-white'
            : 'bg-[#E8E2D8] text-[#B5AC9C]'"
      >
        {{ s }}
      </div>
      <div v-if="i < steps.length - 1" class="w-6 h-0.5"
        :class="current > i ? 'bg-[var(--color-tea-gold)]' : 'bg-gray-200'"></div>
    </div>
  </div>
</template>
