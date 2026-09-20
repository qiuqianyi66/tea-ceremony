<script setup lang="ts">
/**
 * 成长数据看板（T1.1）
 * 茶案上的账册：概要 / 八维均值 / 评分趋势 / 茶类足迹 / 节气足迹。
 * 数据全部来自本地品鉴记录（IndexedDB），离线可用；无记录时展示空态。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import TasteRadarChart from '@/components/tasting/TasteRadarChart.vue'
import TasteTrendChart from '@/components/tasting/TasteTrendChart.vue'
import { EmptyState } from '@/components/ui'
import { teas } from '@/data/teas'
import {
  averageDimensions,
  categoryDistribution,
  computeGrowthStats,
  solarTermFootprint,
} from '@/services/growth'
import { useRecordStore } from '@/stores/record'
import type { TeaType } from '@/types/tea'

const router = useRouter()
const recordStore = useRecordStore()
const loadError = ref('')

onMounted(async () => {
  await loadRecords()
})

async function loadRecords() {
  loadError.value = ''
  try {
    await recordStore.load()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '加载品鉴记录失败'
  }
}

const teaTypeById = computed<Record<string, TeaType>>(() => {
  const map: Record<string, TeaType> = {}
  for (const tea of teas) map[tea.id] = tea.type
  return map
})

const stats = computed(() => computeGrowthStats(recordStore.history))
const avgDims = computed(() => averageDimensions(recordStore.history))
const catDist = computed(() => categoryDistribution(recordStore.history, teaTypeById.value))
const footprint = computed(() => solarTermFootprint(recordStore.history).slice(0, 6))
const hasRecords = computed(() => recordStore.history.length > 0)
</script>

<template>
  <div class="min-h-[100dvh] p-4 sm:p-8">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-3xl font-bold text-[var(--color-wood)]">成长看板</h2>
      <div class="flex items-center gap-4">
        <button
          class="inline-flex min-h-11 items-center text-xs px-3 rounded-full border border-[var(--color-wood-light)]/30 text-[var(--color-wood-light)] hover:bg-white/60"
          @click="router.push('/history')"
        >品鉴历史</button>
        <button
          class="inline-flex min-h-11 min-w-11 items-center justify-center text-[var(--color-wood-light)] hover:text-[var(--color-wood)]"
          @click="router.push('/')"
        >返回</button>
      </div>
    </div>

    <!-- 加载态 -->
    <div v-if="!recordStore.loaded && !loadError" class="py-16 text-center text-sm text-[var(--color-wood-light)]">
      正在展开账册…
    </div>

    <!-- 错误态 -->
    <div v-else-if="loadError" class="glass-panel rounded-xl p-6 text-center">
      <p class="text-sm text-[var(--color-wood)]">记录加载失败：{{ loadError }}</p>
      <button
        class="mt-4 inline-flex min-h-11 items-center text-xs px-3 rounded-full border border-[var(--color-wood-light)]/30 text-[var(--color-wood-light)] hover:bg-white/60"
        @click="loadRecords"
      >重试</button>
    </div>

    <!-- 空态 -->
    <EmptyState
      v-else-if="!hasRecords"
      title="暂无品鉴记录"
      description="完成一次冲泡品鉴后，这里会亮起你的茶路"
    >
      <button
        class="inline-flex min-h-11 items-center text-xs px-4 rounded-full bg-[var(--color-wood)] text-[var(--color-paper)] hover:opacity-90"
        @click="router.push('/select')"
      >去选一壶茶</button>
    </EmptyState>

    <!-- 数据态 -->
    <div v-else>
      <!-- 概要 -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
        <div class="glass-panel rounded-xl p-4">
          <p class="text-2xl font-serif font-bold text-[var(--color-wood)]">{{ stats.total }}</p>
          <p class="text-xs text-[var(--color-wood-light)] mt-1">总杯数</p>
        </div>
        <div class="glass-panel rounded-xl p-4">
          <p class="text-2xl font-serif font-bold text-[var(--color-wood)]">{{ stats.avgScore || '—' }}</p>
          <p class="text-xs text-[var(--color-wood-light)] mt-1">平均分</p>
        </div>
        <div class="glass-panel rounded-xl p-4">
          <p class="text-2xl font-serif font-bold text-[var(--color-tea-gold)]">{{ stats.maxScore || '—' }}</p>
          <p class="text-xs text-[var(--color-wood-light)] mt-1 truncate">{{ stats.maxScoreTea || '暂无' }}</p>
        </div>
        <div class="glass-panel rounded-xl p-4">
          <p class="text-2xl font-serif font-bold text-[var(--color-wood)] truncate">{{ stats.topTeaName || '—' }}</p>
          <p class="text-xs text-[var(--color-wood-light)] mt-1">最常喝</p>
        </div>
      </div>

      <!-- 八维均值 + 评分趋势 -->
      <div class="grid lg:grid-cols-2 gap-4 mb-6">
        <div class="glass-panel rounded-xl p-4">
          <h3 class="text-lg font-bold text-[var(--color-wood)] mb-2">八维均值</h3>
          <p class="text-xs text-[var(--color-wood-light)] mb-3">苦涩 / 甜 / 回甘 / 醇厚 / 香 / 汤感 / 身心 / 整体</p>
          <div class="flex justify-center">
            <TasteRadarChart :current-dimensions="avgDims" :show-comparison="false" :size="280" />
          </div>
        </div>
        <div class="glass-panel rounded-xl p-4">
          <h3 class="text-lg font-bold text-[var(--color-wood)] mb-2">评分趋势</h3>
          <p class="text-xs text-[var(--color-wood-light)] mb-3">最近 20 次的综合评分与工艺系数</p>
          <TasteTrendChart :records="recordStore.history" :height="200" />
        </div>
      </div>

      <!-- 茶类足迹 -->
      <div class="glass-panel rounded-xl p-4 mb-6">
        <h3 class="text-lg font-bold text-[var(--color-wood)] mb-2">茶类足迹</h3>
        <p class="text-xs text-[var(--color-wood-light)] mb-4">喝过 {{ catDist.length }} / 6 类茶</p>
        <div class="space-y-3">
          <div v-for="cat in catDist" :key="cat.type" class="flex items-center gap-3">
            <span class="w-10 shrink-0 text-sm text-[var(--color-wood)]">{{ cat.type }}</span>
            <div class="h-2 flex-1 rounded-full bg-white overflow-hidden">
              <div
                class="h-full rounded-full bg-[var(--color-wood)]/60"
                :style="{ width: `${Math.max(4, Math.round(cat.ratio * 100))}%` }"
              ></div>
            </div>
            <span class="w-8 shrink-0 text-right text-xs text-[var(--color-wood-light)]">{{ cat.count }}</span>
          </div>
        </div>
      </div>

      <!-- 节气足迹 -->
      <div class="glass-panel rounded-xl p-4">
        <h3 class="text-lg font-bold text-[var(--color-wood)] mb-2">节气足迹</h3>
        <p class="text-xs text-[var(--color-wood-light)] mb-4">你在哪些节气喝过茶</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="term in footprint" :key="term.id"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-paper)] text-sm text-[var(--color-wood)]"
          >
            <span class="font-serif">{{ term.name }}</span>
            <span class="text-xs text-[var(--color-wood-light)]">× {{ term.count }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
