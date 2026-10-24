<script setup lang="ts">
/**
 * 页面标题行：标题（可选图标 / 副标题）+ 右侧动作区（含统一的返回按钮）。
 *
 * 收敛六个视图（Map / Graph / Profile / History / Growth / Collection）的重复页头；
 * 返回按钮统一 min-h-11 min-w-11 触控热区（原 CollectionView / TeaGraph 缺失）。
 * icon 传全局注册名（plugins/icons.ts，如 "IconMap"）。
 */
import { useRouter } from 'vue-router'

withDefaults(
  defineProps<{
    title: string
    icon?: string
    subtitle?: string
    /** 返回按钮文案 */
    backLabel?: string
    /** 是否渲染返回按钮 */
    back?: boolean
    /** 紧凑下边距（mb-6）；默认 mb-8 */
    tight?: boolean
  }>(),
  { backLabel: '返回', back: true, tight: false },
)

const router = useRouter()
</script>

<template>
  <div class="flex items-center justify-between" :class="tight ? 'mb-6' : 'mb-8'">
    <div>
      <h2 class="text-3xl font-bold text-[var(--color-wood)]">
        <component :is="icon" v-if="icon" class="mr-2 inline-block -mt-1 w-7 h-7" />{{ title }}
      </h2>
      <p v-if="subtitle" class="mt-1 text-sm text-[var(--color-wood-light)]">{{ subtitle }}</p>
    </div>
    <div class="flex items-center gap-2">
      <slot name="actions" />
      <button
        v-if="back"
        class="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--color-wood-light)] hover:text-[var(--color-wood)]"
        @click="router.push('/')"
      >{{ backLabel }}</button>
    </div>
  </div>
</template>
