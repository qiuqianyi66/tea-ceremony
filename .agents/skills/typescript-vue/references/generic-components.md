# Generic Components

## Basic generic component

```vue
<!-- BaseSelect.vue -->
<script setup lang="ts" generic="T">
interface Props {
  options: T[]
  modelValue: T | null
  optionLabel: (option: T) => string
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <select @change="emit('update:modelValue', options[($event.target as HTMLSelectElement).selectedIndex])">
    <option v-for="option in options" :key="optionLabel(option)">
      {{ optionLabel(option) }}
    </option>
  </select>
</template>
```

```vue
<!-- Usage — T inferred as Country -->
<BaseSelect
  :options="countries"
  :model-value="selectedCountry"
  :option-label="(c) => c.name"
  @update:model-value="(c) => (selectedCountry = c)"
/>
```

## Constrained generics

```vue
<script setup lang="ts" generic="T extends { id: string | number; label: string }">
interface Props {
  items: T[]
}
defineProps<Props>()
</script>

<template>
  <ul>
    <li v-for="item in items" :key="item.id">{{ item.label }}</li>
  </ul>
</template>
```

Constrain `T` (`extends { id, label }`) whenever the template or script accesses specific properties — an unconstrained `T` only supports fully generic operations (rendering via slots, passing the whole item through).

## Multiple type parameters

```vue
<script setup lang="ts" generic="TItem, TKey extends keyof TItem">
interface Props {
  items: TItem[]
  keyField: TKey
}
defineProps<Props>()
</script>
```

```vue
<DataList :items="users" key-field="id" />
```

## Generic components with slots

```vue
<script setup lang="ts" generic="T">
defineProps<{ items: T[] }>()
defineSlots<{
  default(props: { item: T; index: number }): unknown
}>()
</script>

<template>
  <div v-for="(item, index) in items" :key="index">
    <slot :item="item" :index="index" />
  </div>
</template>
```

```vue
<GenericGrid :items="products">
  <template #default="{ item }">
    <!-- `item` is typed as Product here, inferred from the usage -->
    <ProductCard :product="item" />
  </template>
</GenericGrid>
```

Combining `generic="T"` with `defineSlots` is what makes scoped-slot content fully typed for the consumer — without it, slot props fall back to `any`.

## Importing types used only in the `generic` attribute

```vue
<script setup lang="ts" generic="T extends BaseEntity">
import type { BaseEntity } from '@/types'

defineProps<{ items: T[] }>()
</script>
```

The `generic` attribute string is evaluated in the same scope as the rest of `<script setup>` — a type used only in the constraint still needs a normal `import type`.

## When NOT to use generics

- If the component only ever handles one concrete shape in practice, a plain typed prop is simpler and equally safe.
- If the "generic" behavior is really a union of 2–3 known variants, a discriminated union prop is often clearer than a type parameter.
