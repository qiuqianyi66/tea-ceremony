<script setup lang="ts">
import { BREW_SKIN_LIST, type BrewSkinId } from '@/components/three/brewSkins'

/**
 * 环境皮肤切换（从 BrewView.vue 拆出，2026-10-22 B8）：
 * 右上角极小文字按钮，验证三套氛围用。纯受控组件。
 */
defineProps<{ modelValue: BrewSkinId }>()
const emit = defineEmits<{ 'update:modelValue': [value: BrewSkinId] }>()
</script>

<template>
  <div class="fixed top-3 right-3 z-40 flex gap-2 text-xs">
    <button
      v-for="s in BREW_SKIN_LIST"
      :key="s.id"
      type="button"
      @click="emit('update:modelValue', s.id)"
      class="min-w-[44px] min-h-[44px] px-3 flex items-center justify-center rounded-full transition-all"
      :class="modelValue === s.id
        ? 'bg-[var(--color-tea-gold)]/80 text-[var(--color-cream-dark)]'
        : 'text-[var(--color-wood-light)]/70 hover:text-[var(--color-wood)]'"
    >
      {{ s.label }}
    </button>
  </div>
</template>
