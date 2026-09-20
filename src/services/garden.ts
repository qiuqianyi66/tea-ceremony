/**
 * 茶园生长计算（纯函数）
 * T4.1 养成降级为纯观赏后：种植/浇水/采摘/后端同步等操作链路已删除，
 * 仅保留 3D 茶园场景（TeaGardenSceneInner）引用的生长阶段计算。
 * 若未来 3D 场景移除 plants 渲染，本文件可随之删除。
 */
import type { GrowthStage, GrowthStageInfo, PlantedTea } from '@/types/garden'

// ============ 生长周期配置（14 天） ============

export const GROWTH_STAGES: GrowthStageInfo[] = [
  {
    stage: 'sprout',
    label: '萌芽期',
    dayRange: [0, 2],
    description: '茶苗破土，新芽初绽',
    needsPruning: false,
  },
  {
    stage: 'seedling',
    label: '幼苗期',
    dayRange: [2, 5],
    description: '真叶展开，根系生长',
    needsPruning: true,
  },
  {
    stage: 'growing',
    label: '成长期',
    dayRange: [5, 10],
    description: '枝叶茂盛，树冠形成',
    needsPruning: false,
  },
  {
    stage: 'mature',
    label: '成熟期',
    dayRange: [10, 14],
    description: '新芽冒头，可以采摘',
    needsPruning: false,
  },
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
    return {
      stage: 'recovery',
      label: '恢复期',
      dayRange: [0, RECOVERY_DAYS],
      description: '休养生息，之后又能采摘',
      needsPruning: false,
    }
  }
  return GROWTH_STAGES.find((s) => s.stage === stage) ?? null
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
