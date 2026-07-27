<script setup lang="ts">
import { ref, computed } from 'vue'
import { TEA_REGIONS, type TeaRegion } from '@/data/teaRegions'

const selectedProvince = ref<string | null>(null)
const selectedRegion = ref<TeaRegion | null>(null)

const provinces = computed(() => {
  const map = new Map<string, TeaRegion[]>()
  for (const r of TEA_REGIONS) {
    if (!map.has(r.province)) map.set(r.province, [])
    map.get(r.province)!.push(r)
  }
  return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
})

const filteredRegions = computed(() => {
  if (!selectedProvince.value) return TEA_REGIONS
  return TEA_REGIONS.filter(r => r.province === selectedProvince.value)
})

function selectRegion(r: TeaRegion) {
  selectedRegion.value = r
}
</script>

<template>
  <div class="min-h-screen p-4 sm:p-8">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-3xl font-bold text-[var(--color-wood)]">🍃 中国茶地图</h2>
      <button @click="$router.push('/')" class="text-[var(--color-wood-light)] hover:text-[var(--color-wood)]">返回</button>
    </div>

    <!-- 省份统计 -->
    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 mb-8">
      <button v-for="[prov, regions] in provinces" :key="prov"
        @click="selectedProvince = selectedProvince === prov ? null : prov"
        class="glass-panel rounded-xl p-2 text-center transition-all text-xs"
        :class="selectedProvince === prov
          ? 'bg-[var(--color-wood)] text-[var(--color-cream)] scale-105'
          : 'text-[var(--color-wood)] hover:shadow-md'">
        <p class="font-bold">{{ prov }}</p>
        <p class="text-[10px] opacity-70">{{ regions.length }} 产区</p>
      </button>
    </div>

    <!-- 地图区域（SVG China outline with positioned dots）-->
    <div class="relative w-full max-w-3xl mx-auto mb-8">
      <svg viewBox="0 0 600 500" class="w-full h-auto opacity-80">
        <!-- 中国轮廓简化版 -->
        <path d="M300 30 L400 40 L450 60 L480 90 L500 120 L520 150 L530 180 L510 200 L490 220 L470 240 L450 260 L430 280 L400 300 L370 320 L340 340 L310 360 L280 370 L250 360 L220 340 L200 320 L180 300 L160 280 L140 260 L120 240 L100 220 L80 200 L70 180 L90 160 L110 140 L130 120 L150 100 L170 80 L200 60 L230 45 L260 35 Z"
          fill="none" stroke="var(--color-tea-gold)" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.5"/>
        <path d="M300 30 L400 40 L450 60 L480 90 L500 120 L520 150 L530 180 L510 200 L490 220 L470 240 L450 260 L430 280 L410 290 L390 300 L370 310 L350 320 L330 330 L310 340 L290 345 L270 340 L250 330 L230 320 L210 310 L190 300 L170 290 L150 280 L130 270 L110 250 L95 230 L80 210 L70 190 L65 170 L75 150 L90 135 L110 120 L130 105 L155 90 L180 75 L210 60 L240 48 L270 38 Z"
          fill="rgba(158,128,80,0.05)" stroke="var(--color-tea-gold)" stroke-width="1.5"/>

        <!-- 产区圆点 -->
        <g v-for="r in filteredRegions" :key="r.id">
          <circle :cx="getCx(r.province)" :cy="getCy(r.province)" r="5"
            fill="var(--color-tea-gold)" opacity="0.7"
            class="cursor-pointer hover:opacity-100 hover:r-7 transition-all"
            @click="selectRegion(r)"/>
        </g>
      </svg>
    </div>

    <!-- 产区列表 -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="r in filteredRegions" :key="r.id"
        @click="selectRegion(r)"
        class="glass-panel rounded-xl p-4 cursor-pointer transition-all hover:shadow-md"
        :class="selectedRegion?.id === r.id ? 'border-[var(--color-tea-gold)] border' : ''">
        <div class="flex items-start justify-between mb-2">
          <div>
            <h3 class="text-base font-bold text-[var(--color-wood)]">{{ r.name }}</h3>
            <p class="text-xs text-[var(--color-wood-light)]">{{ r.province }} · {{ r.altitude }}</p>
          </div>
          <span class="text-xs bg-[var(--color-tea-gold)]/20 text-[var(--color-tea-gold)] px-2 py-0.5 rounded-full whitespace-nowrap">
            {{ r.climate.split('，')[0] }}
          </span>
        </div>
        <p class="text-xs text-[var(--color-wood)]/70 mb-2">{{ r.description.slice(0, 60) }}…</p>
        <div class="flex flex-wrap gap-1">
          <span v-for="tea in r.famousFor" :key="tea"
            class="text-[10px] px-2 py-0.5 bg-[var(--color-paper)] text-[var(--color-wood)] rounded-full">
            {{ tea }}
          </span>
        </div>
      </div>
    </div>

    <!-- 产区详情弹窗 -->
    <Teleport to="body">
      <div v-if="selectedRegion"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        @click.self="selectedRegion = null">
        <div class="glass-panel rounded-2xl p-6 max-w-md mx-4 max-h-[80vh] overflow-y-auto">
          <div class="flex justify-between items-start mb-4">
            <h3 class="text-xl font-bold text-[var(--color-wood)]">{{ selectedRegion.name }}</h3>
            <button @click="selectedRegion = null" class="text-[var(--color-wood-light)]">✕</button>
          </div>
          <div class="space-y-3 text-sm">
            <div class="grid grid-cols-2 gap-2">
              <div class="bg-[var(--color-paper)] rounded-lg p-2 text-center">
                <p class="text-xs text-[var(--color-wood-light)]">省份</p>
                <p class="font-bold text-[var(--color-wood)]">{{ selectedRegion.province }}</p>
              </div>
              <div class="bg-[var(--color-paper)] rounded-lg p-2 text-center">
                <p class="text-xs text-[var(--color-wood-light)]">海拔</p>
                <p class="font-bold text-[var(--color-wood)]">{{ selectedRegion.altitude }}</p>
              </div>
              <div class="bg-[var(--color-paper)] rounded-lg p-2 text-center">
                <p class="text-xs text-[var(--color-wood-light)]">气候</p>
                <p class="font-bold text-[var(--color-wood)] text-xs">{{ selectedRegion.climate }}</p>
              </div>
              <div class="bg-[var(--color-paper)] rounded-lg p-2 text-center">
                <p class="text-xs text-[var(--color-wood-light)]">土壤</p>
                <p class="font-bold text-[var(--color-wood)] text-xs">{{ selectedRegion.soil }}</p>
              </div>
            </div>
            <p class="text-[var(--color-wood)] leading-relaxed">{{ selectedRegion.description }}</p>
            <div>
              <p class="text-xs text-[var(--color-wood-light)] mb-1">代表茶品：</p>
              <div class="flex flex-wrap gap-1">
                <span v-for="t in selectedRegion.famousFor" :key="t"
                  class="px-2 py-0.5 text-xs bg-[var(--color-tea-gold)]/20 text-[var(--color-tea-gold)] rounded">
                  {{ t }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
// 省份坐标映射（简化版，用于 SVG 定位）
const COORDS: Record<string, [number, number]> = {
  '浙江': [420, 220], '江苏': [410, 190], '安徽': [400, 200],
  '福建': [420, 260], '广东': [410, 300], '云南': [320, 320],
  '湖南': [370, 270], '湖北': [370, 240], '四川': [300, 230],
  '贵州': [330, 280], '广西': [380, 310], '江西': [410, 250],
  '河南': [390, 180], '山东': [430, 140], '陕西': [350, 180],
  '海南': [400, 360], '台湾': [480, 280], '日本': [520, 180],
  '甘肃': [300, 150], '西藏': [200, 240],
}

export function getCx(province: string): number {
  return COORDS[province]?.[0] ?? 300
}
export function getCy(province: string): number {
  return COORDS[province]?.[1] ?? 200
}
</script>
