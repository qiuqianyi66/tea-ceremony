<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Card, PageHeader, SectionHeader } from '@/components/ui'
import { useRouter } from 'vue-router'
import TasteProfileSection from '@/components/tasting/TasteProfileSection.vue'
import { TEA_LEVELS } from '@/data/constants'
import { teas } from '@/data/teas'
import { teawares } from '@/data/teawares'
import { useProgressStore } from '@/stores/progress'
import { useTeaStore } from '@/stores/tea'
import {
  getTelemetryEnabledSetting,
  isTelemetryEnabled,
  setTelemetryEnabled,
} from '@/services/telemetry'
import { formatDateShort } from '@/utils/format'

const router = useRouter()
const store = useTeaStore()
const progress = useProgressStore()

/** 匿名遥测开关（ADR-022 §7：用户可关闭；默认开） */
const telemetryOn = ref(isTelemetryEnabled())
const telemetryJustSaved = ref(false)

async function toggleTelemetry() {
  const next = !telemetryOn.value
  telemetryOn.value = next
  await setTelemetryEnabled(next)
  telemetryJustSaved.value = true
  window.setTimeout(() => {
    telemetryJustSaved.value = false
  }, 2000)
}

onMounted(async () => {
  store.loadHistory()
  // 以持久化值为准（首帧先用内存值渲染，避免开关闪一下）
  telemetryOn.value = await getTelemetryEnabledSetting()
})

const tastedTypes = computed(
  () =>
    new Set(
      store.history
        .map((r) => {
          const t = teas.find((tt) => tt.id === r.teaId)
          return t?.type
        })
        .filter(Boolean),
    ),
)
const totalTastings = computed(() => store.history.length)
const unlockedWareCount = computed(
  () => teawares.filter((w) => progress.isTeaWareUnlocked(w.id)).length,
)
const typeCoverage = computed(() => Math.round((tastedTypes.value.size / 6) * 100))
</script>

<template>
  <div class="min-h-[100dvh] p-4 sm:p-8">
    <PageHeader icon="IconSprout" title="茶修档案" tight />

    <!-- 当前境界 -->
    <div class="glass-panel rounded-2xl p-6 mb-6 text-center">
      <component :is="`Icon${progress.currentLevel.icon}`" class="w-12 h-12 mx-auto mb-2 text-[var(--color-tea-gold)]" />
      <p class="text-2xl font-bold text-[var(--color-wood)] mb-1">{{ progress.currentLevel.name }}</p>
      <p class="text-sm text-[var(--color-wood-light)] mb-4">{{ progress.currentLevel.desc }}</p>
      <p class="text-xs text-[var(--color-wood-light)]">茶修经验 {{ progress.userXp }}</p>
      <div v-if="progress.nextLevel" class="mt-3">
        <div class="w-full h-2 bg-[var(--color-paper)] rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-[var(--color-tea-gold)] to-[var(--color-wood)] rounded-full transition-all"
            :style="{ width: `${Math.min(100, (progress.userXp / progress.xpForNextLevel) * 100)}%` }">
          </div>
        </div>
        <p class="text-xs text-[var(--color-wood-light)] mt-1">
          下一境：{{ progress.nextLevel.name }}（{{ progress.userXp }}/{{ progress.xpForNextLevel }}）
        </p>
      </div>
      <p v-else class="text-xs text-[var(--color-tea-gold)] mt-2">已达至境</p>
    </div>

    <!-- 六境全景 -->
    <div class="mb-6">
      <SectionHeader size="base" :level="3">茶修六境</SectionHeader>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <Card flat padding="sm" v-for="(level, i) in TEA_LEVELS" :key="level.id" class="text-center transition-all"
          :class="progress.userXp >= level.minXp
            ? 'opacity-100'
            : 'opacity-40 grayscale'">
          <component :is="`Icon${level.icon}`" class="w-7 h-7 mb-1 mx-auto" :class="progress.userXp >= level.minXp ? 'text-[var(--color-tea-gold)]' : ''" />
          <p class="text-xs font-bold text-[var(--color-wood)]">{{ level.name }}</p>
          <p class="text-[10px] text-[var(--color-wood-light)]">{{ level.desc }}</p>
          <p class="mt-1 text-[10px] leading-4 text-[var(--color-tea-gold)]/80">{{ level.essence }}</p>
        </Card>
      </div>
    </div>

    <!-- 统计 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <Card flat padding="sm" class="text-center">
        <p class="text-lg font-bold text-[var(--color-tea-gold)]">{{ totalTastings }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">总品鉴</p>
      </Card>
      <Card flat padding="sm" class="text-center">
        <p class="text-lg font-bold text-[var(--color-tea-gold)]">{{ store.history.length > 0 ? (store.history.reduce((a, r) => a + r.overallScore, 0) / store.history.length).toFixed(1) : '—' }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">平均评分</p>
      </Card>
      <Card flat padding="sm" class="text-center">
        <p class="text-lg font-bold text-[var(--color-tea-gold)]">{{ typeCoverage }}%</p>
        <p class="text-xs text-[var(--color-wood-light)]">茶类覆盖</p>
      </Card>
      <Card flat padding="sm" class="text-center">
        <p class="text-lg font-bold text-[var(--color-tea-gold)]">{{ unlockedWareCount }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">茶器收藏</p>
      </Card>
    </div>

    <!-- 口味画像 -->
    <TasteProfileSection :history="store.history" />

    <!-- 近期茶记 -->
    <div>
      <SectionHeader size="base" :level="3" icon="IconBookOpen">近期茶记</SectionHeader>
      <div v-if="store.history.length === 0" class="text-center text-[var(--color-wood-light)] py-8">
        <p>还没有品鉴记录</p>
        <button @click="router.push('/select')" class="mt-2 inline-flex min-h-11 items-center text-[var(--color-tea-gold)] hover:underline">开始品茶</button>
      </div>
      <div v-else class="space-y-2">
        <Card flat padding="sm" v-for="r in store.history.slice(0, 5)" :key="r.id" class="text-sm">
          <div class="flex justify-between items-center">
            <div>
              <p class="font-bold text-[var(--color-wood)]">{{ r.teaName }}</p>
              <p class="text-xs text-[var(--color-wood-light)]">
                {{ formatDateShort(r.date) }}
                {{ r.weather || '' }} {{ r.mood || '' }}
              </p>
            </div>
            <span class="text-lg font-bold text-[var(--color-tea-gold)]">{{ r.overallScore }}</span>
          </div>
          <p v-if="r.notes" class="text-xs text-[var(--color-wood-light)] mt-1 italic">"{{ r.notes }}"</p>
        </Card>
      </div>
    </div>

    <!-- 隐私：匿名运行数据开关（ADR-022）。关掉即停止采集与上报，本地已存数据不删 -->
    <div>
      <SectionHeader size="base" :level="3" icon="IconActivity">隐私</SectionHeader>
      <Card flat>
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm font-medium text-[var(--color-wood)]">匿名运行数据</p>
            <p class="mt-1 text-xs leading-relaxed text-[var(--color-wood-light)]">
              上报脚本错误与页面性能，用来定位线上问题。只含错误堆栈和指标数值，不含品鉴内容与账号信息。
            </p>
          </div>
          <button
            type="button"
            role="switch"
            class="relative inline-flex min-h-11 w-14 shrink-0 items-center rounded-full transition-colors"
            :class="telemetryOn ? 'bg-[var(--color-tea-gold)]' : 'bg-[var(--color-wood-light)]/35'"
            :aria-checked="telemetryOn"
            aria-label="匿名运行数据上报"
            @click="toggleTelemetry"
          >
            <span
              class="inline-block h-6 w-6 rounded-full bg-[var(--color-cream)] shadow transition-transform"
              :class="telemetryOn ? 'translate-x-7' : 'translate-x-1'"
            />
          </button>
        </div>
        <p v-if="telemetryJustSaved" class="mt-3 text-xs text-[var(--color-tea-gold)]">
          {{ telemetryOn ? '已开启' : '已关闭，不再上报' }}
        </p>
      </Card>
    </div>
  </div>
</template>
