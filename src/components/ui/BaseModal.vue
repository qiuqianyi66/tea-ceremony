<script setup lang="ts">
/**
 * 模态框 — Teleport 到 body，ESC / 遮罩点击关闭，焦点打开时移入、关闭时归还。
 *
 * 设计基线：圆角 xl（卡片档）+ 宣纸底 + 柔和阴影，遮罩用墨色半透明。
 * 可访问性：role="dialog" + aria-modal + aria-labelledby（有 title 时）；
 * 打开期间锁定 body 滚动，关闭时恢复。
 */
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 受控开关 */
    open: boolean
    title?: string
    width?: 'sm' | 'md' | 'lg'
    /** 点遮罩关闭，默认 true */
    closeOnOverlay?: boolean
    /** ESC 关闭，默认 true */
    closeOnEsc?: boolean
  }>(),
  { width: 'md', closeOnOverlay: true, closeOnEsc: true },
)

const emit = defineEmits<{ close: [] }>()

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' } as const

const panel = ref<HTMLElement | null>(null)
const titleId = useId()
/** 打开前的焦点元素，关闭时归还（键盘用户不丢位置） */
let restoreFocus: HTMLElement | null = null

function close() {
  emit('close')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !props.closeOnEsc) return
  event.stopPropagation()
  close()
}

function lockScroll(locked: boolean) {
  if (typeof document === 'undefined') return
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(
  () => props.open,
  async (open) => {
    if (typeof window === 'undefined') return
    if (open) {
      const active = document.activeElement
      restoreFocus = active instanceof HTMLElement ? active : null
      lockScroll(true)
      window.addEventListener('keydown', onKeydown)
      await nextTick()
      panel.value?.focus()
      return
    }
    lockScroll(false)
    window.removeEventListener('keydown', onKeydown)
    restoreFocus?.focus()
    restoreFocus = null
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onKeydown)
  lockScroll(false)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--color-ink)]/40 p-4"
      @click.self="closeOnOverlay && close()"
    >
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? titleId : undefined"
        tabindex="-1"
        class="w-full rounded-xl border border-[var(--color-wood-light)]/25 bg-[var(--color-cream)] shadow-lg"
        :class="WIDTHS[width]"
      >
        <header class="flex items-center gap-3 px-5 pt-4">
          <h2 v-if="title" :id="titleId" class="text-lg font-bold text-[var(--color-wood)]">
            {{ title }}
          </h2>
          <button
            type="button"
            class="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-[var(--color-wood-light)] transition-colors duration-150 hover:bg-white/60 hover:text-[var(--color-wood)]"
            aria-label="关闭"
            @click="close"
          >
            <IconX class="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div class="px-5 py-4">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="flex items-center justify-end gap-2 px-5 pb-4">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
