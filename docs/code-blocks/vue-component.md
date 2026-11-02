---
last_updated: 2026-11-02
status: active
owner: yanha
---

# Vue 组件骨架

解决新建 `.vue` 时反复重想 `script setup` 结构、props 默认值、设计令牌类名的问题。

## 1. 最小骨架

`<script setup lang="ts">` 写在最前，不写 `<style>` 块，样式全部走 Tailwind 工具类。

```vue
<script setup lang="ts">
/**
 * 茶器卡片：展示单件茶器的名称与一句说明。
 */
withDefaults(
  defineProps<{
    name: string
    note?: string
    disabled?: boolean
  }>(),
  {
    note: '',
    disabled: false,
  },
)
</script>

<template>
  <article
    class="rounded-xl border border-[var(--color-wood-light)]/25 bg-[var(--color-paper)] p-4 shadow-md"
  >
    <h3 class="font-serif text-lg text-[var(--color-wood)]">{{ name }}</h3>
    <p class="mt-2 text-sm text-[var(--color-wood-light)]">{{ note }}</p>
  </article>
</template>
```

## 2. props / emits 写法

props 用 `defineProps<{...}>()`，可选 prop 全部给默认值。emits 用元组类型标注参数。

```vue
<script setup lang="ts">
/** 茶类筛选条：受控组件，选中值由父级持有。 */
withDefaults(
  defineProps<{
    modelValue: string
    options: readonly string[]
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

function select(value: string): void {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="option in options"
      :key="option"
      type="button"
      :disabled="disabled"
      :aria-pressed="option === modelValue"
      class="min-h-11 rounded-md px-3 text-sm transition-colors duration-150"
      :class="
        option === modelValue
          ? 'bg-[var(--color-wood)] text-[var(--color-cream)]'
          : 'border border-[var(--color-wood-light)]/30 text-[var(--color-wood)] hover:bg-white/60'
      "
      @click="select(option)"
    >
      {{ option }}
    </button>
  </div>
</template>
```

## 3. 五态齐全

五态是硬要求：hover / disabled / loading / error / empty，缺一不可。`disabled` 与 `loading` 合并成一个 `inert`，模板里只判断一次。

```vue
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    loading?: boolean
    invalid?: boolean
    label?: string
  }>(),
  { disabled: false, loading: false, invalid: false, label: '入席' },
)

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const inert = computed(() => props.disabled || props.loading)

function onClick(event: MouseEvent): void {
  if (inert.value) {
    event.preventDefault()
    return
  }
  emit('click', event)
}
</script>

<template>
  <button
    type="button"
    :disabled="inert"
    :aria-busy="loading || undefined"
    :aria-invalid="invalid || undefined"
    class="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--color-wood)] px-4 text-sm text-[var(--color-cream)] transition-colors duration-150 hover:bg-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
    :class="invalid ? 'ring-2 ring-[var(--color-cinnabar)]' : ''"
    @click="onClick"
  >
    <span v-if="loading" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
    <IconLeaf v-else class="h-4 w-4" aria-hidden="true" />    {{ label }}
  </button>
</template>
```

| 状态 | 表达方式 |
|------|---------|
| hover | `hover:bg-*` / `hover:opacity-90`，时长 `duration-150` |
| disabled | `disabled:opacity-50` + `disabled:cursor-not-allowed` + 真实 `disabled` 属性 |
| loading | 旋转环 `animate-spin` + `aria-busy`，同时禁点 |
| error | `ring-2 ring-[var(--color-cinnabar)]` + `aria-invalid`，文案说清问题与恢复方式 |
| empty | 图标 + 标题 + 一句描述 + 可选 CTA，居中留白 `py-12` |

## 4. 空态组件

列表无数据、未登录、首次使用都用同一结构。

```vue
<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/60" aria-hidden="true">
      <IconLeaf class="h-8 w-8 text-[var(--color-wood)]" />
    </div>
    <h3 class="font-serif text-lg text-[var(--color-wood)]">{{ title }}</h3>
    <p v-if="description" class="mt-2 max-w-sm text-sm text-[var(--color-wood-light)]">
      {{ description }}
    </p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
```

## 5. 设计令牌用法

颜色只用 CSS 变量，禁止裸色值（`bg-[#9E8050]` 这类）。令牌定义在 `src/assets/main.css` 的 `@theme`。

| 令牌 | 用途 | 写法 |
|------|------|------|
| `--color-cream` | 页面背景 | `bg-[var(--color-cream)]` |
| `--color-paper` | 卡片背景 | `bg-[var(--color-paper)]` |
| `--color-ink` | 正文 / 主按钮 hover | `text-[var(--color-ink)]` |
| `--color-wood` | 按钮底、标题 | `bg-[var(--color-wood)]` |
| `--color-wood-light` | 次要文字、边框 | `text-[var(--color-wood-light)]` |
| `--color-tea-gold` | 唯一强调色 | `border-[var(--color-tea-gold)]` |
| `--color-bamboo` | 自然相关 | `text-[var(--color-bamboo)]` |
| `--color-cinnabar` | 印章 / 成就 / 错误环 | `ring-[var(--color-cinnabar)]` |

圆角：卡片 `rounded-xl`、按钮 `rounded-md`、印章 `rounded-sm`。触控目标 `min-h-11`（≥44px）。阴影只用 `shadow-sm`/`shadow-md` 档。

## 6. 禁则清单

- 不写 `<style>` 块，不新增 CSS 文件。
- 不用 Options API，不用 `any`，组件 ≤200 行。
- 不用 Emoji 或 Unicode 符号当图标；图标只用全局注册的 `<IconXxx />`（`src/plugins/icons.ts`）。
- 不写裸色值；不写 `rounded-full` 按钮（图标钮除外）。
- 不加 `bounce` / `elastic` 动效，不做卡片套卡片、玻璃拟态装饰。
- 按钮文案写动作（「开始冲泡」），不写「提交」；错误不道歉。
- 不直接 `localStorage` / `fetch`，走 `src/services/`。
