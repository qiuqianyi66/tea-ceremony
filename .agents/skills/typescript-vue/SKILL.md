---
name: typescript-vue
description: Use when typing Vue 3 <script setup lang="ts"> — defineProps/defineEmits/defineModel, generic components, template refs, InjectionKey, typed composables and Pinia stores. For composition patterns use vue-core; for TS fundamentals use typescript-core.
license: MIT
metadata:
  sources:
    - https://vuejs.org/guide/typescript/overview.html (Vue 3 TypeScript guide)
    - https://vuejs.org/guide/typescript/composition-api.html (Composition API with TypeScript)
  version: "1.0.0"
compatibility: Vue 3.4+ / TypeScript 5.x
---

# TypeScript + Vue — Typed `<script setup>` Patterns

> Every component is `<script setup lang="ts">`. Type props/emits at the macro call, never with a runtime-only object when a type-only form is available.

## Preferences

- Type-based `defineProps<T>()` / `defineEmits<T>()` over the runtime object form
- `withDefaults` for default prop values instead of destructuring defaults manually
- `InjectionKey<T>` for every `provide`/`inject` pair — never a bare string key
- Explicit return-type interfaces for composables that return more than 2–3 values
- `ComponentPublicInstance`/component type imports for typed template refs, never `any`

## Core Principles

- **Props are a contract:** a consumer should get a compile error the moment they pass the wrong shape.
- **Composables are typed functions:** their return type is part of the API, annotate it explicitly once it's non-trivial.
- **Generics unlock reusable components:** a `<List>` or `<Select>` component should stay type-safe for whatever `T` its consumer passes.
- **Global augmentation is the only clean way to type ambient globals** (env vars, route meta, global properties) — never `as any` at every call site.

---

## 1) Typed `defineProps`

```vue
<script setup lang="ts">
interface Props {
  title: string
  count?: number
  status: 'idle' | 'loading' | 'done'
  items: readonly string[]
}

const props = withDefaults(defineProps<Props>(), {
  count: 0,
})
</script>
```

- Type-based `defineProps<Props>()` gives full IDE autocomplete and compiler errors at every usage — prefer it over the runtime `defineProps({ title: String })` form.
- `withDefaults` supplies defaults for optional props — don't destructure `props` with `const { count = 0 } = defineProps<Props>()`, since destructuring loses reactivity unless wrapped in `toRefs`/`toRef`.
- Complex prop shapes get their own named `interface`, reused by tests and stories, not inlined into the macro call.

## 2) Typed `defineEmits`

```vue
<script setup lang="ts">
interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'submit', payload: { id: number; valid: boolean }): void
  (e: 'close'): void
}

const emit = defineEmits<Emits>()

function handleSubmit() {
  emit('submit', { id: 1, valid: true })
}
</script>
```

Newer, more concise object-literal form (Vue 3.3+):

```ts
const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [payload: { id: number; valid: boolean }]
  close: []
}>()
```

Prefer the object-literal tuple form for new code — it's shorter and Vue's official recommendation since 3.3.

## 3) `defineModel` (Vue 3.4+)

```vue
<script setup lang="ts">
const modelValue = defineModel<string>({ required: true })
const isOpen = defineModel<boolean>('open', { default: false })
</script>

<template>
  <input v-model="modelValue" />
</template>
```

Replaces the old `defineProps<{ modelValue: string }>()` + `defineEmits<{ 'update:modelValue': [string] }>()` pair with a single typed ref — use it for any new `v-model`-compatible component.

## 4) Generic Components

```vue
<script setup lang="ts" generic="T extends { id: string | number }">
interface Props {
  items: T[]
  selected?: T
}

defineProps<Props>()
defineEmits<{ select: [item: T] }>()
</script>

<template>
  <ul>
    <li v-for="item in items" :key="item.id" @click="$emit('select', item)">
      <slot :item="item" />
    </li>
  </ul>
</template>
```

```vue
<!-- Usage: T is inferred as User -->
<GenericList :items="users" @select="(user) => console.log(user.name)">
  <template #default="{ item }">{{ item.name }}</template>
</GenericList>
```

Use `generic="T"` (with a constraint whenever the template/logic accesses a property of `T`) for list/select/table-style components — this is the type-safe alternative to `any`/`unknown` props in reusable components.

See [`references/generic-components.md`](references/generic-components.md).

## 5) Template Refs

```vue
<script setup lang="ts">
import { useTemplateRef } from 'vue'
import MyInput from './MyInput.vue'

const inputRef = useTemplateRef<HTMLInputElement>('input')
const componentRef = useTemplateRef<InstanceType<typeof MyInput>>('myInput')

function focus() {
  inputRef.value?.focus()
}
</script>

<template>
  <input ref="input" />
  <MyInput ref="myInput" />
</template>
```

- `useTemplateRef` (Vue 3.5+) types template refs explicitly by target element/component type.
- For a child component instance, type it with `InstanceType<typeof ComponentName>` — never `any`.
- Always guard with `?.` — the ref is `null` until mounted.

## 6) `provide` / `inject` with `InjectionKey`

```ts
// keys.ts
import type { InjectionKey, Ref } from 'vue'

export interface ThemeContext {
  mode: Ref<'light' | 'dark'>
  toggle: () => void
}

export const ThemeKey: InjectionKey<ThemeContext> = Symbol('theme')
```

```vue
<!-- Provider -->
<script setup lang="ts">
import { ref, provide } from 'vue'
import { ThemeKey } from './keys'

const mode = ref<'light' | 'dark'>('light')
provide(ThemeKey, { mode, toggle: () => (mode.value = mode.value === 'light' ? 'dark' : 'light') })
</script>
```

```vue
<!-- Consumer -->
<script setup lang="ts">
import { inject } from 'vue'
import { ThemeKey } from './keys'

const theme = inject(ThemeKey)
if (!theme) throw new Error('ThemeKey not provided')
</script>
```

A typed `InjectionKey<T>` makes `inject()` return `T | undefined` automatically — no manual casting, and a rename/type change at the source is caught everywhere it's injected.

## 7) Typed Composables

```ts
// useCounter.ts
import { ref, type Ref } from 'vue'

interface UseCounterReturn {
  count: Ref<number>
  increment: () => void
  reset: () => void
}

export function useCounter(initial = 0): UseCounterReturn {
  const count = ref(initial)
  const increment = () => { count.value++ }
  const reset = () => { count.value = initial }
  return { count, increment, reset }
}
```

Annotate the return type explicitly once a composable returns more than a couple of values — it documents the public shape and catches a return-statement typo immediately, instead of silently changing the composable's inferred API.

See [`references/pinia-and-composables-typing.md`](references/pinia-and-composables-typing.md).

## 8) Typed Pinia Stores

```ts
// stores/user.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  async function login(credentials: { email: string; password: string }): Promise<void> {
    user.value = await api.post<User>('/login', credentials)
  }

  return { user, isAuthenticated, login }
})
```

Setup stores infer their public type from the returned object automatically — type the `ref`/`computed` initializers and function signatures, and the store's consumer-facing type follows without extra annotation.

See [`references/pinia-and-composables-typing.md`](references/pinia-and-composables-typing.md).

## 9) Augmenting Global Types

```ts
// vue-router-augment.d.ts
import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: string[]
  }
}
```

```ts
// env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

Use module augmentation for third-party library types (route `meta`, global component properties) instead of casting `route.meta as any` at every call site.

## 10) Component Prop Types From Another Component

```ts
import type { ComponentProps } from 'vue-component-type-helpers'
import DataTable from './DataTable.vue'

type DataTableProps = ComponentProps<typeof DataTable>
```

Use `vue-component-type-helpers` (or `InstanceType<typeof Component>['$props']` as a fallback) to derive a wrapper component's props from the component it wraps, instead of re-declaring the same interface twice.

---

## 11) Final Self-Check

- Props/emits typed via the `defineProps<T>()`/`defineEmits<T>()` macros, not the runtime-object form.
- Optional props get defaults via `withDefaults`, never via destructuring the props object.
- `v-model`-style components use `defineModel<T>()` (Vue 3.4+) instead of manual prop+emit pairs.
- Reusable list/table/select components use `<script setup generic="T">` rather than `any`/`unknown` item types.
- Every `provide`/`inject` pair goes through a typed `InjectionKey<T>`.
- Composables and setup-style Pinia stores have inferable or explicitly annotated return types.
- No `as any` on `route.meta`, `import.meta.env`, or template refs — use module augmentation and `useTemplateRef<T>` instead.
