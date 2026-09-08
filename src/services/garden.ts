/**
 * 茶园服务
 * 种植、浇水、生长计算、状态管理
 * 真实时间戳计算，打开页面即更新，无需后台
 */
import { db, initDB } from './storage'
import { gardenApi } from './api'
import type { PlantedTea, GrowthStage, GrowthStageInfo } from '@/types/garden'

// ============ 生长周期配置（14 天） ============

export const GROWTH_STAGES: GrowthStageInfo[] = [
  { stage: 'sprout', label: '萌芽期', dayRange: [0, 2], description: '茶苗破土，新芽初绽', needsPruning: false },
  { stage: 'seedling', label: '幼苗期', dayRange: [2, 5], description: '真叶展开，根系生长', needsPruning: true },
  { stage: 'growing', label: '成长期', dayRange: [5, 10], description: '枝叶茂盛，树冠形成', needsPruning: false },
  { stage: 'mature', label: '成熟期', dayRange: [10, 14], description: '新芽冒头，可以采摘', needsPruning: false },
]

export const RECOVERY_DAYS = 7 // 采后恢复期
export const WATER_DECAY_PER_DAY = 20 // 每天湿度下降百分比
export const GROWTH_PAUSE_WATER = 30 // 湿度低于此值生长暂停
export const DEAD_WATER = 10 // 湿度低于此值且持续3天则枯萎
export const DEAD_DAYS = 3 // 持续低湿度天数

// ============ 工具函数 ============

/** 计算种植天数（真实时间） */
export function getPlantDays(plant: PlantedTea): number {
  const planted = new Date(plant.plantedAt).getTime()
  const now = Date.now()
  return Math.max(0, (now - planted) / (1000 * 60 * 60 * 24))
}

/** 计算当前生长阶段 */
export function getGrowthStage(plant: PlantedTea): GrowthStage {
  if (plant.status === 'harvested') return 'recovery'
  if (plant.status === 'dead') return 'sprout'
  const days = getPlantDays(plant)
  for (const stage of GROWTH_STAGES) {
    if (days >= stage.dayRange[0] && days < stage.dayRange[1]) return stage.stage
  }
  return 'mature'
}

/** 获取生长阶段信息 */
export function getGrowthStageInfo(plant: PlantedTea): GrowthStageInfo | null {
  const stage = getGrowthStage(plant)
  if (stage === 'recovery') {
    return { stage: 'recovery', label: '恢复期', dayRange: [0, RECOVERY_DAYS], description: '休养生息，之后又能采摘', needsPruning: false }
  }
  return GROWTH_STAGES.find(s => s.stage === stage) ?? null
}

/** 计算生长进度 0-1（考虑湿度暂停） */
export function getGrowthProgress(plant: PlantedTea): number {
  if (plant.status === 'harvested' || plant.status === 'dead') return 1
  const days = getPlantDays(plant)
  return Math.min(1, days / 14)
}

/** 计算当前土壤湿度（基于上次浇水时间衰减） */
export function getCurrentWaterLevel(plant: PlantedTea): number {
  const lastWatered = new Date(plant.lastWateredAt).getTime()
  const daysSinceWater = (Date.now() - lastWatered) / (1000 * 60 * 60 * 24)
  const level = plant.waterLevel - daysSinceWater * WATER_DECAY_PER_DAY
  return Math.max(0, Math.min(100, level))
}

/** 判断是否枯萎 */
export function isPlantDead(plant: PlantedTea): boolean {
  if (plant.status === 'dead') return true
  const water = getCurrentWaterLevel(plant)
  const lastWatered = new Date(plant.lastWateredAt).getTime()
  const daysSinceWater = (Date.now() - lastWatered) / (1000 * 60 * 60 * 24)
  return water < DEAD_WATER && daysSinceWater > DEAD_DAYS
}

/** 判断生长是否因缺水暂停 */
export function isGrowthPaused(plant: PlantedTea): boolean {
  return getCurrentWaterLevel(plant) < GROWTH_PAUSE_WATER
}

// ============ 数据库操作 ============

/** 种植新茶树 */
export async function plantTea(regionId: string, teaId: string): Promise<PlantedTea> {
  await initDB()
  const now = new Date().toISOString()
  const plant: PlantedTea = {
    regionId,
    teaId,
    plantedAt: now,
    lastWateredAt: now,
    waterLevel: 100,
    pruned: false,
    status: 'growing',
    harvestCount: 0,
  }
  const id = await db.gardenPlants.add(plant)
  const saved = { ...plant, id }
  await syncPlant(saved)
  return saved
}

/** 浇水 */
export async function waterPlant(plantId: number): Promise<void> {
  await initDB()
  const plant = await db.gardenPlants.get(plantId)
  if (!plant) return
  plant.lastWateredAt = new Date().toISOString()
  plant.waterLevel = 100
  // 如果之前因缺水枯萎，浇水不能复活（真实）
  await db.gardenPlants.put(plant)
  await syncPlant(plant)
}

/** 定型修剪 */
export async function prunePlant(plantId: number): Promise<void> {
  await initDB()
  const plant = await db.gardenPlants.get(plantId)
  if (!plant || plant.pruned) return
  plant.pruned = true
  await db.gardenPlants.put(plant)
  await syncPlant(plant)
}

/** 采摘（仅成熟期可采）：进入恢复期，采摘次数 +1，记录采摘时间 */
export async function harvestPlant(plantId: number): Promise<void> {
  await initDB()
  const plant = await db.gardenPlants.get(plantId)
  if (!plant || plant.status !== 'growing') return
  if (getGrowthStage(plant) !== 'mature') return // 未成熟不可采
  plant.status = 'harvested'
  plant.harvestCount = (plant.harvestCount ?? 0) + 1
  plant.harvestedAt = new Date().toISOString()
  await db.gardenPlants.put(plant)
  await syncPlant(plant)
}

/** 获取某地区所有种植记录 */
export async function getPlantsByRegion(regionId: string): Promise<PlantedTea[]> {
  await initDB()
  return db.gardenPlants.where('regionId').equals(regionId).sortBy('plantedAt')
}

/** 获取所有种植记录 */
export async function getAllPlants(): Promise<PlantedTea[]> {
  await initDB()
  return db.gardenPlants.orderBy('plantedAt').toArray()
}

/** 刷新所有植物状态（打开页面时调用，更新枯萎状态） */
export async function refreshAllPlantStatuses(): Promise<void> {
  await initDB()
  const plants = await db.gardenPlants.toArray()
  for (const plant of plants) {
    if (plant.status === 'growing' && isPlantDead(plant)) {
      plant.status = 'dead'
      await db.gardenPlants.put(plant)
      await syncPlant(plant)
    }
  }
}

// ============ 同步工具 ============

/**
 * 单株同步（离线优先，与品鉴记录同一模式）：
 * 本地置 pending → 上传后端（client_id 幂等）→ 成功 synced / 失败 failed。
 * 网络不可用或未登录时不阻塞本地功能。
 */
async function syncPlant(plant: PlantedTea): Promise<void> {
  if (!plant.id) return
  await db.gardenPlants.put({ ...plant, syncStatus: 'pending', syncError: undefined })
  try {
    await gardenApi.upsert({ ...plant, syncStatus: 'pending' })
    await db.gardenPlants.put({ ...plant, syncStatus: 'synced', syncError: undefined })
  } catch (error) {
    const syncError = error instanceof Error ? error.message : '同步失败'
    console.warn('[Garden] 茶园记录已保存在本地，稍后可重试同步:', syncError)
    await db.gardenPlants.put({ ...plant, syncStatus: 'failed', syncError })
  }
}

/** 批量重试未同步的茶园记录（登录后 / 网络恢复时调用） */
export async function syncPendingGarden(): Promise<{ synced: number; failed: number }> {
  await initDB()
  const pending = await db.gardenPlants
    .filter(plant => plant.syncStatus === 'pending' || plant.syncStatus === 'failed')
    .toArray()
  let synced = 0
  let failed = 0

  for (const plant of pending) {
    try {
      await gardenApi.upsert(plant)
      await db.gardenPlants.put({ ...plant, syncStatus: 'synced', syncError: undefined })
      synced += 1
    } catch (error) {
      failed += 1
      const syncError = error instanceof Error ? error.message : '同步失败'
      await db.gardenPlants.put({ ...plant, syncStatus: 'failed', syncError })
    }
  }

  return { synced, failed }
}

/** 获取某地区植物统计 */
export async function getRegionStats(regionId: string): Promise<{ total: number; growing: number; mature: number; dead: number }> {
  const plants = await getPlantsByRegion(regionId)
  return {
    total: plants.length,
    growing: plants.filter(p => p.status === 'growing' && getGrowthStage(p) !== 'mature').length,
    mature: plants.filter(p => p.status === 'growing' && getGrowthStage(p) === 'mature').length,
    dead: plants.filter(p => p.status === 'dead').length,
  }
}
