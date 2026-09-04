<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

type HealthState = 'loading' | 'ok' | 'error'
const state = ref<HealthState>('loading')
const database = ref('')
const mode = ref('')
const errorHint = ref('')

onMounted(async () => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.status === 'ok' && data.database === 'ok') {
      state.value = 'ok'
      database.value = '正常'
      mode.value = data.dev_mode ? '开发模式' : '生产模式'
    } else {
      throw new Error('服务状态异常')
    }
  } catch {
    state.value = 'error'
    errorHint.value = '后端服务不可达。静态 Demo（GitHub Pages）不包含后端，属预期；完整功能需运行 Docker Compose。'
  }
})
</script>

<template>
  <main class="min-h-screen bg-gradient-to-b from-[var(--color-cream)] to-[var(--color-sand)] px-4 py-12">
    <div class="mx-auto max-w-md text-center">
      <h1 class="mb-8 text-2xl font-bold text-[var(--color-wood)]">服务健康检查</h1>

      <div class="rounded-2xl bg-white/70 p-6 shadow-xl">
        <div class="flex items-center justify-center gap-3">
          <span
            class="inline-block h-3 w-3 rounded-full"
            :class="{
              'bg-amber-400 animate-pulse': state === 'loading',
              'bg-emerald-500': state === 'ok',
              'bg-red-500': state === 'error',
            }"
          />
          <p class="text-lg font-medium text-[var(--color-wood)]">
            {{ state === 'loading' ? '检查中…' : state === 'ok' ? '服务正常' : '后端不可达' }}
          </p>
        </div>

        <template v-if="state === 'ok'">
          <dl class="mt-6 space-y-2 text-sm text-[var(--color-wood-light)]">
            <div class="flex justify-between"><dt>数据库</dt><dd>{{ database }}</dd></div>
            <div class="flex justify-between"><dt>运行模式</dt><dd>{{ mode }}</dd></div>
          </dl>
        </template>
        <p v-else-if="state === 'error'" class="mt-4 text-sm leading-relaxed text-[var(--color-wood-light)]">
          {{ errorHint }}
        </p>
      </div>

      <button type="button" @click="router.push({ name: 'home' })"
        class="mt-6 rounded-xl bg-[var(--color-wood)] px-6 py-3 text-sm font-medium text-[var(--color-cream)] transition-colors hover:bg-[var(--color-wood-light)]">
        回到首页
      </button>
    </div>
  </main>
</template>
