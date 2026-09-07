# `<script setup lang="ts">` Typing Reference

## Props — type-based vs runtime form

```vue
<script setup lang="ts">
// preferred: type-based, full compiler support
interface Props {
  label: string
  disabled?: boolean
}
const props = defineProps<Props>()
</script>
```

```vue
<script setup lang="ts">
// avoid for TS projects: runtime form, weaker type inference for complex shapes
const props = defineProps({
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
})
</script>
```

The runtime form is required only for third-party validation logic that can't be expressed as a type (custom `validator` functions) — otherwise always prefer the type-based macro.

## `withDefaults` in full

```vue
<script setup lang="ts">
interface Props {
  title: string
  size?: 'sm' | 'md' | 'lg'
  tags?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  tags: () => [],   // factory function required for object/array defaults
})
</script>
```

Object/array default values must be provided as a factory function (`() => []`) — a bare `[]` would be shared by reference across every component instance.

## Do not destructure props (without `toRefs`)

```vue
<script setup lang="ts">
// loses reactivity — `count` is a snapshot, not a live binding
const { count } = defineProps<{ count: number }>()
</script>
```

```vue
<script setup lang="ts">
// correct: keep `props` object, or use toRef for a specific field
import { toRef } from 'vue'
const props = defineProps<{ count: number }>()
const count = toRef(props, 'count')
</script>
```

Vue 3.5+ has reactive props destructuring as a compiler feature — check the project's Vue version before relying on it; when unsure, keep `props.x` access explicit.

## Slots typing

```vue
<script setup lang="ts">
defineSlots<{
  default(props: { item: string }): unknown
  header?(props: {}): unknown
}>()
</script>

<template>
  <slot :item="currentItem" />
  <slot name="header" />
</template>
```

`defineSlots` documents each slot's expected scope-slot props — consumers get autocomplete on `<template #default="{ item }">`.

## Expose typing

```vue
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)

function reset() {
  count.value = 0
}

defineExpose({
  reset,
})
</script>
```

```ts
// parent
import { useTemplateRef } from 'vue'
const child = useTemplateRef<{ reset: () => void }>('child')
child.value?.reset()
```

Only exposed members are visible on the parent's template ref type — by default `<script setup>` components expose nothing to parents.

## Attrs typing

```vue
<script setup lang="ts">
import { useAttrs } from 'vue'

const attrs = useAttrs() as { id?: string; class?: string }
</script>
```

`useAttrs()` returns a loosely typed object by design (fallthrough attributes are inherently dynamic) — narrow with an inline cast only for the specific attrs actually read, and keep `inheritAttrs` behavior in mind.
