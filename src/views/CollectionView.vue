<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useTeaStore } from '@/stores/tea'
import { teas, getTeaById } from '@/data/teas'
import { teawares } from '@/data/teawares'
import { SOLAR_TERMS } from '@/data/solarTerms'
import { TeaType } from '@/types/tea'
import type { Tea } from '@/types/tea'
import { encodeTeaShare, buildTeaShareUrl } from '@/services/share'

const router = useRouter()
const store = useTeaStore()

onMounted(() => {
  store.loadHistory()
  store.loadSolarCheckins()
})

// ============ 茶图鉴：全部茶叶 + 解锁状态 ============
const teaJournal = computed(() => {
  const tastedIds = new Set(store.history.map(r => r.teaId))
  return teas.map(t => ({
    tea: t,
    tasted: tastedIds.has(t.id),
    count: store.history.filter(r => r.teaId === t.id).length,
  }))
})

// ============ 节气打卡进度 ============
const solarCheckedCount = computed(() =>
  SOLAR_TERMS.filter(t => store.solarCheckins[t.id]).length,
)

// ============ 分享名茶知识卡 ============
function shareTea(tea: Tea) {
  const data = {
    teaId: tea.id,
    teaName: tea.name,
    teaType: tea.type,
    origin: tea.origin,
    flavor: tea.flavor,
    description: tea.description,
    story: tea.story,
  }
  const url = buildTeaShareUrl(encodeTeaShare(data))
  window.open(url, '_blank', 'noopener')
}

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
  if (store.history.length === 0) return '—'
  const sum = store.history.reduce((a, r) => a + r.overallScore, 0)
  return (sum / store.history.length).toFixed(1)
})

const bestScore = computed(() => {
  if (store.history.length === 0) return '—'
  return Math.max(...store.history.map(r => r.overallScore))
})

// ============ 已解锁茶器 ============
const unlockedWares = computed(() =>
  teawares.filter(w => store.isTeaWareUnlocked(w.id)),
)

// 茶图加载失败记录：茶图鉴降级为渐变色块；茶器图降级为 lucide 图标（key 用 ware.id）
const imgFailed = reactive<Record<string, boolean>>({})
const wareImgFailed = reactive<Record<string, boolean>>({})
function markImgFailed(id: string) { imgFailed[id] = true }
function markWareImgFailed(id: string) { wareImgFailed[id] = true }
</script>

<template>
  <div class="min-h-[100dvh] p-4 sm:p-8">
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

    <!-- 茶图鉴 -->
    <div class="mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-1"><IconBookOpen class="inline-block -mt-1 w-4 h-4" /> 茶图鉴</h3>
      <p class="text-xs text-[var(--color-wood-light)] mb-3">已解锁 {{ tastedCount }} / {{ totalTeas }} 款 · 品鉴一款茶即点亮茶卡</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div v-for="item in teaJournal" :key="item.tea.id"
          class="relative rounded-xl p-3 text-center cursor-pointer transition-transform hover:scale-[1.02]"
          :class="item.tasted ? 'glass-panel' : 'bg-white/40 border-2 border-dashed border-[#d8cfc0]'"
          @click="router.push(`/tea/${item.tea.id}`)">
          <template v-if="item.tasted">
            <img v-if="item.tea.image && !imgFailed[item.tea.id]" :src="item.tea.image" loading="lazy"
              @error="markImgFailed(item.tea.id)" class="w-full h-16 rounded-lg object-cover mb-2" :alt="item.tea.name" />
            <div v-else class="w-full h-16 rounded-lg mb-2"
              :style="{ background: `linear-gradient(135deg, ${item.tea.soupColorMin}, ${item.tea.soupColorMax})` }"></div>
          </template>
          <div v-else class="w-full h-16 rounded-lg mb-2"
            :style="{ background: 'repeating-linear-gradient(45deg, #e8e2d8, #e8e2d8 6px, #f0ebe2 6px, #f0ebe2 12px)' }">
          </div>
          <p class="text-sm font-bold" :class="item.tasted ? 'text-[var(--color-wood)]' : 'text-[#8a8070]'">
            {{ item.tea.name }}
          </p>
          <p class="text-xs" :class="item.tasted ? 'text-[var(--color-wood-light)]' : 'text-[#b5ac9c]'">
            {{ item.tasted ? `${item.tea.type} · ${item.tea.origin}${item.count > 1 ? ` · 品${item.count}次` : ''}` : `${item.tea.type} · 未品鉴` }}
          </p>
          <button v-if="item.tasted" type="button" @click="shareTea(item.tea)"
            class="absolute right-2 top-2 rounded-full bg-[var(--color-tea-gold)]/15 px-2 py-0.5 text-[10px] text-[var(--color-wood)] transition-colors hover:bg-[var(--color-tea-gold)]/30">
            分享 ↗
          </button>
        </div>
      </div>
    </div>

    <!-- 节气打卡 -->
    <div class="mb-8">
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-1"><IconSun class="inline-block -mt-1 w-4 h-4" /> 节气册</h3>
      <p class="text-xs text-[var(--color-wood-light)] mb-3">已集 {{ solarCheckedCount }} / {{ SOLAR_TERMS.length }} 个节气 · 每个节气可在首页打卡一次</p>
      <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
        <div v-for="t in SOLAR_TERMS" :key="t.id"
          class="rounded-lg p-2 text-center"
          :class="store.solarCheckins[t.id] ? 'glass-panel' : 'bg-white/40 border border-dashed border-[#d8cfc0]'">
          <p class="text-xs font-bold" :class="store.solarCheckins[t.id] ? 'text-[var(--color-wood)]' : 'text-[#b5ac9c]'">{{ t.name }}</p>
          <p class="text-[10px] leading-none mt-0.5"><IconCheck v-if="store.solarCheckins[t.id]" class="inline-block w-3 h-3 text-[var(--color-tea-gold)]" /><span v-else>·</span></p>
        </div>
      </div>
    </div>

    <!-- 已解锁茶器 -->
    <div>
      <h3 class="text-base font-bold text-[var(--color-wood)] mb-3"><IconCupSoda class="inline-block -mt-1 w-4 h-4" /> 我的茶器</h3>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <div v-for="ware in unlockedWares" :key="ware.id"
          class="glass-panel rounded-xl p-3 text-center">
          <img v-if="ware.image && !wareImgFailed[ware.id]" :src="ware.image" loading="lazy"
            @error="markWareImgFailed(ware.id)" class="w-12 h-12 object-cover rounded-full mx-auto mb-1" :alt="ware.name" />
          <component v-else :is="`Icon${ware.icon}`" class="w-8 h-8 mx-auto mb-1 text-[var(--color-tea-gold)]" />
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
