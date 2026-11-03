<script setup lang="ts">
/**
 * 分区标题：可选图标 + 标题文字。
 *
 * 收敛全站逐字重复的分区标题（原 `text-base font-bold text-[var(--color-wood)] mb-3`
 * 手写 10 处、`text-lg` 手写 6 处）。字号与标题层级各保持原样，不做视觉/语义统一：
 *   size="lg"（默认）→ text-lg，一级分区
 *   size="base"      → text-base，卡片内小分区
 *   level（默认 2）  → 渲染 h2/h3；被替换处原本是 h3 的必须显式传 :level="3"，
 *                      否则标题层级会跳级（PageHeader 已占 h2）
 *
 * icon 传全局注册名（plugins/icons.ts，如 "IconScrollText"），省略则不渲染图标。
 * iconSize 控制图标尺寸，默认跟随 size（lg→20px、base→16px）：
 *   "inherit" 不写尺寸类，让图标随字号（lucide 默认 24px）——原手写处若没写 w-N 就用它，
 *             否则会被强制成 16px，图标相对变小（ToolSelect 4 处即此情况）。
 */
const props = withDefaults(
  defineProps<{
    icon?: string
    size?: 'base' | 'lg'
    level?: 2 | 3
    iconSize?: 'sm' | 'md' | 'inherit'
  }>(),
  { size: 'lg', level: 2 },
)

const ICON_CLASSES = {
  sm: 'inline-block -mt-1 w-4 h-4',
  md: 'inline-block -mt-1 w-5 h-5',
  inherit: 'inline-block -mt-1',
} as const

const iconClass = `${ICON_CLASSES[props.iconSize ?? (props.size === 'lg' ? 'md' : 'sm')]}`
</script>

<template>
  <component
    :is="`h${level}`"
    class="mb-3 font-bold text-[var(--color-wood)]"
    :class="size === 'lg' ? 'text-lg' : 'text-base'"
  >
    <component :is="icon" v-if="icon" :class="iconClass" aria-hidden="true" />
    <slot />
  </component>
</template>
