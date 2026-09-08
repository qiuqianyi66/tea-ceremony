/**
 * 茶园采摘逻辑单测：src/services/garden.ts
 * 覆盖：成熟期可采 → 恢复期 + 计数 + 时间；未成熟不可采；重复采摘幂等。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { initDB, db } from '@/services/storage'
import { gardenApi } from '@/services/api'
import { harvestPlant, plantTea, getGrowthStage } from '@/services/garden'

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

describe('garden.harvestPlant 采摘逻辑', () => {
  beforeEach(async () => {
    await initDB()
    await db.gardenPlants.clear()
    // 同步走本地标记即可（单测不依赖后端），默认上传成功。
    vi.restoreAllMocks()
    vi.spyOn(gardenApi, 'upsert').mockResolvedValue({} as never)
  })

  it('成熟期（≥10 天）可采摘：状态转恢复期、计数 +1、记录时间', async () => {
    const plant = await plantTea('hangzhou', 'longjing')
    // 改为 12 天前种植，处于成熟期
    plant.plantedAt = daysAgo(12)
    await db.gardenPlants.put(plant)

    expect(getGrowthStage(plant)).toBe('mature')

    await harvestPlant(plant.id!)

    const after = await db.gardenPlants.get(plant.id!)
    expect(after?.status).toBe('harvested')
    expect(after?.harvestCount).toBe(1)
    expect(after?.harvestedAt).toBeTruthy()
    // 采摘后进入恢复期
    expect(getGrowthStage(after!)).toBe('recovery')
  })

  it('未成熟（萌芽期）不可采摘：状态与计数不变', async () => {
    const plant = await plantTea('hangzhou', 'longjing')
    await harvestPlant(plant.id!)
    const after = await db.gardenPlants.get(plant.id!)
    expect(after?.status).toBe('growing')
    expect(after?.harvestCount).toBe(0)
    expect(after?.harvestedAt).toBeUndefined()
  })

  it('已采摘（恢复期）重复调用幂等：计数不重复累加', async () => {
    const plant = await plantTea('hangzhou', 'longjing')
    plant.plantedAt = daysAgo(12)
    await db.gardenPlants.put(plant)

    await harvestPlant(plant.id!)
    await harvestPlant(plant.id!)

    const after = await db.gardenPlants.get(plant.id!)
    expect(after?.harvestCount).toBe(1)
  })

  it('不存在记录调用不抛错', async () => {
    await expect(harvestPlant(99999)).resolves.toBeUndefined()
  })

  it('种植/采摘后同步标记为 synced（离线优先上行）', async () => {
    const plant = await plantTea('hangzhou', 'longjing')
    expect((await db.gardenPlants.get(plant.id!))?.syncStatus).toBe('synced')

    plant.plantedAt = daysAgo(12)
    await db.gardenPlants.put(plant)
    await harvestPlant(plant.id!)
    expect((await db.gardenPlants.get(plant.id!))?.syncStatus).toBe('synced')
  })

  it('后端不可达时本地操作不受影响，标记 failed 可后续重试', async () => {
    vi.spyOn(gardenApi, 'upsert').mockRejectedValue(new Error('网络不可用'))
    const plant = await plantTea('hangzhou', 'longjing')
    const after = await db.gardenPlants.get(plant.id!)
    expect(after?.status).toBe('growing')
    expect(after?.syncStatus).toBe('failed')
    expect(after?.syncError).toBeTruthy()
  })
})
