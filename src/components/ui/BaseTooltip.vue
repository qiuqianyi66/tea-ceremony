<script setup lang="ts">
/**
 * 提示气泡 — hover / focus 触发的补充说明。
 *
 * 可访问性：气泡用 role="tooltip" + 唯一 id；键盘 Tab 聚焦触发元素即显示。
 * 触发元素本身必须有可读名称（aria-label 或可见文字），气泡不承载唯一信息。
 * 需要读屏播报时用作用域插槽把 id 绑到可聚焦元素上：
 *   <Tooltip text="说明" v-slot="{ describedby }"><button :aria-describedby="describedby" /></Tooltip>
 */
import { useId } from 'vue'

withDefaults(
  defineProps<{
    /** 提示文案 */
    text: string
    position?: 'top' | 'bottom' | 'left' | 'right'
    /** 禁用时只渲染触发元素，不渲染气泡 */
    disabled?: boolean
  }>(),
  { position: 'top', disabled: false },
)

const id = useId()

const POSITIONS = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
} as const
</script>

<template>
  <span class="group relative inline-flex">
    <slot :describedby="disabled ? undefined : id" />
    <span
      v-if="!disabled"
      :id="id"
      role="tooltip"
      class="pointer-events-none absolute z-50 w-max max-w-[16rem] rounded-md bg-[var(--color-ink)] px-2.5 py-1.5 text-xs leading-snug text-[var(--color-cream)] opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      :class="POSITIONS[position]"
    >
      {{ text }}
    </span>
  </span>
</template>
