<script setup lang="ts">
/**
 * 标签页 — 受控组件（v-model:active），只渲染标签条，面板由父组件按 active 渲染。
 *
 * 键盘：← / → 循环切换并聚焦，Home / End 跳首尾；触控热区 min-h-11（≥44px）。
 * 面板 id 通过作用域插槽给出，父组件绑上即完成 tab ↔ panel 关联：
 *   <Tabs v-model:active="tab" :tabs="tabs" v-slot="{ panelId }">
 *     <div :id="panelId(tab)" role="tabpanel">{{ ... }}</div>
 *   </Tabs>
 */
import { ref, useId } from 'vue'

interface TabItem {
  key: string
  label: string
  /** 全局注册图标名（如 "IconLeaf"） */
  icon?: string
}

const props = defineProps<{ tabs: TabItem[]; active: string }>()

const emit = defineEmits<{ 'update:active': [key: string]; change: [key: string] }>()

const baseId = useId()
const bar = ref<HTMLElement | null>(null)

function panelId(key: string) {
  return `${baseId}-panel-${key}`
}

function select(key: string) {
  if (key === props.active) return
  emit('update:active', key)
  emit('change', key)
}

function onKeydown(event: KeyboardEvent, index: number) {
  const { length } = props.tabs
  if (length === 0) return

  let next = -1
  if (event.key === 'ArrowRight') next = (index + 1) % length
  else if (event.key === 'ArrowLeft') next = (index - 1 + length) % length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = length - 1
  if (next < 0) return

  event.preventDefault()
  const target = props.tabs[next]
  if (!target) return
  select(target.key)
  bar.value?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
}
</script>

<template>
  <div>
    <div
      ref="bar"
      role="tablist"
      class="flex items-center gap-1 overflow-x-auto border-b border-[var(--color-wood-light)]/20"
    >
      <button
        v-for="(tab, index) in tabs"
        :id="`${baseId}-tab-${tab.key}`"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="tab.key === active"
        :aria-controls="panelId(tab.key)"
        :tabindex="tab.key === active ? 0 : -1"
        class="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 text-sm transition-colors duration-150"
        :class="
          tab.key === active
            ? 'border-[var(--color-tea-gold)] font-medium text-[var(--color-wood)]'
            : 'border-transparent text-[var(--color-wood-light)] hover:text-[var(--color-wood)]'
        "
        @click="select(tab.key)"
        @keydown="onKeydown($event, index)"
      >
        <component :is="tab.icon" v-if="tab.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
        {{ tab.label }}
      </button>
    </div>
    <slot :panel-id="panelId" />
  </div>
</template>
