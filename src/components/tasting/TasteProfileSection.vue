<script setup lang="ts">
/**
 * 口味画像区块：从品鉴记录提炼
 * - 茶类偏好（次数 + 均分条形）
 * - 风味偏好标签
 * - 八维口感雷达（复用 TasteRadarChart）
 * - 个人茶语推荐
 *
 * 计算逻辑在 services/tasteProfile.ts（纯函数，已单测）。
 */
import { computed } from 'vue'
import TasteRadarChart from './TasteRadarChart.vue'
import { buildTypeStats, buildFlavorStats, buildAvgDimensions, buildPersonalTip } from '@/services/tasteProfile'
import type { TastingRecord } from '@/types/tasting'

const props = defineProps<{
  history: TastingRecord[]
}>()

const typeStats = computed(() => buildTypeStats(props.history))
const flavorStats = computed(() => buildFlavorStats(props.history))
const avgDimensions = computed<Record<string, number>>(() => buildAvgDimensions(props.history))
const personalTip = computed(() => buildPersonalTip(props.history))
</script>

<template>
  <section class="mb-6">
    <h3 class="text-base font-bold text-[var(--color-wood)] mb-1">👤 我的口味画像</h3>
    <p class="text-xs text-[var(--color-wood-light)] mb-3">从品鉴记录中提炼的个人风味偏好</p>

    <div v-if="history.length > 0" class="glass-panel rounded-2xl p-4 mb-3">
      <p class="text-sm text-[var(--color-wood)]">💡 {{ personalTip }}</p>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <!-- 茶类偏好 -->
      <div class="glass-panel rounded-xl p-4">
        <p class="text-sm font-bold text-[var(--color-wood)] mb-3">茶类偏好</p>
        <div v-if="history.length === 0" class="text-xs text-[var(--color-wood-light)]">品鉴后解锁</div>
        <div v-else class="space-y-2">
          <div v-for="s in typeStats" :key="s.type" class="flex items-center gap-2 text-xs">
            <span class="w-8 text-[var(--color-wood-light)] shrink-0">{{ s.type }}</span>
            <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--color-paper)]">
              <div class="h-full rounded-full bg-gradient-to-r from-[var(--color-tea-gold)] to-[var(--color-wood)]"
                :style="{ width: `${s.pct}%` }"></div>
            </div>
            <span class="w-16 shrink-0 text-right text-[var(--color-wood)]">{{ s.count }} 次{{ s.avg ? ` · ${s.avg}分` : '' }}</span>
          </div>
        </div>
      </div>

      <!-- 风味偏好 -->
      <div class="glass-panel rounded-xl p-4">
        <p class="text-sm font-bold text-[var(--color-wood)] mb-3">风味偏好</p>
        <div v-if="flavorStats.length === 0" class="text-xs text-[var(--color-wood-light)]">品鉴后解锁</div>
        <div v-else class="flex flex-wrap gap-2">
          <span v-for="([f, n]) in flavorStats" :key="f"
            class="rounded-full px-3 py-1 text-xs text-[var(--color-wood)]" style="background: rgba(201,169,110,.15)">
            {{ f }} ×{{ n }}
          </span>
        </div>
      </div>
    </div>

    <!-- 口感雷达 -->
    <div v-if="history.length > 0" class="glass-panel mt-3 rounded-xl p-4">
      <p class="mb-2 text-sm font-bold text-[var(--color-wood)]">口感画像</p>
      <div class="flex justify-center">
        <TasteRadarChart :current-dimensions="avgDimensions" :show-comparison="false" :size="260" />
      </div>
    </div>
  </section>
</template>
