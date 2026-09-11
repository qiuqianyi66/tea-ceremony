<script setup lang="ts">
/**
 * 茶园页面（编排层）
 * /garden：地区选择 -> GardenRegionPicker
 * /garden/:regionId：3D茶园 + 顶栏 + 植物列表 + 弹窗
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getRegionById } from '@/data/gardenRegions'
import { getTeaById } from '@/data/teas'
import {
  plantTea, waterPlant, prunePlant, harvestPlant, getPlantsByRegion,
  getGrowthStage, getGrowthStageInfo, getCurrentWaterLevel,
  getPlantDays, isGrowthPaused, refreshAllPlantStatuses, syncPendingGarden,
} from '@/services/garden'
import type { PlantedTea, GardenRegion } from '@/types/garden'
import type { Tea } from '@/types/tea'
import type { WeatherMode } from '@/components/three/garden-weather'
import TeaGardenScene3D from '@/components/three/TeaGardenScene3D.vue'
import GardenRegionPicker from './garden/GardenRegionPicker.vue'
import PlantDialog from './garden/PlantDialog.vue'
import PlantDetailDialog from './garden/PlantDetailDialog.vue'

const route = useRoute()
const router = useRouter()

const regionId = computed(() => route.params.regionId as string | undefined)
const currentRegion = computed<GardenRegion | undefined>(() =>
  regionId.value ? getRegionById(regionId.value) : undefined
)

const plants = ref<PlantedTea[]>([])
const showPlantDialog = ref(false)
const showPlantDetail = ref(false)
const selectedPlant = ref<PlantedTea | null>(null)
const loading = ref(true)

const scene3dRef = ref<{ playWater?: (id: number) => void; setWeather?: (m: WeatherMode) => void; setAudioEnabled?: (on: boolean) => void }>()
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

const regionTeas = computed<Tea[]>(() => {
  if (!currentRegion.value) return []
  return currentRegion.value.teaIds
    .map(id => getTeaById(id))
    .filter((t): t is Tea => t !== undefined)
})

const matureCount = computed(() => plants.value.filter(p => getGrowthStage(p) === 'mature').length)

async function loadPlants() {
  if (!regionId.value) return
  loading.value = true
  await refreshAllPlantStatuses()
  plants.value = await getPlantsByRegion(regionId.value)
  loading.value = false
  void syncPendingGarden()
}

function openPlantDialog() { showPlantDialog.value = true }
function closePlantDialog() { showPlantDialog.value = false }

async function confirmPlant(teaId: string) {
  if (!regionId.value) return
  await plantTea(regionId.value, teaId)
  showPlantDialog.value = false
  await loadPlants()
}

function openPlantDetail(plant: PlantedTea) {
  selectedPlant.value = plant
  showPlantDetail.value = true
}
function closePlantDetail() {
  showPlantDetail.value = false
  selectedPlant.value = null
}

function onSelectPlant3D(id: number) {
  const plant = plants.value.find(p => p.id === id)
  if (plant) openPlantDetail(plant)
}

async function doWater() {
  if (!selectedPlant.value?.id) return
  scene3dRef.value?.playWater?.(selectedPlant.value.id)
  closePlantDetail()
  try { await waterPlant(selectedPlant.value.id) }
  catch (e) { console.warn('[GardenView] 浇水同步失败（离线？）', e) }
  await loadPlants()
}

async function doHarvest() {
  if (!selectedPlant.value?.id) return
  await harvestPlant(selectedPlant.value.id)
  await loadPlants()
  const updated = plants.value.find(p => p.id === selectedPlant.value?.id)
  if (updated) selectedPlant.value = updated
}

async function doPrune() {
  if (!selectedPlant.value?.id) return
  await prunePlant(selectedPlant.value.id)
  await loadPlants()
  const updated = plants.value.find(p => p.id === selectedPlant.value?.id)
  if (updated) selectedPlant.value = updated
}

function getPlantTea(plant: PlantedTea): Tea | undefined {
  return getTeaById(plant.teaId)
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

onMounted(() => { if (regionId.value) loadPlants() })
</script>

<template>
  <!-- 地区选择 -->
  <GardenRegionPicker v-if="!regionId" />

  <!-- 3D 茶园 -->
  <div v-else-if="currentRegion" class="region-garden-3d">
    <TeaGardenScene3D ref="scene3dRef" :plants="plants" :region-id="regionId"
      @select-plant="onSelectPlant3D" @select-pavilion="togglePavilion" />

    <!-- 顶栏 -->
    <div class="garden-topbar-3d">
      <button class="back-btn-3d" @click="router.push('/garden')">
        <IconArrowLeft :size="18" /><span>茶园</span>
      </button>
      <div class="garden-title-area-3d">
        <h1 class="garden-name-3d font-serif">{{ currentRegion.name }}</h1>
        <p class="garden-stats-3d">已种 {{ plants.length }} 棵 · {{ matureCount }} 棵可采</p>
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
        <button class="plant-btn-3d" @click="openPlantDialog">
          <IconPlus :size="16" /><span>种茶</span>
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

    <!-- 底部植物列表 -->
    <div class="plant-list-bar">
      <div v-if="plants.length === 0 && !loading" class="empty-hint" @click="openPlantDialog">
        <IconSprout :size="20" />
        <span>这片茶山还空着，点击种下第一棵茶</span>
      </div>
      <div v-else class="plant-list-scroll">
        <div v-for="plant in plants" :key="plant.id"
          class="plant-card"
          :class="{ dead: plant.status === 'dead', mature: getGrowthStage(plant) === 'mature' }"
          @click="openPlantDetail(plant)">
          <div class="plant-card-top">
            <span class="plant-card-name">{{ getPlantTea(plant)?.name ?? '茶' }}</span>
            <span class="plant-card-stage" :class="getGrowthStage(plant)">{{ getGrowthStageInfo(plant)?.label ?? '—' }}</span>
          </div>
          <div class="plant-card-water">
            <div class="water-bar-bg">
              <div class="water-bar-fill" :style="{ width: `${Math.round(getCurrentWaterLevel(plant))}%` }"
                :class="{ low: getCurrentWaterLevel(plant) < 30 }"></div>
            </div>
            <span class="water-text">{{ Math.round(getCurrentWaterLevel(plant)) }}%</span>
          </div>
          <div class="plant-card-bottom">
            <span class="plant-days">{{ getPlantDays(plant).toFixed(1) }}天</span>
            <span v-if="isGrowthPaused(plant) && plant.status === 'growing'" class="water-alert">
              <IconDroplet :size="12" /> 缺水
            </span>
            <span v-if="plant.status === 'dead'" class="dead-text">已枯萎</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗 -->
    <PlantDialog :open="showPlantDialog" :region-name="currentRegion.name" :teas="regionTeas"
      @confirm="confirmPlant" @close="closePlantDialog" />
    <PlantDetailDialog :plant="selectedPlant" :tea="selectedPlant ? getPlantTea(selectedPlant) : undefined"
      @water="doWater" @harvest="doHarvest" @prune="doPrune" @close="closePlantDetail" />
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
.garden-stats-3d { font-size: 0.72rem; color: rgba(245,241,230,0.6); margin: 0.2rem 0 0; }
.plant-btn-3d {
  display: inline-flex; align-items: center; gap: 0.35rem;
  background: rgba(201,169,110,0.9); border: none; color: #1a2420;
  padding: 0.65rem 1.2rem; min-height: 44px; border-radius: 999px;
  font-size: 0.85rem; font-weight: 500; cursor: pointer;
  transition: background 0.2s; font-family: inherit;
}
.plant-btn-3d:hover { background: #c9a96e; }

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

.plant-list-bar {
  position: absolute; bottom: 0; left: 0; right: 0; z-index: 10;
  padding: 1rem;
  background: linear-gradient(to top, rgba(13,20,16,0.6) 0%, transparent 100%);
}
.empty-hint {
  display: flex; align-items: center; justify-content: center; gap: 0.6rem;
  background: rgba(13,20,16,0.5); backdrop-filter: blur(8px);
  border: 1px dashed rgba(201,169,110,0.4); border-radius: 12px;
  padding: 1rem; color: rgba(245,241,230,0.7); font-size: 0.85rem;
  cursor: pointer; transition: all 0.2s;
}
.empty-hint:hover { border-color: rgba(201,169,110,0.7); background: rgba(13,20,16,0.7); }
.plant-list-scroll {
  display: flex; gap: 0.7rem; overflow-x: auto;
  padding: 0.3rem 0.2rem 0.5rem;
  scrollbar-width: thin; scrollbar-color: rgba(201,169,110,0.3) transparent;
}
.plant-list-scroll::-webkit-scrollbar { height: 4px; }
.plant-list-scroll::-webkit-scrollbar-thumb { background: rgba(201,169,110,0.3); border-radius: 2px; }
.plant-card {
  flex-shrink: 0; width: 168px;
  background: rgba(10, 16, 12, 0.5); border: 1px solid rgba(245,241,230,0.1);
  border-radius: 12px; padding: 0.7rem; cursor: pointer; transition: all 0.2s;
}
.plant-card:hover { border-color: rgba(201,169,110,0.5); transform: translateY(-2px); }
.plant-card.mature { border-color: rgba(174,213,129,0.5); }
.plant-card.dead { opacity: 0.6; border-color: rgba(139,69,19,0.4); }
.plant-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.plant-card-name { font-size: 0.85rem; font-weight: 500; color: #f5f1e6; }
.plant-card-stage {
  font-size: 0.62rem; padding: 0.15rem 0.45rem; border-radius: 999px;
  background: rgba(201,169,110,0.15); color: #c9a96e;
}
.plant-card-stage.sprout { background: rgba(124,179,66,0.15); color: #7cb342; }
.plant-card-stage.seedling { background: rgba(107,142,35,0.15); color: #aed581; }
.plant-card-stage.growing { background: rgba(85,139,47,0.15); color: #9ccc65; }
.plant-card-stage.mature { background: rgba(174,213,129,0.2); color: #aed581; }
.plant-card-stage.recovery { background: rgba(184,134,11,0.15); color: #daa520; }
.plant-card-water { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.4rem; }
.water-bar-bg { flex: 1; height: 5px; background: rgba(245,241,230,0.1); border-radius: 3px; overflow: hidden; }
.water-bar-fill { height: 100%; background: linear-gradient(90deg, #4fc3f7, #29b6f6); border-radius: 3px; transition: width 0.3s; }
.water-bar-fill.low { background: linear-gradient(90deg, #ef5350, #e53935); }
.water-text { font-size: 0.68rem; color: rgba(245,241,230,0.5); min-width: 28px; text-align: right; }
.plant-card-bottom { display: flex; justify-content: space-between; align-items: center; }
.plant-days { font-size: 0.68rem; color: rgba(245,241,230,0.45); }
.water-alert {
  display: inline-flex; align-items: center; gap: 0.2rem;
  font-size: 0.65rem; color: #ef5350; animation: pulse 1.5s infinite;
}
.dead-text { font-size: 0.65rem; color: #8d6e63; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

@media (max-width: 600px) {
  .garden-topbar-3d { padding: 0.7rem 0.8rem; gap: 0.4rem; }
  .garden-name-3d { font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .garden-stats-3d { font-size: 0.62rem; }
  .back-btn-3d { padding: 0.55rem 0.7rem; }
  .back-btn-3d span { display: none; }
  .plant-card { width: 140px; }
  .pavilion-panel { top: 5rem; right: 0.8rem; left: 0.8rem; max-width: none; }
}
</style>
