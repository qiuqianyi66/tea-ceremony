---
last_updated: 2026-11-02
status: active
owner: yanha
---

# Pinia Store 骨架

解决「store 写法不统一、组件解构后丢响应式」的问题：统一 setup store，state / getters / actions 分区，组件侧用 `storeToRefs`。

## 1. setup store 骨架

`defineStore('name', () => { ... })`，返回对象里列出全部 state / getter / action。文件名与 store 名对应（`src/stores/ui.ts` → `useUiStore`）。

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getTrackingSummary } from '@/services/tracking'

export const useInsightStore = defineStore('insight', () => {
  // state
  const summary = ref<Record<string, number>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  // getters
  const entries = computed(() => Object.entries(summary.value))
  const eventCount = computed(() => entries.value.reduce((sum, [, n]) => sum + n, 0))
  const isEmpty = computed(() => !loading.value && entries.value.length === 0)

  // actions
  function merge(extra: Record<string, number>): void {
    summary.value = { ...summary.value, ...extra }
  }

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      summary.value = await getTrackingSummary()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '埋点统计加载失败'
    } finally {
      loading.value = false
    }
  }

  return { summary, loading, error, entries, eventCount, isEmpty, merge, load }
})
```

分区注释保留。返回对象是唯一出口，漏返回的成员在组件里取不到。

## 2. 组件里取用

解构 state 与 getter 走 `storeToRefs`；action 直接从 store 解构（它不是响应式数据）。

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted } from 'vue'

import { useInsightStore } from '@/stores/insight'

const store = useInsightStore()
const { entries, loading, error, eventCount, isEmpty } = storeToRefs(store)
const { load, merge } = store

onMounted(load)
</script>

<template>
  <section class="rounded-xl bg-[var(--color-paper)] p-4 shadow-md">
    <p class="text-sm text-[var(--color-wood-light)]">共 {{ eventCount }} 条事件</p>
    <p v-if="loading" class="mt-2 text-sm text-[var(--color-wood-light)]">统计加载中</p>
    <p v-else-if="error" class="mt-2 text-sm text-[var(--color-cinnabar)]">{{ error }}</p>
    <p v-else-if="isEmpty" class="mt-2 text-sm text-[var(--color-wood-light)]">还没有埋点数据</p>
    <ul v-else class="mt-2 flex flex-col gap-1 text-sm text-[var(--color-ink)]">
      <li v-for="[name, count] in entries" :key="name">{{ name }}：{{ count }}</li>
    </ul>
    <button
      type="button"
      class="mt-4 min-h-11 rounded-md bg-[var(--color-wood)] px-4 text-sm text-[var(--color-cream)]"
      @click="merge({ manual: 1 })"
    >
      记一次手动事件
    </button>
  </section>
</template>
```

反例：`const { entries } = useInsightStore()` 拿到的是快照，后续更新不触发渲染。

## 3. 异步 action 与错误收口

action 内自己收口 loading / error，组件只读状态。返回布尔让调用方决定跳转还是留在原地。

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { getWebVitals } from '@/services/vitals'

export const useVitalsStore = defineStore('vitals', () => {
  const samples = ref<number[]>([])
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function refresh(): Promise<boolean> {
    saving.value = true
    error.value = null
    try {
      const records = await getWebVitals()
      samples.value = records.map((record) => record.value)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '性能数据读取失败，请重试'
      return false
    } finally {
      saving.value = false
    }
  }

  return { samples, saving, error, refresh }
})
```

## 4. 约定

- 一个 store 一个文件，放 `src/stores/`，命名 `useXxxStore`。
- 组件局部状态不进 store；跨页面共享才入 store。
- 不在 store 里操作 DOM 或跳路由，交给调用方。
- 写 IndexedDB 前对响应式代理做 `toRaw`，否则 `DataCloneError`。
- 已有 store：`auth` / `brew` / `progress` / `record` / `taste` / `tea` / `teaRoom` / `theme` / `ui`。新建前先看是否已有承载同一状态的 store。
