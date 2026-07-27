<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { teas, getTeaById } from '@/data/teas'
import { teawares } from '@/data/teawares'
import { TeaType } from '@/types/tea'

const router = useRouter()
const store = useTeaStore()

onMounted(() => {
  store.loadHistory()
})

// ============ 已品鉴的茶叶 ============
const tastedTeas = computed(() => {
  const tastedIds = new Set(store.history.map(r => r.teaId))
  return teas.filter(t => tastedIds.has(t.id))
})

const tastedCount = computed(() => tastedTeas.value.length)
const totalTeas = computed(() => teas.length)

// ============ 按茶类统计 ============
const typeStats = computed(() => {
  const stats: Record<string, { tasted: number; total: number }> = {}
  for (const type of Object.values(TeaType)) {
    const total = teas.filter(t => t.type === type).length
    const tasted = tastedTeas.value.filter(t => t.type === type).length
    stats[type] = { tasted, total }
  }
  return stats
})

// ============ 评分统计 ============
const avgScore = computed(() => {
  if (store.history.length === 0) return 0
  const sum = store.history.reduce((a, r) => a + r.overallScore, 0)
  return (sum / store.history.length).toFixed(1)
})

const bestScore = computed(() => {
  if (store.history.length === 0) return 0
  return Math.max(...store.history.map(r => r.overallScore))
})

// ============ 已解锁茶器 ============
const unlockedWares = computed(() =>
  teawares.filter(w => store.isTeaWareUnlocked(w.id)),
)
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="flex items-center justify-between mb-8">
      <h2 class="text-3xl font-bold text-[var(--color-wood)]">我的茶柜</h2>
      <button @click="router.push('/')" class="text-[var(--color-wood-light)] hover:text-[var(--color-wood)]">返回</button>
    </div>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-3 gap-3 mb-8">
      <div class="glass-panel rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ tastedCount }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">已品鉴 / {{ totalTeas }} 款</p>
      </div>
      <div class="glass-panel rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ avgScore }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">平均评分</p>
      </div>
      <div class="glass-panel rounded-xl p-4 text-center">
        <p class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ bestScore }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">最高评分</p>
      </div>
    </div>

    <!-- 茶类进度 -->
    <div class="mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3">六大茶类</h3>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <div v-for="(stat, type) in typeStats" :key="type"
          class="glass-panel rounded-xl p-3 text-center">
          <p class="text-sm font-bold text-[var(--color-wood)]">{{ type }}</p>
          <p class="text-lg font-bold text-[var(--color-tea-gold)]">{{ stat.tasted }}/{{ stat.total }}</p>
          <div class="w-full h-1 bg-white rounded-full mt-1 overflow-hidden">
            <div class="h-full bg-[var(--color-tea-gold)] rounded-full transition-all"
              :style="{ width: `${(stat.tasted / stat.total) * 100}%` }"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 已品鉴茶叶 -->
    <div class="mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3">🍃 已品鉴</h3>
      <div v-if="tastedTeas.length === 0" class="text-center text-[var(--color-wood-light)] py-8">
        <p>还没有品鉴记录</p>
        <button @click="router.push('/select')" class="mt-2 text-[var(--color-tea-gold)] hover:underline">
          开始品茶 →
        </button>
      </div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div v-for="tea in tastedTeas" :key="tea.id"
          class="glass-panel rounded-xl p-3 text-center">
          <div class="w-full h-12 rounded-lg mb-2"
            :style="{ background: `linear-gradient(135deg, ${tea.soupColorMin}, ${tea.soupColorMax})` }">
          </div>
          <p class="text-sm font-bold text-[var(--color-wood)]">{{ tea.name }}</p>
          <p class="text-xs text-[var(--color-wood-light)]">{{ tea.type }} · {{ tea.origin }}</p>
        </div>
      </div>
    </div>

    <!-- 已解锁茶器 -->
    <div>
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3">🫖 我的茶器</h3>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <div v-for="ware in unlockedWares" :key="ware.id"
          class="glass-panel rounded-xl p-3 text-center">
          <p class="text-2xl mb-1">
            {{ ware.id === 'gaiwan' ? '🍵' : ware.id === 'yixing' ? '🫖' : ware.id === 'glass' ? '🥛' : ware.id === 'celadon' ? '🍶' : ware.id === 'duanning' ? '🫖' : '🏺' }}
          </p>
          <p class="text-xs font-bold text-[var(--color-wood)]">{{ ware.name }}</p>
          <p class="text-[10px] text-[var(--color-wood-light)]">{{ ware.material }}</p>
        </div>
      </div>
      <div v-if="teawares.length > unlockedWares.length" class="mt-3 text-center">
        <p class="text-xs text-[var(--color-wood-light)]">
          还有 {{ teawares.length - unlockedWares.length }} 款茶器待解锁
        </p>
      </div>
    </div>
  </div>
</template>
