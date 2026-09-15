/**
 * 茶园生长计算单测（纯函数）：src/services/garden.ts
 * T4.1 养成降级后仅保留生长阶段/湿度等纯计算（3D 场景引用），无 DB/网络依赖。
 */
import { describe, expect, it } from 'vitest'
import {
  getPlantDays, getGrowthStage, getGrowthStageInfo,
  getGrowthProgress, getCurrentWaterLevel, isPlantDead, isGrowthPaused,
  GROWTH_STAGES, DEAD_WATER, DEAD_DAYS,
} from '@/services/garden'
import type { PlantedTea } from '@/types/garden'

function makePlant(overrides: Partial<PlantedTea> = {}): PlantedTea {
  const now = Date.now()
  return {
    regionId: 'hangzhou',
    teaId: 'longjing',
    plantedAt: new Date(now).toISOString(),
    lastWateredAt: new Date(now).toISOString(),
    waterLevel: 100,
    pruned: false,
    status: 'growing',
    harvestCount: 0,
    ...overrides,
  }
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

describe('garden 生长计算（纯函数）', () => {
  it('getPlantDays：按真实时间计算种植天数，非负', () => {
    expect(getPlantDays(makePlant())).toBe(0)
    expect(getPlantDays(makePlant({ plantedAt: daysAgo(3.5) }))).toBeGreaterThan(3)
    expect(getPlantDays(makePlant({ plantedAt: daysAgo(3.5) }))).toBeLessThan(4)
  })

  it('getGrowthStage：按 14 天周期返回阶段（萌芽/幼苗/成长/成熟/恢复/枯萎）', () => {
    expect(getGrowthStage(makePlant())).toBe('sprout')
    expect(getGrowthStage(makePlant({ plantedAt: daysAgo(3) }))).toBe('seedling')
    expect(getGrowthStage(makePlant({ plantedAt: daysAgo(7) }))).toBe('growing')
    expect(getGrowthStage(makePlant({ plantedAt: daysAgo(12) }))).toBe('mature')
    expect(getGrowthStage(makePlant({ status: 'harvested' }))).toBe('recovery')
    expect(getGrowthStage(makePlant({ status: 'dead' }))).toBe('sprout')
  })

  it('getGrowthStageInfo：recovery 返回恢复期信息，其余命中配置表', () => {
    expect(getGrowthStageInfo(makePlant({ status: 'harvested' }))?.label).toBe('恢复期')
    expect(getGrowthStageInfo(makePlant())?.label).toBe('萌芽期')
    expect(GROWTH_STAGES.length).toBe(4)
  })

  it('getGrowthProgress：按天数归一化到 0-1，已采/枯萎为 1', () => {
    expect(getGrowthProgress(makePlant())).toBe(0)
    expect(getGrowthProgress(makePlant({ plantedAt: daysAgo(7) }))).toBeCloseTo(0.5)
    expect(getGrowthProgress(makePlant({ status: 'harvested' }))).toBe(1)
  })

  it('getCurrentWaterLevel：随天数衰减、封顶 0-100', () => {
    expect(getCurrentWaterLevel(makePlant())).toBe(100)
    const decayed = getCurrentWaterLevel(makePlant({ lastWateredAt: daysAgo(2), waterLevel: 100 }))
    expect(decayed).toBeGreaterThan(50)
    expect(decayed).toBeLessThan(70)
    const longAgo = getCurrentWaterLevel(makePlant({ lastWateredAt: daysAgo(30), waterLevel: 100 }))
    expect(longAgo).toBe(0)
  })

  it('isPlantDead / isGrowthPaused：低湿度 + 持续天数判定', () => {
    expect(isPlantDead(makePlant())).toBe(false)
    // 湿度低于 DEAD_WATER 且超过 DEAD_DAYS 未浇水 → 枯萎
    expect(isPlantDead(makePlant({ lastWateredAt: daysAgo(DEAD_DAYS + 1), waterLevel: DEAD_WATER - 1 }))).toBe(true)
    // 生长暂停阈值高于枯萎阈值：仅湿度低未够天数不算枯萎，但算暂停
    expect(isGrowthPaused(makePlant({ lastWateredAt: daysAgo(5), waterLevel: 100 }))).toBe(true)
  })
})
