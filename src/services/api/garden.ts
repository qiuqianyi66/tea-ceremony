/** 茶园 API（离线优先，client_id 幂等） */

import type { PlantedTea } from '@/types/garden'
import { requestOrMock } from '../http'

export interface GardenPlantCreateDto {
  client_id: string
  region_id: string
  tea_id: string
  planted_at: string
  last_watered_at?: string | null
  water_level: number
  pruned: boolean
  status: string
  harvest_count: number
  harvested_at?: string | null
}

interface GardenPlantResponseDto extends GardenPlantCreateDto {
  id: number
  user_id?: number | null
  created_at: string
}

/** 本地 PlantedTea → 服务端 DTO（snake_case） */
export function toGardenPlantDto(plant: PlantedTea): GardenPlantCreateDto {
  return {
    client_id: String(plant.id ?? ''),
    region_id: plant.regionId,
    tea_id: plant.teaId,
    planted_at: plant.plantedAt,
    last_watered_at: plant.lastWateredAt ?? null,
    water_level: plant.waterLevel,
    pruned: plant.pruned,
    status: plant.status,
    harvest_count: plant.harvestCount ?? 0,
    harvested_at: plant.harvestedAt ?? null,
  }
}

export const gardenApi = {
  /** 幂等 upsert 单株（离线重试安全，同 client_id 只产生一条服务端记录） */
  async upsert(plant: PlantedTea) {
    return requestOrMock('/garden-plants', {
      method: 'POST',
      body: JSON.stringify(toGardenPlantDto(plant)),
    })
  },

  /** 拉取服务端茶园（登录后恢复跨设备数据） */
  async list(): Promise<GardenPlantResponseDto[]> {
    return requestOrMock<GardenPlantResponseDto[]>('/garden-plants', undefined, [])
  },
}
