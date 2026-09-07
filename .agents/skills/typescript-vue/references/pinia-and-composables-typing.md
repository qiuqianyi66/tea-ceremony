# Typing Composables & Pinia Stores

> For general composable/store design (SRP, HMR, storeToRefs usage), see `vue-composables` and `vue-pinia`. This reference covers the TypeScript-specific typing concerns.

## Composables: explicit return type

```ts
import { ref, computed, type Ref, type ComputedRef } from 'vue'

interface UseFetchReturn<T> {
  data: Ref<T | null>
  error: Ref<Error | null>
  isLoading: Ref<boolean>
  refetch: () => Promise<void>
}

export function useFetch<T>(url: string): UseFetchReturn<T> {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<Error | null>(null)
  const isLoading = ref(false)

  async function refetch() {
    isLoading.value = true
    error.value = null
    try {
      data.value = await (await fetch(url)).json()
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      isLoading.value = false
    }
  }

  refetch()
  return { data, error, isLoading, refetch }
}
```

- Name the return interface `Use<Name>Return` — it documents the composable's public shape at a glance.
- Generic composables (`useFetch<T>`) let each call site specify the payload type instead of returning `unknown`/`any`.
- `ref<T | null>(null) as Ref<T | null>` is sometimes needed because `ref(null)` alone infers `Ref<null>` — pass the type argument explicitly instead of casting when possible: `ref<T | null>(null)`.

## `MaybeRef` / `MaybeRefOrGetter` for flexible composable inputs

```ts
import { toValue, type MaybeRefOrGetter, ref, watchEffect } from 'vue'

export function useDocumentTitle(title: MaybeRefOrGetter<string>) {
  watchEffect(() => {
    document.title = toValue(title)
  })
}

useDocumentTitle('Static title')
useDocumentTitle(computed(() => `${count.value} items`))
useDocumentTitle(() => `${count.value} items`)
```

Accepting `MaybeRefOrGetter<T>` (and unwrapping with `toValue`) lets a composable accept a plain value, a `ref`, a `computed`, or a getter function — the standard pattern for library-grade composables (see `vue-composables` skill for the full catalog).

## Typed event listener composables

```ts
import { onMounted, onUnmounted, type MaybeRefOrGetter, toValue } from 'vue'

export function useEventListener<K extends keyof WindowEventMap>(
  target: MaybeRefOrGetter<Window>,
  event: K,
  handler: (ev: WindowEventMap[K]) => void,
) {
  onMounted(() => toValue(target).addEventListener(event, handler))
  onUnmounted(() => toValue(target).removeEventListener(event, handler))
}

useEventListener(window, 'resize', (e) => {
  console.log(e.target) // e is typed as UIEvent, inferred from the 'resize' key
})
```

`K extends keyof WindowEventMap` is what makes the `handler`'s event parameter type follow automatically from the `event` string argument — the same pattern VueUse uses internally.

## Pinia Setup Store — inferred vs explicit typing

```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
  const user = ref<User | null>(null)
  const isAuthenticated = computed(() => user.value !== null)

  async function login(email: string, password: string): Promise<void> {
    user.value = await authApi.login(email, password)
  }

  function logout(): void {
    user.value = null
  }

  return { user, isAuthenticated, login, logout }
})
```

The store's consumer-facing type (`ReturnType<typeof useUserStore>`) is inferred automatically from the returned object — annotate the `ref`/`computed` generics and function signatures, and the store type follows without a separate interface.

## Pinia Options Store typing (when required)

```ts
interface State {
  user: User | null
}

export const useUserStore = defineStore('user', {
  state: (): State => ({ user: null }),
  getters: {
    isAuthenticated: (state): boolean => state.user !== null,
  },
  actions: {
    async login(email: string, password: string): Promise<void> {
      this.user = await authApi.login(email, password)
    },
  },
})
```

Annotate `state` with an explicit return type (`(): State => (...)`)  — without it, a `null` initial value for `user` gets narrowed to `null` instead of `User | null`, breaking every later assignment.

## Typing a store used across components

```ts
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const { user, isAuthenticated } = storeToRefs(store) // Ref<User | null>, Ref<boolean>
const { login, logout } = store                       // typed functions, safe to destructure
```

`storeToRefs` preserves the store's inferred types automatically — no manual typing needed at the call site, which is the main reason setup stores with inferred types are preferred over hand-written store interfaces.
