<script setup lang="ts">
import { computed } from 'vue'
import { getSoupColor } from '@/data/teas'
import type { Tea } from '@/types/tea'

const props = defineProps<{
  tea: Tea | null
  steepTime: number
  size?: number
}>()

const soupColor = computed(() => {
  if (!props.tea) return '#F5F0E8'
  return getSoupColor(props.tea, props.steepTime)
})

const sizePx = computed(() => `${props.size ?? 48}px`)
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <!-- 茶杯 -->
    <div
      class="rounded-full border-2 transition-colors duration-500 flex items-center justify-center"
      :class="steepTime > 0 ? 'border-[var(--color-tea-gold)]' : 'border-[var(--color-paper)]'"
      :style="{ width: sizePx, height: sizePx, backgroundColor: soupColor }"
    >
      <!-- 茶汤高光 -->
      <div
        v-if="steepTime > 0"
        class="w-1/3 h-1/4 rounded-full bg-white/20"
        style="align-self: flex-start; margin-top: 8%"
      ></div>
    </div>
    <!-- 标签 -->
    <p v-if="tea" class="text-xs text-[var(--color-wood-light)]">{{ tea.name }}</p>
    <p v-if="steepTime > 0" class="text-[10px] text-[var(--color-tea-gold)]">{{ soupColor }}</p>
  </div>
</template>
