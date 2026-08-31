<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { TEA_LEVELS } from '@/data/constants'
import { teas } from '@/data/teas'
import { teawares } from '@/data/teawares'

const router = useRouter()
const store = useTeaStore()

onMounted(() => {
  store.loadHistory()
})

const tastedTypes = computed(() => new Set(store.history.map(r => {
  const t = teas.find(tt => tt.id === r.teaId)
  return t?.type
}).filter(Boolean)))
const totalTastings = computed(() => store.history.length)
const unlockedWareCount = computed(() => teawares.filter(w => store.isTeaWareUnlocked(w.id)).length)
const typeCoverage = computed(() => Math.round((tastedTypes.value.size / 6) * 100))
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-3xl font-bold text-[var(--color-wood)]">🌿 茶修档案</h2>
      <button @click="router.push('/')" class="text-[var(--color-wood-light)] hover:text-[var(--color-wood)]">返回</button>
    </div>

    <!-- 当前境界 -->
    <div class="glass-panel rounded-2xl p-6 mb-6 text-center">
      <p class="text-5xl mb-2">{{ store.currentLevel.icon }}</p>
      <p class="text-2xl font-bold text-[var(--color-wood)] mb-1">{{ store.currentLevel.name }}</p>
      <p class="text-sm text-[var(--color-wood-light)] mb-4">{{ store.currentLevel.desc }}</p>
      <p class="text-xs text-[var(--color-wood-light)]">茶修经验 {{ store.userXp }}</p>
      <div v-if="store.nextLevel" class="mt-3">
        <div class="w-full h-2 bg-[var(--color-paper)] rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-[var(--color-tea-gold)] to-[var(--color-wood)] rounded-full transition-all"
            :style="{ width: `${Math.min(100, (store.userXp / store.xpForNextLevel) * 100)}%` }">
          </div>
        </div>
        <p class="text-xs text-[var(--color-wood-light)] mt-1">
          下一境：{{ store.nextLevel.name }}（{{ store.userXp }}/{{ store.xpForNextLevel }}）
        </p>
      </div>
      <p v-else class="text-xs text-[var(--color-tea-gold)] mt-2">已达至境</p>
    </div>

    <!-- 六境全景 -->
    <div class="mb-6">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3">茶修六境</h3>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <div v-for="(level, i) in TEA_LEVELS" :key="level.id"
          class="glass-panel rounded-xl p-3 text-center transition-all"
          :class="store.userXp >= level.minXp
            ? 'opacity-100'
            : 'opacity-40 grayscale'">
          <p class="text-2xl mb-1">{{ level.icon }}</p>
          <p class="text-xs font-bold text-[var(--color-wood)]">{{ level.name }}</p>
          <p class="text-[10px] text-[var(--color-wood-light)]">{{ level.desc }}</p>
        </div>
      </div>
    </div>

    <!-- 统计 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <div class="glass-panel rounded-xl p-3 text-center">
        <p class="text-lg font-bold text-[var(--color-tea-gold)]">{{ totalTastings }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">总品鉴</p>
      </div>
      <div class="glass-panel rounded-xl p-3 text-center">
        <p class="text-lg font-bold text-[var(--color-tea-gold)]">{{ store.history.length > 0 ? (store.history.reduce((a, r) => a + r.overallScore, 0) / store.history.length).toFixed(1) : '—' }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">平均评分</p>
      </div>
      <div class="glass-panel rounded-xl p-3 text-center">
        <p class="text-lg font-bold text-[var(--color-tea-gold)]">{{ typeCoverage }}%</p>
        <p class="text-xs text-[var(--color-wood-light)]">茶类覆盖</p>
      </div>
      <div class="glass-panel rounded-xl p-3 text-center">
        <p class="text-lg font-bold text-[var(--color-tea-gold)]">{{ unlockedWareCount }}</p>
        <p class="text-xs text-[var(--color-wood-light)]">茶器收藏</p>
      </div>
    </div>

    <!-- 近期茶记 -->
    <div>
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3">📖 近期茶记</h3>
      <div v-if="store.history.length === 0" class="text-center text-[var(--color-wood-light)] py-8">
        <p>还没有品鉴记录</p>
        <button @click="router.push('/select')" class="mt-2 text-[var(--color-tea-gold)] hover:underline">开始品茶</button>
      </div>
      <div v-else class="space-y-2">
        <div v-for="r in store.history.slice(0, 5)" :key="r.id"
          class="glass-panel rounded-xl p-3 text-sm">
          <div class="flex justify-between items-center">
            <div>
              <p class="font-bold text-[var(--color-wood)]">{{ r.teaName }}</p>
              <p class="text-xs text-[var(--color-wood-light)]">
                {{ new Date(r.date).toLocaleDateString() }}
                {{ r.weather || '' }} {{ r.mood || '' }}
              </p>
            </div>
            <span class="text-lg font-bold text-[var(--color-tea-gold)]">{{ r.overallScore }}</span>
          </div>
          <p v-if="r.notes" class="text-xs text-[var(--color-wood-light)] mt-1 italic">"{{ r.notes }}"</p>
        </div>
      </div>
    </div>
  </div>
</template>
