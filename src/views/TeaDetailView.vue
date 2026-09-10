<script setup lang="ts">
/**
 * 茶叶详情页：把每款茶的知识做深。
 * - 完整来历故事（story 字段，核心深度）
 * - 风味解析 / 干茶与汤色
 * - 冲泡详解（参数 + 为什么）
 * - 相似茶推荐
 */
import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getTeaById } from '@/data/teas'
import { getSimilarTeas } from '@/services/teaRecommend'
import { encodeTeaShare, buildTeaShareUrl } from '@/services/share'
import { gardenRegions } from '@/data/gardenRegions'
import type { Tea } from '@/types/tea'

const route = useRoute()
const router = useRouter()

const tea = computed<Tea | null>(() => getTeaById(String(route.params.id)) ?? null)

/** 产区风土：按 teaIds 反查归属产区（无归属返回 undefined，不渲染板块，不编造风土） */
const region = computed(() =>
  tea.value ? gardenRegions.find(r => r.teaIds.includes(tea.value!.id)) : undefined,
)

const similarTeas = computed(() => (tea.value ? getSimilarTeas(tea.value.id) : []))

// 茶图加载失败记录：Hero 降级为纯渐变、相似茶卡降级为渐变色块
const imgFailed = reactive<Record<string, boolean>>({})
function markImgFailed(id: string) { imgFailed[id] = true }

/** 冲泡建议文案：根据茶类给"为什么这样泡" */
function getBrewAdvice(t: Tea): string {
  const map: Record<string, string> = {
    绿茶: `绿茶芽叶细嫩，${t.bestTemp}°C 低温冲泡避免烫熟茶叶、保留鲜爽；首泡 ${t.bestTime}s 出汤，可冲 ${t.infusions} 泡。`,
    白茶: `白茶不炒不揉，${t.bestTemp}°C 中温水激发毫香；首泡 ${t.bestTime}s，可冲 ${t.infusions} 泡，老白茶可煮饮。`,
    黄茶: `黄茶轻发酵，${t.bestTemp}°C 冲泡；首泡 ${t.bestTime}s，可冲 ${t.infusions} 泡，口感甜醇。`,
    青茶: `乌龙茶半发酵，${t.bestTemp}°C 高温激发香气；首泡 ${t.bestTime}s 快出汤，可冲 ${t.infusions} 泡，每泡递增 5-10s。`,
    红茶: `红茶全发酵，${t.bestTemp}°C 冲泡；首泡 ${t.bestTime}s，可冲 ${t.infusions} 泡，甜香温润。`,
    黑茶: `黑茶后发酵，${t.bestTemp}°C 高温醒茶；首泡 ${t.bestTime}s，可冲 ${t.infusions} 泡，越泡越醇。`,
  }
  return map[t.type] ?? `${t.bestTemp}°C 冲泡，首泡 ${t.bestTime}s，可冲 ${t.infusions} 泡。`
}

function startBrewing() {
  router.push('/select')
}

function goSynesthesia() {
  if (tea.value) router.push(`/synesthesia/${tea.value.id}`)
}

function shareTea() {
  if (!tea.value) return
  const data = {
    teaId: tea.value.id,
    teaName: tea.value.name,
    teaType: tea.value.type,
    origin: tea.value.origin,
    flavor: tea.value.flavor,
    description: tea.value.description,
    story: tea.value.story,
  }
  window.open(buildTeaShareUrl(encodeTeaShare(data)), '_blank', 'noopener')
}
</script>

<template>
  <div v-if="tea" class="min-h-[100dvh] pb-16">
    <!-- 顶部 Hero：汤色渐变 + 茶图背景（加载失败时保持纯渐变） -->
    <header class="relative overflow-hidden px-4 pt-10 pb-8"
      :style="{ background: `linear-gradient(160deg, ${tea.soupColorMin} 0%, ${tea.soupColorMax} 100%)` }">
      <img v-if="tea.image && !imgFailed[tea.id]" :src="tea.image" loading="lazy" @error="markImgFailed(tea.id)"
        class="absolute inset-0 h-full w-full object-cover" alt="" aria-hidden="true" />
      <div v-if="tea.image && !imgFailed[tea.id]" class="absolute inset-0"
        :style="{ background: 'linear-gradient(160deg, rgba(255,255,255,0.75), rgba(255,255,255,0.85))' }"></div>
      <div class="relative mx-auto max-w-2xl">
        <button @click="router.back()" class="mb-4 inline-flex min-h-11 items-center text-sm text-[var(--color-wood)]/70 hover:text-[var(--color-wood)]">← 返回</button>
        <p class="text-xs tracking-[0.3em] text-[var(--color-wood)]/60">{{ tea.type }} · {{ tea.process }}</p>
        <h1 class="mt-2 text-4xl font-bold font-serif text-[var(--color-wood)]">{{ tea.name }}</h1>
        <p class="mt-2 text-sm text-[var(--color-wood)]/70">{{ tea.origin }} · 海拔 {{ tea.altitude }}</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <span v-for="f in tea.flavor" :key="f"
            class="rounded-full bg-white/50 px-3 py-1 text-xs text-[var(--color-wood)]">{{ f }}</span>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-2xl px-4">
      <!-- 来历故事（核心深度） -->
      <section class="mt-6">
        <h2 class="mb-3 text-lg font-bold text-[var(--color-wood)]"><IconScrollText class="inline-block -mt-1 w-5 h-5" /> 来历故事</h2>
        <div class="glass-panel rounded-2xl p-5">
          <p class="text-sm leading-8 text-[var(--color-wood)]">{{ tea.story }}</p>
        </div>
      </section>

      <!-- 产区风土（有产区归属时显示，数据来自 gardenRegions） -->
      <section v-if="region" class="mt-6">
        <h2 class="mb-3 text-lg font-bold text-[var(--color-wood)]"><IconMountain class="inline-block -mt-1 w-5 h-5" /> 产区风土</h2>
        <div class="glass-panel rounded-2xl p-5">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: region.accentColor }"></span>
            <span class="text-sm font-semibold text-[var(--color-wood)]">{{ region.name }}</span>
            <span class="rounded-full bg-[var(--color-paper)] px-2 py-0.5 text-xs text-[var(--color-wood)]">{{ region.teaArea }}</span>
          </div>
          <p class="text-sm leading-7 text-[var(--color-wood)]">{{ region.description }}</p>
          <p class="mt-2 text-xs leading-5 text-[var(--color-wood-light)]">{{ region.climate }}</p>
        </div>
      </section>

      <!-- 风味与汤色 -->
      <section class="mt-6">
        <h2 class="mb-3 text-lg font-bold text-[var(--color-wood)]"><IconLeaf class="inline-block -mt-1 w-5 h-5" /> 风味解析</h2>
        <div class="glass-panel rounded-2xl p-5">
          <p class="text-sm leading-7 text-[var(--color-wood)]">{{ tea.description }}</p>
          <div class="mt-4 flex items-center gap-4">
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-full border border-[var(--color-tea-gold)]/40"
                :style="{ background: tea.dryTeaColor }"></div>
              <span class="text-xs text-[var(--color-wood-light)]">干茶</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="h-8 w-8 rounded-full border border-[var(--color-tea-gold)]/40"
                :style="{ background: `linear-gradient(135deg, ${tea.soupColorMin}, ${tea.soupColorMax})` }"></div>
              <span class="text-xs text-[var(--color-wood-light)]">汤色</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 冲泡详解 -->
      <section class="mt-6">
        <h2 class="mb-3 text-lg font-bold text-[var(--color-wood)]"><IconCupSoda class="inline-block -mt-1 w-5 h-5" /> 冲泡详解</h2>
        <div class="glass-panel rounded-2xl p-5">
          <div class="grid grid-cols-3 gap-3 text-center">
            <div>
              <p class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ tea.bestTemp }}°C</p>
              <p class="text-xs text-[var(--color-wood-light)]">水温</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ tea.bestTime }}s</p>
              <p class="text-xs text-[var(--color-wood-light)]">首泡</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-[var(--color-tea-gold)]">{{ tea.infusions }}</p>
              <p class="text-xs text-[var(--color-wood-light)]">可冲泡</p>
            </div>
          </div>
          <p class="mt-4 text-sm leading-7 text-[var(--color-wood-light)]">{{ getBrewAdvice(tea) }}</p>
        </div>
      </section>

      <!-- 相似茶推荐 -->
      <section v-if="similarTeas.length > 0" class="mt-6">
        <h2 class="mb-3 text-lg font-bold text-[var(--color-wood)]"><IconShare2 class="inline-block -mt-1 w-5 h-5" /> 同类好茶</h2>
        <div class="grid grid-cols-3 gap-3">
          <button v-for="t in similarTeas" :key="t.id"
            @click="router.push(`/tea/${t.id}`)"
            class="glass-panel rounded-xl p-3 text-left transition-transform hover:scale-[1.02]">
            <img v-if="t.image && !imgFailed[t.id]" :src="t.image" loading="lazy" @error="markImgFailed(t.id)"
              class="mb-2 h-16 w-full rounded-lg object-cover" :alt="t.name" />
            <div v-else class="mb-2 h-16 rounded-lg"
              :style="{ background: `linear-gradient(135deg, ${t.soupColorMin}, ${t.soupColorMax})` }"></div>
            <p class="text-sm font-bold text-[var(--color-wood)]">{{ t.name }}</p>
            <p class="text-xs text-[var(--color-wood-light)]">{{ t.origin }}</p>
          </button>
        </div>
      </section>

      <!-- 底部操作 -->
      <button @click="goSynesthesia"
        class="mt-8 w-full rounded-xl border border-[var(--color-tea-gold)]/40 bg-gradient-to-r from-[var(--color-tea-gold)]/10 to-transparent py-3.5 text-sm font-medium text-[var(--color-wood)] transition-all hover:from-[var(--color-tea-gold)]/20">
        <IconMusic class="inline-block -mt-1 w-4 h-4" /> 听这款茶的味道 · 30秒通感体验
      </button>
      <div class="mt-3 flex gap-3">
        <button @click="startBrewing"
          class="flex-1 rounded-xl bg-[var(--color-wood)] py-3 text-sm font-medium text-[var(--color-cream)] transition-colors hover:bg-[var(--color-wood-light)]">
          开始品鉴这泡茶
        </button>
        <button @click="shareTea"
          class="rounded-xl border border-[var(--color-tea-gold)] px-5 py-3 text-sm text-[var(--color-wood)] transition-colors hover:bg-white/70">
          分享 ↗
        </button>
      </div>
    </main>
  </div>

  <!-- 茶不存在 -->
  <div v-else class="flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center">
    <p class="mb-2 text-lg font-bold text-[var(--color-wood)]">这款茶不存在</p>
    <p class="mb-6 text-sm text-[var(--color-wood-light)]">链接可能有误，或这款茶还未收录。</p>
    <button @click="router.push('/')"
      class="rounded-xl bg-[var(--color-wood)] px-6 py-3 text-sm text-[var(--color-cream)]">回到首页</button>
  </div>
</template>
