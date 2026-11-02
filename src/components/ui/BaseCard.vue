<script setup lang="ts">
/**
 * 卡片 — 毛玻璃容器（DESIGN_SPEC §五 GlassPanel）：glass-panel + 圆角 xl + 柔和阴影。
 *
 * 插槽：header / default / footer，均可省略。
 * 禁止卡片套卡片、玻璃拟态装饰（禁令速查）；阴影用 Tailwind 的 soft 档（shadow-sm/lg），
 * 禁零偏移彩色光晕。
 */
withDefaults(
  defineProps<{
    /** 内边距档位；none 用于图片 / 图表贴边场景 */
    padding?: 'none' | 'sm' | 'md' | 'lg'
    /** 悬停抬升（列表里可点的卡片用） */
    hoverable?: boolean
  }>(),
  { padding: 'md', hoverable: false },
)

const PADDINGS = { none: 'p-0', sm: 'p-3', md: 'p-5', lg: 'p-8' } as const
</script>

<template>
  <section
    class="glass-panel rounded-xl shadow-sm"
    :class="[
      PADDINGS[padding],
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
