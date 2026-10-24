<script setup lang="ts">
/**
 * 胶囊小按钮：页头动作区 / 面板内重试等次级操作（四处逐字 class 串的收敛）。
 */
defineProps<{ disabled?: boolean }>()
</script>

<template>
  <button
    :disabled="disabled"
    class="inline-flex min-h-11 items-center rounded-full border border-[var(--color-wood-light)]/30 px-3 text-xs text-[var(--color-wood-light)] hover:bg-white/60 disabled:opacity-50"
  >
    <slot />
  </button>
</template>
