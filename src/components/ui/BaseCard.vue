<script setup lang="ts">
/**
 * 卡片 — 毛玻璃容器（DESIGN_SPEC §五 GlassPanel）：glass-panel + 圆角 xl。
 *
 * 收敛全站逐字重复的面板类串（原 `glass-panel rounded-xl p-4` 手写 21 处）。
 * 插槽：header / default / footer，均可省略。禁止卡片套卡片、玻璃拟态装饰。
 *
 * padding：none / sm(p-3) / md(p-4) / lg(p-8)；md 与历史手写档一致，替换时不改观感。
 * flat：去掉柔和阴影。历史面板本无阴影，替换时传 flat 保持视觉不变；新代码默认带阴影。
 */
withDefaults(
  defineProps<{
    padding?: 'none' | 'sm' | 'md' | 'lg'
    /** 悬停抬升（列表里可点的卡片用） */
    hoverable?: boolean
    /** 无阴影（对齐历史面板观感） */
    flat?: boolean
  }>(),
  { padding: 'md', hoverable: false, flat: false },
)

const PADDINGS = { none: 'p-0', sm: 'p-3', md: 'p-4', lg: 'p-8' } as const
</script>

<template>
  <section
    class="glass-panel rounded-xl"
    :class="[
      PADDINGS[padding],
      flat ? '' : 'shadow-sm',
      hoverable ? 'transition-shadow duration-300 hover:shadow-lg' : '',
    ]"
  >
    <header v-if="$slots.header" class="mb-3 flex items-center justify-between gap-2">
      <slot name="header" />
    </header>
    <slot />
    <footer v-if="$slots.footer" class="mt-4 flex items-center justify-end gap-2">
      <slot name="footer" />
    </footer>
  </section>
</template>
