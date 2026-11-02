<script setup lang="ts">
/**
 * 基础按钮 — 五种形态 × 三档尺寸，收敛全站动作按钮。
 *
 * 设计基线（DESIGN_SPEC §三/§五）：按钮圆角 md；主按钮木色底 + 宣纸白字；
 * 次按钮茶汤金描边 + 透明底；图标按钮毛玻璃圆角。全部档位 min-h-11（触控 ≥44px）。
 * icon 传全局注册名（src/plugins/icons.ts，如 "IconPlus"），禁 emoji。
 * 五态：hover（各形态自带动效）/ disabled（半透明 + 禁点）/ loading（旋转环）/
 *      error（invalid → 朱砂红环 + aria-invalid）/ empty（纯图标形态 min-w-11）。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 形态：主 / 次 / 幽灵 / 图标 / 危险 */
    variant?: 'primary' | 'secondary' | 'ghost' | 'icon' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    /** 加载中：显示旋转环并阻止点击 */
    loading?: boolean
    /** 校验失败态：朱砂红环 + aria-invalid */
    invalid?: boolean
    /** 撑满父容器宽度 */
    block?: boolean
    /** 全局注册图标名（如 "IconPlus"） */
    icon?: string
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
    loading: false,
    invalid: false,
    block: false,
  },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const VARIANTS = {
  primary: 'bg-[var(--color-wood)] text-[var(--color-cream)] hover:bg-[var(--color-ink)]',
  secondary:
    'border border-[var(--color-tea-gold)] bg-transparent text-[var(--color-tea-gold)] hover:bg-[var(--color-tea-gold)]/10',
  ghost:
    'bg-transparent text-[var(--color-wood-light)] hover:bg-white/60 hover:text-[var(--color-wood)]',
  icon: 'glass-panel rounded-md text-[var(--color-wood)] hover:bg-white/70',
  danger: 'bg-[var(--color-cinnabar)] text-[var(--color-cream)] hover:opacity-90',
} as const

const SIZES = {
  sm: 'gap-1.5 px-3 text-xs',
  md: 'gap-2 px-4 text-sm',
  lg: 'gap-2 px-6 text-base',
} as const

const ICON_SIZES = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6' } as const

/** disabled 与 loading 都不可点：合并成一个状态，避免模板里重复判断 */
const inert = computed(() => props.disabled || props.loading)

function onClick(event: MouseEvent) {
  if (inert.value) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    :type="type"
    :disabled="inert"
    :aria-busy="loading || undefined"
    :aria-invalid="invalid || undefined"
    :class="[
      'inline-flex min-h-11 items-center justify-center rounded-md font-medium transition-colors duration-150',
      variant === 'icon' ? 'min-w-11' : '',
      SIZES[size],
      VARIANTS[variant],
      block ? 'w-full' : '',
      inert ? 'cursor-not-allowed opacity-50' : '',
      invalid ? 'ring-2 ring-[var(--color-cinnabar)]' : '',
    ]"
    @click="onClick"
  >
    <span
      v-if="loading"
      class="animate-spin rounded-full border-2 border-current border-t-transparent"
      :class="ICON_SIZES[size]"
      aria-hidden="true"
    />
    <component :is="icon" v-else-if="icon" :class="ICON_SIZES[size]" aria-hidden="true" />
    <slot />
  </button>
</template>
