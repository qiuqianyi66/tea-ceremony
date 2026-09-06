<script setup lang="ts">
/**
 * 茶园页面
 * /garden：地区选择
 * /garden/:regionId：某地区茶园（种茶/浇水/养护）
 * 真实茶山场景背景，14天生长周期，真实时间计算
 */
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gardenRegions, getRegionById } from '@/data/gardenRegions'
import { getTeaById } from '@/data/teas'
import {
  plantTea, waterPlant, prunePlant, getPlantsByRegion,
  getGrowthStage, getGrowthStageInfo, getCurrentWaterLevel,
  getPlantDays, isGrowthPaused, refreshAllPlantStatuses,
  GROWTH_STAGES,
} from '@/services/garden'
import type { PlantedTea, GardenRegion } from '@/types/garden'
import type { Tea } from '@/types/tea'

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

const regionTeas = computed<Tea[]>(() => {
  if (!currentRegion.value) return []
  return currentRegion.value.teaIds
    .map(id => getTeaById(id))
    .filter((t): t is Tea => t !== undefined)
})

async function loadPlants() {
  if (!regionId.value) return
  loading.value = true
  await refreshAllPlantStatuses()
  plants.value = await getPlantsByRegion(regionId.value)
  loading.value = false
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

async function doWater() {
  if (!selectedPlant.value?.id) return
  await waterPlant(selectedPlant.value.id)
  await loadPlants()
  // 更新选中的植物
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

function getPlantPosition(index: number, total: number): { left: string; top: string } {
  // 茶树在茶园区域的位置，分散排列
  const cols = Math.ceil(Math.sqrt(total))
  const row = Math.floor(index / cols)
  const col = index % cols
  const left = 10 + (col / Math.max(1, cols - 1)) * 80 + (Math.random() - 0.5) * 5
  const top = 15 + (row / Math.max(1, Math.ceil(total / cols) - 1)) * 65 + (Math.random() - 0.5) * 5
  return { left: `${Math.max(5, Math.min(90, left))}%`, top: `${Math.max(10, Math.min(85, top))}%` }
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

  <!-- 地区茶园视图 -->
  <div v-else-if="currentRegion" class="region-garden">
    <div class="garden-bg" :style="{ backgroundImage: `url(${currentRegion.backgroundImage})` }"></div>
    <div class="garden-bg-overlay"></div>

    <div class="garden-topbar">
      <button class="back-btn" @click="router.push('/garden')">← 茶园</button>
      <div class="garden-title-area">
        <h1 class="garden-name">{{ currentRegion.name }}</h1>
        <p class="garden-stats">已种 {{ plants.length }} 棵 · {{ plants.filter(p => getGrowthStage(p) === 'mature').length }} 棵可采</p>
      </div>
      <button class="plant-btn" @click="openPlantDialog">+ 种茶</button>
    </div>

    <!-- 茶园区域 -->
    <div class="garden-field">
      <div v-for="(plant, idx) in plants" :key="plant.id"
        class="tea-plant"
        :class="[getGrowthStage(plant), plant.status]"
        :style="getPlantPosition(idx, plants.length)"
        @click="openPlantDetail(plant)">
        <!-- 茶树 SVG：不同生长阶段不同大小 -->
        <svg v-if="plant.status !== 'dead'" viewBox="0 0 100 120" class="plant-svg">
          <!-- 树干 -->
          <path d="M50 115 L50 70" stroke="#5d4e37" stroke-width="6" stroke-linecap="round" fill="none"/>
          <!-- 枝叶：根据生长阶段 -->
          <g v-if="getGrowthStage(plant) === 'sprout'">
            <ellipse cx="42" cy="62" rx="8" ry="4" fill="#7cb342" transform="rotate(-30 42 62)"/>
            <ellipse cx="58" cy="62" rx="8" ry="4" fill="#7cb342" transform="rotate(30 58 62)"/>
          </g>
          <g v-else-if="getGrowthStage(plant) === 'seedling'">
            <path d="M50 70 L35 50" stroke="#5d4e37" stroke-width="3" fill="none"/>
            <path d="M50 70 L65 50" stroke="#5d4e37" stroke-width="3" fill="none"/>
            <ellipse cx="30" cy="45" rx="10" ry="5" fill="#6b8e23" transform="rotate(-25 30 45)"/>
            <ellipse cx="70" cy="45" rx="10" ry="5" fill="#6b8e23" transform="rotate(25 70 45)"/>
            <ellipse cx="50" cy="38" rx="9" ry="5" fill="#7cb342"/>
          </g>
          <g v-else-if="getGrowthStage(plant) === 'growing'">
            <path d="M50 70 L30 45" stroke="#5d4e37" stroke-width="3" fill="none"/>
            <path d="M50 70 L70 45" stroke="#5d4e37" stroke-width="3" fill="none"/>
            <path d="M50 55 L40 30" stroke="#5d4e37" stroke-width="2.5" fill="none"/>
            <path d="M50 55 L60 30" stroke="#5d4e37" stroke-width="2.5" fill="none"/>
            <ellipse cx="25" cy="40" rx="11" ry="6" fill="#558b2f" transform="rotate(-20 25 40)"/>
            <ellipse cx="75" cy="40" rx="11" ry="6" fill="#558b2f" transform="rotate(20 75 40)"/>
            <ellipse cx="35" cy="25" rx="10" ry="5" fill="#6b8e23" transform="rotate(-35 35 25)"/>
            <ellipse cx="65" cy="25" rx="10" ry="5" fill="#6b8e23" transform="rotate(35 65 25)"/>
            <ellipse cx="50" cy="18" rx="9" ry="5" fill="#7cb342"/>
          </g>
          <g v-else><!-- mature -->
            <path d="M50 70 L28 42" stroke="#5d4e37" stroke-width="3.5" fill="none"/>
            <path d="M50 70 L72 42" stroke="#5d4e37" stroke-width="3.5" fill="none"/>
            <path d="M50 55 L35 25" stroke="#5d4e37" stroke-width="3" fill="none"/>
            <path d="M50 55 L65 25" stroke="#5d4e37" stroke-width="3" fill="none"/>
            <path d="M50 40 L42 15" stroke="#5d4e37" stroke-width="2" fill="none"/>
            <path d="M50 40 L58 15" stroke="#5d4e37" stroke-width="2" fill="none"/>
            <ellipse cx="22" cy="37" rx="12" ry="7" fill="#33691e" transform="rotate(-15 22 37)"/>
            <ellipse cx="78" cy="37" rx="12" ry="7" fill="#33691e" transform="rotate(15 78 37)"/>
            <ellipse cx="30" cy="20" rx="11" ry="6" fill="#558b2f" transform="rotate(-30 30 20)"/>
            <ellipse cx="70" cy="20" rx="11" ry="6" fill="#558b2f" transform="rotate(30 70 20)"/>
            <ellipse cx="50" cy="10" rx="10" ry="6" fill="#6b8e23"/>
            <!-- 新芽标记 -->
            <circle cx="50" cy="8" r="3" fill="#aed581"/>
            <circle cx="38" cy="14" r="2.5" fill="#c5e1a5"/>
            <circle cx="62" cy="14" r="2.5" fill="#c5e1a5"/>
          </g>
        </svg>
        <!-- 枯萎 -->
        <svg v-else viewBox="0 0 100 120" class="plant-svg dead-svg">
          <path d="M50 115 L50 60" stroke="#6d5c4a" stroke-width="5" stroke-linecap="round" fill="none"/>
          <path d="M50 75 L35 55" stroke="#6d5c4a" stroke-width="3" fill="none"/>
          <path d="M50 75 L65 55" stroke="#6d5c4a" stroke-width="3" fill="none"/>
          <path d="M50 60 L40 40" stroke="#6d5c4a" stroke-width="2" fill="none"/>
        </svg>
        <!-- 茶树名牌 -->
        <div class="plant-label">{{ getPlantTea(plant)?.name ?? '茶' }}</div>
        <!-- 缺水警告 -->
        <div v-if="isGrowthPaused(plant) && plant.status === 'growing'" class="water-warning">💧</div>
      </div>

      <!-- 空地提示 -->
      <div v-if="plants.length === 0 && !loading" class="empty-field" @click="openPlantDialog">
        <p class="empty-icon">🌱</p>
        <p class="empty-text">这片茶山还空着，点击种下第一棵茶</p>
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

/* 地区茶园 */
.region-garden {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}
.garden-bg {
  position: absolute; inset: 0;
  background-size: cover; background-position: center;
}
.garden-bg-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(13,20,16,0.5) 0%, rgba(13,20,16,0.2) 30%, rgba(13,20,16,0.6) 100%);
}

.garden-topbar {
  position: relative; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.5rem;
  color: #f5f1e6;
}
.back-btn {
  background: rgba(0,0,0,0.3); border: 1px solid rgba(245,241,230,0.2);
  color: #f5f1e6; padding: 0.5rem 1rem; border-radius: 999px;
  font-size: 0.85rem; cursor: pointer; transition: background 0.2s;
}
.back-btn:hover { background: rgba(0,0,0,0.5); }
.garden-title-area { text-align: center; }
.garden-name { font-size: 1.2rem; font-weight: 500; margin: 0; letter-spacing: 0.1em; }
.garden-stats { font-size: 0.72rem; color: rgba(245,241,230,0.6); margin: 0.2rem 0 0; }
.plant-btn {
  background: rgba(201,169,110,0.9); border: none;
  color: #1a2420; padding: 0.5rem 1.2rem; border-radius: 999px;
  font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: background 0.2s;
}
.plant-btn:hover { background: #c9a96e; }

/* 茶园区域 */
.garden-field {
  position: relative; z-index: 5;
  height: calc(100vh - 80px);
}
.tea-plant {
  position: absolute;
  width: 80px;
  cursor: pointer;
  transition: transform 0.2s;
  text-align: center;
}
.tea-plant:hover { transform: scale(1.1); }
.plant-svg { width: 100%; height: auto; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4)); }
.dead-svg { opacity: 0.7; }
.plant-label {
  font-size: 0.65rem; color: #f5f1e6;
  background: rgba(0,0,0,0.5); padding: 0.15rem 0.5rem;
  border-radius: 999px; display: inline-block; margin-top: -8px;
  white-space: nowrap;
}
.water-warning {
  position: absolute; top: -8px; right: -4px;
  font-size: 1rem; animation: bounce 1s infinite;
}
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.empty-field {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%); text-align: center;
  cursor: pointer; color: #f5f1e6;
}
.empty-icon { font-size: 3rem; margin: 0 0 1rem; }
.empty-text { font-size: 0.9rem; color: rgba(245,241,230,0.7); margin: 0; }

/* 弹窗 */
.dialog-mask {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}
.dialog {
  background: #1a2420; border: 1px solid rgba(201,169,110,0.2);
  border-radius: 16px; padding: 1.5rem;
  max-width: 420px; width: 100%;
  color: #f5f1e6;
  max-height: 85vh; overflow-y: auto;
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
  .garden-topbar { padding: 0.8rem 1rem; }
  .garden-name { font-size: 1rem; }
  .tea-plant { width: 60px; }
}
</style>
