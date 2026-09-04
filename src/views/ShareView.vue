<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TastingCard from '@/components/tasting/TastingCard.vue'
import { parseShareQuery } from '@/services/share'
import type { TastingRecord } from '@/types/tasting'

const route = useRoute()
const router = useRouter()

const share = computed(() => parseShareQuery(route.query.r))

/** 把分享快照还原为完整记录（id/teaId 用只读占位，仅用于卡片展示）。 */
const record = computed<TastingRecord | null>(() => {
  const s = share.value
  if (!s) return null
  return {
    id: 'shared-note',
    teaId: 'shared',
    teaName: s.teaName,
    date: s.date,
    brewTemp: s.brewTemp,
    brewTime: s.brewTime,
    infusions: s.infusions,
    dimensions: { ...s.dimensions },
    overallScore: s.overallScore,
    processFactor: s.processFactor,
    ...(s.aromaType ? { aromaType: s.aromaType } : {}),
    ...(s.notes ? { notes: s.notes } : {}),
    ...(s.weather ? { weather: s.weather } : {}),
    ...(s.mood ? { mood: s.mood } : {}),
  }
})

function goHome() {
  router.push({ name: 'home' })
}
</script>

<template>
  <main class="min-h-screen bg-gradient-to-b from-[var(--color-cream)] to-[var(--color-sand)] px-4 py-12">
    <div v-if="record" class="mx-auto max-w-lg">
      <p class="mb-1 text-center text-xs tracking-[0.28em] text-[var(--color-tea-gold)]">一盏茶 · 品鉴分享</p>
      <h1 class="mb-8 text-center text-2xl font-bold text-[var(--color-wood)]">他人分享的一席茶</h1>

      <TastingCard :record="record" standalone />

      <button type="button" @click="goHome"
        class="mt-6 w-full rounded-xl bg-[var(--color-wood)] py-3 text-sm font-medium text-[var(--color-cream)] transition-colors hover:bg-[var(--color-wood-light)]">
        打开「一盏茶」，亲手泡一壶
      </button>
    </div>

    <div v-else class="mx-auto max-w-md text-center">
      <p class="mb-2 text-lg font-bold text-[var(--color-wood)]">这份品鉴分享无效或已损坏</p>
      <p class="mb-6 text-sm text-[var(--color-wood-light)]">链接可能被截断，或内容已不完整。</p>
      <button type="button" @click="goHome"
        class="rounded-xl bg-[var(--color-wood)] px-6 py-3 text-sm font-medium text-[var(--color-cream)] transition-colors hover:bg-[var(--color-wood-light)]">
        回到首页
      </button>
    </div>
  </main>
</template>
