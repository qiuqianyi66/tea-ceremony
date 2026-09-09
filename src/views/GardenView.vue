<script setup lang="ts">
/**
 * 茶园页面
 * /garden：地区选择
 * /garden/:regionId：某地区茶园（3D真实感茶山 + 种茶/浇水/养护）
 * 14天真实生长周期，打开页面即更新
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gardenRegions, getRegionById } from '@/data/gardenRegions'
import { getTeaById } from '@/data/teas'
import {
  plantTea, waterPlant, prunePlant, harvestPlant, getPlantsByRegion,
  getGrowthStage, getGrowthStageInfo, getCurrentWaterLevel,
  getPlantDays, isGrowthPaused, refreshAllPlantStatuses, syncPendingGarden,
} from '@/services/garden'
import type { PlantedTea, GardenRegion } from '@/types/garden'
import type { Tea } from '@/types/tea'
import TeaGardenScene3D from '@/components/three/TeaGardenScene3D.vue'

const route = useRoute()
const router = useRouter()

const regionId = computed(() => route.params.regionId as string | undefined)
const currentRegion = computed<GardenRegion | undefined>(() =>
  regionId.value ? getRegionById(regionId.value) : undefined
)

const plants = ref<PlantedTea[]>([])
const showPlantDialog = ref(false)
const selectedTeaId = ref<string>('')
const showPlantDetail = ref(false)
const selectedPlant = ref<PlantedTea | null>(null)
const loading = ref(true)

/** 3D 场景组件实例（浇水时触发粒子动画） */
import type { WeatherMode } from '@/components/three/garden-weather'
const scene3dRef = ref<{ playWater?: (id: number) => void; setWeather?: (m: WeatherMode) => void; setAudioEnabled?: (on: boolean) => void }>()
/** 天气状态：sunny / rain（默认晴天） */
const weatherMode = ref<'sunny' | 'rain'>('sunny')
/** 环境音效开关（默认关，需用户手势启动 AudioContext） */
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
  // 登录用户进入茶园时重试上次离线未同步的记录（静默失败不影响本地）
  void syncPendingGarden()
}

function openPlantDialog() {
  selectedTeaId.value = regionTeas.value[0]?.id ?? ''
  showPlantDialog.value = true
}

async function confirmPlant() {
  if (!regionId.value || !selectedTeaId.value) return
  await plantTea(regionId.value, selectedTeaId.value)
  showPlantDialog.value = false
  await loadPlants()
}

function openPlantDetail(plant: PlantedTea) {
  selectedPlant.value = plant
  showPlantDetail.value = true
}

/** 3D场景点击茶树 → 打开对应详情面板 */
function onSelectPlant3D(id: number) {
  const plant = plants.value.find(p => p.id === id)
  if (plant) openPlantDetail(plant)
}

async function doWater() {
  if (!selectedPlant.value?.id) return
  // 视觉优先：先播水滴粒子（不依赖后端；后端离线时 waterPlant 会挂起/失败，不能阻塞动画）
  scene3dRef.value?.playWater?.(selectedPlant.value.id)
  showPlantDetail.value = false
  try {
    await waterPlant(selectedPlant.value.id)
  } catch (e) {
    console.warn('[GardenView] 浇水同步失败（离线？），湿度暂未更新', e)
  }
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

function getStageLabel(plant: PlantedTea): string {
  return getGrowthStageInfo(plant)?.label ?? '—'
}

onMounted(() => {
  if (regionId.value) loadPlants()
})
</script>

<template>
  <!-- 地区选择视图 -->
  <div v-if="!regionId" class="garden-home">
    <div class="garden-header">
      <h1 class="garden-title">我的茶园</h1>
      <p class="garden-sub">选一片茶山，种下属于你的茶</p>
    </div>
    <div class="region-grid">
      <div v-for="region in gardenRegions" :key="region.id"
        class="region-card"
        @click="router.push(`/garden/${region.id}`)">
        <div class="region-bg" :style="{ backgroundImage: `url(${region.backgroundImage})` }"></div>
        <div class="region-overlay"></div>
        <div class="region-info">
          <p class="region-tea-area">{{ region.teaArea }}</p>
          <h2 class="region-name">{{ region.name }}</h2>
          <p class="region-desc">{{ region.description }}</p>
          <p class="region-climate">{{ region.climate }}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- 地区茶园视图：3D真实感茶山 -->
  <div v-else-if="currentRegion" class="region-garden-3d">
    <!-- 3D场景全屏 -->
    <TeaGardenScene3D ref="scene3dRef" :plants="plants" @select-plant="onSelectPlant3D" />

    <!-- 顶部栏叠加（毛玻璃） -->
    <div class="garden-topbar-3d">
      <button class="back-btn-3d" @click="router.push('/garden')">← 茶园</button>
      <div class="garden-title-area-3d">
        <h1 class="garden-name-3d">{{ currentRegion.name }}</h1>
        <p class="garden-stats-3d">已种 {{ plants.length }} 棵 · {{ matureCount }} 棵可采</p>
      </div>
      <div class="topbar-actions-3d">
        <button class="ambient-btn-3d" :class="{ active: weatherMode === 'rain' }" @click="toggleWeather" :title="weatherMode === 'rain' ? '切换到晴天' : '切换到雨天'">
          {{ weatherMode === 'rain' ? '🌧️' : '☀️' }}
        </button>
        <button class="ambient-btn-3d" :class="{ active: audioOn }" @click="toggleAudio" :title="audioOn ? '关闭环境音' : '开启环境音'">
          {{ audioOn ? '🔊' : '🔇' }}
        </button>
        <button class="plant-btn-3d" @click="openPlantDialog">+ 种茶</button>
      </div>
    </div>

    <!-- 底部茶树列表 -->
    <div class="plant-list-bar">
      <div v-if="plants.length === 0 && !loading" class="empty-hint" @click="openPlantDialog">
        <span class="empty-icon">🌱</span>
        <span>这片茶山还空着，点击种下第一棵茶</span>
      </div>
      <div v-else class="plant-list-scroll">
        <div v-for="plant in plants" :key="plant.id"
          class="plant-card"
          :class="{ dead: plant.status === 'dead', mature: getGrowthStage(plant) === 'mature' }"
          @click="openPlantDetail(plant)">
          <div class="plant-card-top">
            <span class="plant-card-name">{{ getPlantTea(plant)?.name ?? '茶' }}</span>
            <span class="plant-card-stage" :class="getGrowthStage(plant)">{{ getStageLabel(plant) }}</span>
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
            <span v-if="isGrowthPaused(plant) && plant.status === 'growing'" class="water-alert">💧缺水</span>
            <span v-if="plant.status === 'dead'" class="dead-text">已枯萎</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 种茶弹窗 -->
    <div v-if="showPlantDialog" class="dialog-mask" @click.self="showPlantDialog = false">
      <div class="dialog">
        <h3 class="dialog-title">种下一棵茶</h3>
        <p class="dialog-sub">{{ currentRegion.name }} · 可种茶种</p>
        <div class="tea-select-list">
          <div v-for="tea in regionTeas" :key="tea.id"
            class="tea-select-item"
            :class="{ selected: selectedTeaId === tea.id }"
            @click="selectedTeaId = tea.id">
            <div class="tea-color" :style="{ background: `linear-gradient(135deg, ${tea.soupColorMin}, ${tea.soupColorMax})` }"></div>
            <div class="tea-select-info">
              <p class="tea-select-name">{{ tea.name }}</p>
              <p class="tea-select-type">{{ tea.type }} · {{ tea.origin }}</p>
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="dialog-btn cancel" @click="showPlantDialog = false">取消</button>
          <button class="dialog-btn confirm" @click="confirmPlant" :disabled="!selectedTeaId">种下</button>
        </div>
      </div>
    </div>

    <!-- 植物详情弹窗 -->
    <div v-if="showPlantDetail && selectedPlant" class="dialog-mask" @click.self="showPlantDetail = false">
      <div class="dialog plant-detail">
        <div class="detail-header">
          <h3 class="dialog-title">{{ getPlantTea(selectedPlant)?.name }}</h3>
          <span class="detail-stage" :class="getGrowthStage(selectedPlant)">
            {{ getGrowthStageInfo(selectedPlant)?.label }}
          </span>
        </div>
        <div class="detail-body">
          <div class="detail-row">
            <span class="detail-label">种植天数</span>
            <span class="detail-value">{{ getPlantDays(selectedPlant).toFixed(1) }} 天</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">土壤湿度</span>
            <span class="detail-value" :class="{ low: getCurrentWaterLevel(selectedPlant) < 30 }">
              {{ Math.round(getCurrentWaterLevel(selectedPlant)) }}%
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">生长状态</span>
            <span class="detail-value">
              {{ selectedPlant.status === 'dead' ? '已枯萎' : isGrowthPaused(selectedPlant) ? '缺水暂停生长' : '正常生长' }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">定型修剪</span>
            <span class="detail-value">{{ selectedPlant.pruned ? '已修剪' : '未修剪' }}</span>
          </div>
          <p class="detail-desc">{{ getGrowthStageInfo(selectedPlant)?.description }}</p>
        </div>
        <div class="dialog-actions">
          <button v-if="getGrowthStage(selectedPlant) === 'seedling' && !selectedPlant.pruned"
            class="dialog-btn secondary" @click="doPrune">✂️ 定型修剪</button>
          <button v-if="getGrowthStage(selectedPlant) === 'mature' && selectedPlant.status === 'growing'"
            class="dialog-btn harvest" @click="doHarvest">🍃 采摘</button>
          <button v-if="getGrowthStage(selectedPlant) === 'recovery'"
            class="dialog-btn recovery-hint" disabled>🌱 恢复期（休养生息）</button>
          <button class="dialog-btn confirm" @click="doWater" :disabled="selectedPlant.status === 'dead'">
            💧 浇水
          </button>
          <button class="dialog-btn cancel" @click="showPlantDetail = false">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 地区选择 */
.garden-home {
  min-height: 100vh;
  background: linear-gradient(160deg, #0f1a14 0%, #1a2420 100%);
  color: #f5f1e6;
  padding: 2rem 1rem;
}
.garden-header { text-align: center; margin-bottom: 2rem; }
.garden-title { font-size: 2rem; font-weight: 300; letter-spacing: 0.2em; margin: 0 0 0.5rem; }
.garden-sub { font-size: 0.85rem; color: rgba(245,241,230,0.5); letter-spacing: 0.15em; margin: 0; }

.region-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}
.region-card {
  position: relative;
  height: 320px;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.3s, box-shadow 0.3s;
}
.region-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
.region-bg {
  position: absolute; inset: 0;
  background-size: cover; background-position: center;
}
.region-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(13,20,16,0.92) 0%, rgba(13,20,16,0.3) 60%, transparent 100%);
}
.region-info {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 1.5rem;
}
.region-tea-area {
  font-size: 0.7rem; letter-spacing: 0.3em;
  color: rgba(201,169,110,0.8); margin: 0 0 0.3rem;
}
.region-name { font-size: 1.3rem; font-weight: 500; margin: 0 0 0.5rem; }
.region-desc {
  font-size: 0.78rem; line-height: 1.6;
  color: rgba(245,241,230,0.65); margin: 0 0 0.4rem;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.region-climate { font-size: 0.7rem; color: rgba(245,241,230,0.4); margin: 0; }

/* ========== 3D茶园视图 ========== */
.region-garden-3d {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #87a5c4;
}

/* 顶部栏（毛玻璃叠加） */
.garden-topbar-3d {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: rgba(13, 20, 16, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(245, 241, 230, 0.1);
}
.back-btn-3d {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(245,241,230,0.2);
  color: #f5f1e6;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
}
.back-btn-3d:hover { background: rgba(255,255,255,0.2); }
.garden-title-area-3d { text-align: center; }
.garden-name-3d {
  font-size: 1.15rem;
  font-weight: 500;
  margin: 0;
  color: #f5f1e6;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
}
.garden-stats-3d {
  font-size: 0.72rem;
  color: rgba(245,241,230,0.6);
  margin: 0.2rem 0 0;
}
.plant-btn-3d {
  background: rgba(201,169,110,0.9);
  border: none;
  color: #1a2420;
  padding: 0.5rem 1.2rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
}
.plant-btn-3d:hover { background: #c9a96e; }

/* 顶栏右侧操作组（天气/音效/种茶） */
.topbar-actions-3d {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.ambient-btn-3d {
  background: rgba(20,30,24,0.55);
  border: 1px solid rgba(245,241,230,0.25);
  color: rgba(245,241,230,0.9);
  width: 2.3rem; height: 2.3rem;
  border-radius: 999px;
  font-size: 0.95rem;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.2s, border-color 0.2s;
  font-family: inherit;
  display: flex; align-items: center; justify-content: center;
}
.ambient-btn-3d:hover { background: rgba(40,56,44,0.7); border-color: rgba(245,241,230,0.5); }
.ambient-btn-3d.active {
  background: rgba(201,169,110,0.85);
  border-color: transparent;
}

/* 底部茶树列表 */
.plant-list-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  z-index: 10;
  padding: 1rem;
  background: linear-gradient(to top, rgba(13,20,16,0.6) 0%, transparent 100%);
}
.empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: rgba(13,20,16,0.5);
  backdrop-filter: blur(8px);
  border: 1px dashed rgba(201,169,110,0.4);
  border-radius: 12px;
  padding: 1rem;
  color: rgba(245,241,230,0.7);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}
.empty-hint:hover {
  border-color: rgba(201,169,110,0.7);
  background: rgba(13,20,16,0.7);
}
.empty-icon { font-size: 1.2rem; }

.plant-list-scroll {
  display: flex;
  gap: 0.7rem;
  overflow-x: auto;
  padding: 0.3rem 0.2rem 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(201,169,110,0.3) transparent;
}
.plant-list-scroll::-webkit-scrollbar { height: 4px; }
.plant-list-scroll::-webkit-scrollbar-thumb { background: rgba(201,169,110,0.3); border-radius: 2px; }

.plant-card {
  flex-shrink: 0;
  width: 160px;
  background: rgba(13,20,16,0.55);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(245,241,230,0.12);
  border-radius: 12px;
  padding: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
}
.plant-card:hover {
  border-color: rgba(201,169,110,0.5);
  transform: translateY(-2px);
}
.plant-card.mature { border-color: rgba(174,213,129,0.5); }
.plant-card.dead { opacity: 0.6; border-color: rgba(139,69,19,0.4); }

.plant-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.plant-card-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: #f5f1e6;
}
.plant-card-stage {
  font-size: 0.62rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: rgba(201,169,110,0.15);
  color: #c9a96e;
}
.plant-card-stage.sprout { background: rgba(124,179,66,0.15); color: #7cb342; }
.plant-card-stage.seedling { background: rgba(107,142,35,0.15); color: #aed581; }
.plant-card-stage.growing { background: rgba(85,139,47,0.15); color: #9ccc65; }
.plant-card-stage.mature { background: rgba(174,213,129,0.2); color: #aed581; }
.plant-card-stage.recovery { background: rgba(184,134,11,0.15); color: #daa520; }

.plant-card-water {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}
.water-bar-bg {
  flex: 1;
  height: 5px;
  background: rgba(245,241,230,0.1);
  border-radius: 3px;
  overflow: hidden;
}
.water-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #4fc3f7, #29b6f6);
  border-radius: 3px;
  transition: width 0.3s;
}
.water-bar-fill.low { background: linear-gradient(90deg, #ef5350, #e53935); }
.water-text {
  font-size: 0.68rem;
  color: rgba(245,241,230,0.5);
  min-width: 28px;
  text-align: right;
}

.plant-card-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.plant-days {
  font-size: 0.68rem;
  color: rgba(245,241,230,0.45);
}
.water-alert {
  font-size: 0.65rem;
  color: #ef5350;
  animation: pulse 1.5s infinite;
}
.dead-text {
  font-size: 0.65rem;
  color: #8d6e63;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ========== 弹窗 ========== */
.dialog-mask {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.dialog {
  background: #1a2420;
  border: 1px solid rgba(201,169,110,0.2);
  border-radius: 16px;
  padding: 1.5rem;
  max-width: 420px;
  width: 100%;
  color: #f5f1e6;
  max-height: 85vh;
  overflow-y: auto;
}
.dialog-title { font-size: 1.2rem; font-weight: 500; margin: 0 0 0.3rem; }
.dialog-sub { font-size: 0.78rem; color: rgba(245,241,230,0.5); margin: 0 0 1rem; }

.tea-select-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.tea-select-item {
  display: flex; align-items: center; gap: 0.8rem;
  padding: 0.7rem; border-radius: 10px;
  border: 1px solid rgba(245,241,230,0.1);
  cursor: pointer; transition: all 0.2s;
}
.tea-select-item:hover { border-color: rgba(201,169,110,0.4); }
.tea-select-item.selected {
  border-color: rgba(201,169,110,0.8);
  background: rgba(201,169,110,0.1);
}
.tea-color { width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0; }
.tea-select-name { font-size: 0.9rem; font-weight: 500; margin: 0; }
.tea-select-type { font-size: 0.72rem; color: rgba(245,241,230,0.5); margin: 0.15rem 0 0; }

.dialog-actions { display: flex; gap: 0.6rem; justify-content: flex-end; flex-wrap: wrap; }
.dialog-btn {
  padding: 0.55rem 1.3rem; border-radius: 999px;
  font-size: 0.85rem; cursor: pointer; border: none;
  transition: all 0.2s; font-family: inherit;
}
.dialog-btn.confirm { background: rgba(201,169,110,0.9); color: #1a2420; font-weight: 500; }
.dialog-btn.confirm:hover { background: #c9a96e; }
.dialog-btn.confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.dialog-btn.cancel { background: transparent; border: 1px solid rgba(245,241,230,0.2); color: rgba(245,241,230,0.7); }
.dialog-btn.cancel:hover { border-color: rgba(245,241,230,0.4); }
.dialog-btn.secondary { background: rgba(107,142,35,0.2); border: 1px solid rgba(107,142,35,0.4); color: #aed581; }
.dialog-btn.secondary:hover { background: rgba(107,142,35,0.3); }
.dialog-btn.harvest { background: rgba(244,167,66,0.85); color: #1a2420; font-weight: 500; }
.dialog-btn.harvest:hover { background: #f4a742; }
.dialog-btn.recovery-hint { background: transparent; border: 1px dashed rgba(174,213,129,0.4); color: #aed581; cursor: default; }

/* 植物详情 */
.plant-detail { max-width: 380px; }
.detail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.detail-stage {
  font-size: 0.72rem; padding: 0.25rem 0.7rem; border-radius: 999px;
  background: rgba(201,169,110,0.15); color: #c9a96e;
}
.detail-stage.mature { background: rgba(107,142,35,0.2); color: #aed581; }
.detail-stage.dead { background: rgba(139,69,19,0.2); color: #b8860b; }
.detail-body { margin-bottom: 1rem; }
.detail-row {
  display: flex; justify-content: space-between;
  padding: 0.5rem 0; border-bottom: 1px solid rgba(245,241,230,0.08);
  font-size: 0.85rem;
}
.detail-label { color: rgba(245,241,230,0.5); }
.detail-value { color: #f5f1e6; font-weight: 500; }
.detail-value.low { color: #e57373; }
.detail-desc {
  font-size: 0.78rem; color: rgba(245,241,230,0.5);
  line-height: 1.6; margin: 0.8rem 0 0; font-style: italic;
}

@media (max-width: 600px) {
  .garden-topbar-3d { padding: 0.7rem 1rem; }
  .garden-name-3d { font-size: 0.95rem; }
  .plant-card { width: 140px; }
}
</style>
