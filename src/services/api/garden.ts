/**
 * 茶园 API（Spring Boot /api/v1/garden-plants + /api/v1/garden-energy，契约见 .harness/wiki/api-contract.md）
 * S1：种植幂等 upsert + 能量总览 + 一键收集（ADR-015 事件账本）。
 */

import { requestOrMock } from '../http'

export interface GardenPlantCreateDto {
  /** 幂等键（V1 表 NOT NULL，uk_garden_plants_user_client） */
  client_id: string
  plant_type?: string
}

export interface GardenPlantVo {
  id: number
  client_id: string
  plant_type?: string | null
  status: string
  energy: number
  created_at: string
  updated_at: string
}

export interface GardenEnergySummaryVo {
  /** 未收能量（collected_at IS NULL 合计） */
  pending_amount: number
  /** 已收能量合计 */
  collected_amount: number
  /** 已转入植物累计 */
  total_energy: number
  /** 当前阶段 planted/growing/blooming/harvested */
  phase: string
  /** 各阶段阈值（前端进度展示） */
  phase_thresholds: Record<string, number>
}

interface ApiResponse<T> {
  code: string
  message: string
  data: T
}

/** 空摘要 mock（DEV_MODE 降级；阈值与后端 application.yml garden.energy.phases 对齐） */
const EMPTY_SUMMARY: GardenEnergySummaryVo = {
  pending_amount: 0,
  collected_amount: 0,
  total_energy: 0,
  phase: 'planted',
  phase_thresholds: { planted: 0, growing: 100, blooming: 300, harvested: 600 },
}

export const gardenApi = {
  async list(): Promise<GardenPlantVo[]> {
    const result = await requestOrMock<ApiResponse<GardenPlantVo[]>>(
      '/v1/garden-plants',
      undefined,
      { code: 'OK', message: 'ok', data: [] },
    )
    return result.data
  },

  /** 种植（幂等 upsert：client_id 重复返回已有植物） */
  async create(dto: GardenPlantCreateDto): Promise<GardenPlantVo> {
    const result = await requestOrMock<ApiResponse<GardenPlantVo>>('/v1/garden-plants', {
      method: 'POST',
      body: JSON.stringify(dto),
    })
    return result.data
  },
}

export const energyApi = {
  async summary(): Promise<GardenEnergySummaryVo> {
    const result = await requestOrMock<ApiResponse<GardenEnergySummaryVo>>(
      '/v1/garden-energy',
      undefined,
      { code: 'OK', message: 'ok', data: EMPTY_SUMMARY },
    )
    return result.data
  },

  /** 一键收集（未收事件 → plants.energy + 阶段推进，幂等可重复调） */
  async collect(): Promise<GardenEnergySummaryVo> {
    const result = await requestOrMock<ApiResponse<GardenEnergySummaryVo>>(
      '/v1/garden-energy/collect',
      {
        method: 'POST',
      },
    )
    return result.data
  },
}
