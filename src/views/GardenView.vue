<script setup lang="ts">
/**
 * 茶园页面（编排层）
 * T4.1 养成降级为纯观赏后：/garden 地区选择，/garden/:regionId 3D 茶园景观
 * 保留：3D 场景 / 天气切换 / 环境音 / 茶亭叙事；删除：种茶/浇水/修剪/采摘等养成链路。
 */
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRegionById } from '@/data/gardenRegions'
import type { GardenRegion } from '@/types/garden'
import type { WeatherMode } from '@/components/three/garden-weather'
import TeaGardenScene3D from '@/components/three/TeaGardenScene3D.vue'
import GardenRegionPicker from './garden/GardenRegionPicker.vue'

const route = useRoute()
const router = useRouter()

const regionId = computed(() => route.params.regionId as string | undefined)
const currentRegion = computed<GardenRegion | undefined>(() =>
  regionId.value ? getRegionById(regionId.value) : undefined
)

const scene3dRef = ref<{ setWeather?: (m: WeatherMode) => void; setAudioEnabled?: (on: boolean) => void }>()
const weatherMode = ref<'sunny' | 'rain'>('sunny')
const audioOn = ref(false)

function toggleWeather() {
  weatherMode.value = weatherMode.value === 'sunny' ? 'rain' : 'sunny'
  scene3dRef.value?.setWeather?.(weatherMode.value)
}
function toggleAudio() {
  audioOn.value = !audioOn.value
  scene3dRef.value?.setAudioEnabled?.(audioOn.value)
}

/** 茶亭叙事：四园古籍引文 */
const PAVILION_QUOTES: Record<string, { text: string; source: string }> = {
  hangzhou: { text: '上者生烂石，中者生砾壤，下者生黄土', source: '陆羽《茶经·一之源》' },
  wuyishan: { text: '园植北山之阳，厥土赤坟，茶生其间', source: '宋子安《东溪试茶录》' },
  yunnan: { text: '茶者，南方之嘉木也', source: '陆羽《茶经·一之源》' },
  fuding: { text: '一年茶，三年药，七年宝', source: '福鼎白茶茶谚' },
}
const showPavilion = ref(false)
const pavilionQuote = computed(() => (regionId.value ? PAVILION_QUOTES[regionId.value] : undefined))
function togglePavilion() { showPavilion.value = !showPavilion.value }
</script>

<template>
  <!-- 地区选择 -->
  <GardenRegionPicker v-if="!regionId" />

  <!-- 3D 茶园（纯观赏：plants 恒空，3D 场景以预设景观呈现） -->
  <div v-else-if="currentRegion" class="region-garden-3d">
    <TeaGardenScene3D ref="scene3dRef" :plants="[]" :region-id="regionId"
      @select-pavilion="togglePavilion" />

    <!-- 顶栏 -->
    <div class="garden-topbar-3d">
      <button class="back-btn-3d" @click="router.push('/garden')">
        <IconArrowLeft :size="18" /><span>茶园</span>
      </button>
      <div class="garden-title-area-3d">
        <h1 class="garden-name-3d font-serif">{{ currentRegion.name }}</h1>
      </div>
      <div class="topbar-actions-3d">
        <button class="ambient-btn-3d" :class="{ active: weatherMode === 'rain' }" @click="toggleWeather"
          :title="weatherMode === 'rain' ? '切换到晴天' : '切换到雨天'">
          <IconCloudRain v-if="weatherMode === 'rain'" :size="18" />
          <IconSun v-else :size="18" />
        </button>
        <button class="ambient-btn-3d" :class="{ active: audioOn }" @click="toggleAudio"
          :title="audioOn ? '关闭环境音' : '开启环境音'">
          <IconVolume2 v-if="audioOn" :size="18" />
          <IconVolumeX v-else :size="18" />
        </button>
      </div>
    </div>

    <!-- 茶亭浮层 -->
    <Transition name="pavilion">
      <div v-if="showPavilion && pavilionQuote" class="pavilion-panel" @click="togglePavilion">
        <p class="pavilion-quote">“{{ pavilionQuote.text }}”</p>
        <p class="pavilion-source">—— {{ pavilionQuote.source }}</p>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.region-garden-3d {
  position: relative; width: 100vw; height: 100vh;
  overflow: hidden; background: #87a5c4;
}
.garden-topbar-3d {
  position: absolute; top: 0; left: 0; right: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.5rem;
  background: rgba(13, 20, 16, 0.35);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(245, 241, 230, 0.1);
}
.back-btn-3d {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: rgba(255,255,255,0.1); border: 1px solid rgba(245,241,230,0.2);
  color: #f5f1e6; padding: 0.65rem 1rem; min-height: 44px; border-radius: 999px;
  font-size: 0.85rem; cursor: pointer; transition: background 0.2s; font-family: inherit;
}
.back-btn-3d:hover { background: rgba(255,255,255,0.2); }
.garden-title-area-3d { text-align: center; flex: 1; min-width: 0; padding: 0 0.5rem; }
.garden-name-3d {
  font-size: 1.15rem; font-weight: 500; margin: 0; color: #f5f1e6;
  letter-spacing: 0.08em; text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}
.topbar-actions-3d { display: flex; gap: 0.5rem; align-items: center; }
.ambient-btn-3d {
  background: rgba(20,30,24,0.55); border: 1px solid rgba(245,241,230,0.25);
  color: rgba(245,241,230,0.9); width: 2.75rem; height: 2.75rem;
  min-width: 44px; min-height: 44px; border-radius: 999px; font-size: 0.95rem;
  cursor: pointer; backdrop-filter: blur(8px);
  transition: background 0.2s, border-color 0.2s; font-family: inherit;
  display: flex; align-items: center; justify-content: center;
}
.ambient-btn-3d:hover { background: rgba(40,56,44,0.7); border-color: rgba(245,241,230,0.5); }
.ambient-btn-3d.active { background: rgba(201,169,110,0.85); border-color: transparent; }

.pavilion-panel {
  position: absolute; top: 5.5rem; right: 1.5rem; z-index: 12;
  max-width: 320px; padding: 1.1rem 1.3rem;
  background: rgba(10, 16, 12, 0.72);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(201, 169, 110, 0.35);
  border-left: 3px solid rgba(201, 169, 110, 0.8);
  border-radius: 4px; cursor: pointer; transition: border-color 0.2s;
}
.pavilion-panel:hover { border-color: rgba(201, 169, 110, 0.7); }
.pavilion-quote { margin: 0 0 0.4rem; font-size: 0.95rem; line-height: 1.7; color: #f5f1e6; letter-spacing: 0.05em; }
.pavilion-source { margin: 0; font-size: 0.72rem; color: rgba(201, 169, 110, 0.85); letter-spacing: 0.12em; text-align: right; }
.pavilion-enter-active, .pavilion-leave-active { transition: opacity 0.25s, transform 0.25s; }
.pavilion-enter-from, .pavilion-leave-to { opacity: 0; transform: translateY(-6px); }

@media (max-width: 600px) {
  .garden-topbar-3d { padding: 0.7rem 0.8rem; gap: 0.4rem; }
  .garden-name-3d { font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .back-btn-3d { padding: 0.55rem 0.7rem; }
  .back-btn-3d span { display: none; }
  .pavilion-panel { top: 5rem; right: 0.8rem; left: 0.8rem; max-width: none; }
}
</style>
