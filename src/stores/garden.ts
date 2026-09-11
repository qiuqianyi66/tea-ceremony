/**
 * 茶园状态 — 从 GardenView 编排层抽出的业务状态
 * 管理：当前地区植物列表 / 加载态 / 种茶·浇水·定型·采摘
 * 生长阶段、湿度等纯计算保留在 services/garden，视图直接派生
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  plantTea, waterPlant, prunePlant, harvestPlant,
  getPlantsByRegion, refreshAllPlantStatuses, syncPendingGarden, getGrowthStage,
} from '@/services/garden'
import type { PlantedTea } from '@/types/garden'

export const useGardenStore = defineStore('garden', () => {
  const plants = ref<PlantedTea[]>([])
  const loading = ref(false)
  const regionId = ref<string | null>(null)

  const matureCount = computed(() => plants.value.filter(p => getGrowthStage(p) === 'mature').length)

  async function load(region: string) {
    regionId.value = region
    loading.value = true
    try {
      await refreshAllPlantStatuses()
      plants.value = await getPlantsByRegion(region)
    } finally {
      loading.value = false
    }
    void syncPendingGarden()
  }

  async function plant(teaId: string) {
    if (!regionId.value) return
    await plantTea(regionId.value, teaId)
    await load(regionId.value)
  }

  async function water(plantId: number) {
    try { await waterPlant(plantId) }
    catch (e) { console.warn('[gardenStore] 浇水同步失败（离线？）', e) }
    if (regionId.value) await load(regionId.value)
  }

  async function prune(plantId: number) {
    await prunePlant(plantId)
    if (regionId.value) await load(regionId.value)
  }

  async function harvest(plantId: number) {
    await harvestPlant(plantId)
    if (regionId.value) await load(regionId.value)
  }

  return { plants, loading, matureCount, load, plant, water, prune, harvest }
})
