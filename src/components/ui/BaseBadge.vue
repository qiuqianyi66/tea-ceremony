<script setup lang="ts">
/**
 * 徽标 — 状态 / 分类的小标签，印章圆角（DESIGN_SPEC §三：印章 sm）。
 *
 * 非交互元素，不承担触控热区；需要可点击请用 Button variant="ghost"。
 * 颜色只走设计令牌，四档语义色：茶金（强调）/ 朱砂（警示）/ 竹青（生长）/ 中性（默认）。
 */
withDefaults(
  defineProps<{
    /** 语义色：茶金 / 朱砂 / 竹青 / 中性 */
    tone?: 'gold' | 'cinnabar' | 'bamboo' | 'neutral'
    /** 全局注册图标名（如 "IconLeaf"） */
    icon?: string
  }>(),
  { tone: 'neutral' },
)

const TONES = {
  gold: 'bg-[var(--color-tea-gold)]/12 text-[var(--color-wood)]',
  cinnabar: 'bg-[var(--color-cinnabar)]/12 text-[var(--color-cinnabar)]',
  bamboo: 'bg-[var(--color-bamboo)]/12 text-[var(--color-bamboo)]',
  neutral: 'bg-[var(--color-paper)] text-[var(--color-wood-light)]',
} as const
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs leading-relaxed whitespace-nowrap"
    :class="TONES[tone]"
  >
    <component :is="icon" v-if="icon" class="h-3 w-3 shrink-0" aria-hidden="true" />
    <slot />
  </span>
</template>
