<script setup lang="ts">
import { computed } from 'vue'

/**
 * 基础按钮 — 木色主按钮 / 茶汤金次按钮 / 幽灵按钮
 * 五态齐全：default / hover / active / disabled / loading
 */
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  type: 'button',
})

const classes = computed(() => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-tea-gold)] disabled:cursor-not-allowed disabled:opacity-50'

  const variantMap = {
    primary: 'bg-[var(--color-wood)] text-[var(--color-cream)] hover:bg-[var(--color-wood-light)]',
    secondary: 'border border-[var(--color-tea-gold)] text-[var(--color-wood)] hover:bg-white/70',
    ghost: 'text-[var(--color-wood-light)] hover:bg-white/50 hover:text-[var(--color-wood)]',
  } as const

  const sizeMap = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  } as const

  return [base, variantMap[props.variant], sizeMap[props.size]]
})
</script>

<template>
  <button
    :type="type"
    :class="classes"
    :disabled="disabled || loading"
  >
    <span
      v-if="loading"
      class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
