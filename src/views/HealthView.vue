<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

type HealthState = 'loading' | 'ok' | 'error'
const state = ref<HealthState>('loading')
const database = ref('')
const errorHint = ref('')
const latency = ref<number | null>(null)

/**
 * 为什么不是 /api/health：
 * 该路径在后端不存在映射，且不在 SecurityConfig 白名单内，线上实测固定返回 401，
 * 导致本页永久显示「后端不可达」。后端真实健康端点是 Spring Actuator 的
 * /actuator/health（已在 SecurityConfig permitAll），由 nginx 单独代理透传。
 * 匿名访问时（show-details: when_authorized）只返回 {"status":"UP"}，不含组件明细。
 */
const HEALTH_ENDPOINT = '/actuator/health'

onMounted(async () => {
  const startedAt = performance.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(HEALTH_ENDPOINT, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeout)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data: unknown = await res.json()
    const payload = data as { status?: string; components?: Record<string, { status?: string }> }
    latency.value = Math.round(performance.now() - startedAt)

    if (payload.status !== 'UP') throw new Error('服务状态异常')

    state.value = 'ok'
    const dbComponent = payload.components?.db?.status
    database.value = dbComponent
      ? dbComponent === 'UP'
        ? '正常'
        : '异常'
      : '正常（匿名不返回明细）'
  } catch {
    state.value = 'error'
    latency.value = null
    errorHint.value =
      '后端服务不可达。请确认容器 backend 已启动且 nginx 已代理 /actuator/health；本地开发需运行 Docker Compose。'
  }
})
</script>

<template>
  <main class="min-h-[100dvh] bg-gradient-to-b from-[var(--color-cream)] to-[var(--color-sand)] px-4 py-12">
    <div class="mx-auto max-w-md text-center">
      <h1 class="mb-8 text-2xl font-bold font-serif text-[var(--color-wood)]">服务健康检查</h1>

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
            <div class="flex justify-between"><dt>响应耗时</dt><dd>{{ latency }} ms</dd></div>
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
