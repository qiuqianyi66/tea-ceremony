/** 茶叶 API（Spring Boot /api/v1/teas，契约见 .harness/wiki/api-contract.md） */

import { type Tea, TeaType } from '@/types/tea'
import { requestOrMock } from '../http'

/** 新后端 TeaVo（snake_case 字段名，V2 种子全字段） */
interface TeaVo {
  id: number
  name: string
  category: string
  origin?: string | null
  region_id?: number | null
  process_id?: number | null
  best_temp?: number | null
  best_time?: number | null
  infusions?: number | null
  flavor?: string[] | null
  story?: string | null
  description?: string | null
  altitude?: number | null
  historical_period?: string | null
  water_requirement?: string | null
  soup_color_min?: string | null
  soup_color_max?: string | null
  dry_tea_color?: string | null
}

interface ApiResponse<T> {
  code: string
  message: string
  data: T
}

/** 新契约分页结构（page 1-based） */
interface TeaPage {
  items: TeaVo[]
  total: number
  page: number
  size: number
}

function toLocalTea(dto: TeaVo): Tea {
  const type = Object.values(TeaType).includes(dto.category as TeaType)
    ? (dto.category as TeaType)
    : TeaType.GREEN
  return {
    id: `server-${dto.id}`,
    apiId: dto.id,
    name: dto.name,
    type,
    origin: dto.origin ?? '未知产地',
    // exactOptionalPropertyTypes：null/undefined 时不写可选字段，避免显式 undefined
    ...(dto.altitude != null ? { altitude: String(dto.altitude) } : {}),
    ...(dto.region_id != null ? { regionId: dto.region_id } : {}),
    ...(dto.process_id != null ? { processId: dto.process_id } : {}),
    bestTemp: dto.best_temp ?? 80,
    bestTime: dto.best_time ?? 30,
    infusions: dto.infusions ?? 5,
    flavor: dto.flavor ?? [],
    story: dto.story ?? '一盏茶，静候当下。',
    description: dto.description ?? '来自茶园的当季好茶。',
    ...(dto.historical_period ? { historicalPeriod: dto.historical_period } : {}),
    ...(dto.water_requirement ? { waterRequirement: dto.water_requirement } : {}),
    // 新后端返回真实汤色/干茶色（V2 种子），替换原硬编码兜底
    dryTeaColor: dto.dry_tea_color ?? '#8a6a3d',
    soupColorMin: dto.soup_color_min ?? '#d6b36a',
    soupColorMax: dto.soup_color_max ?? '#8f5d2d',
  }
}

export const teasApi = {
  /** 列表（新契约：category 茶类筛选、page 1-based；size 取上限 100 保持现有"一次全量"语义） */
  async list(type?: string): Promise<Tea[]> {
    const params = new URLSearchParams()
    if (type) params.set('category', type)
    params.set('page', '1')
    params.set('size', '100')
    const result = await requestOrMock<ApiResponse<TeaPage>>(
      `/v1/teas?${params.toString()}`,
      undefined,
      { code: 'OK', message: 'ok', data: { items: [], total: 0, page: 1, size: 20 } },
    )
    return result.data.items.map(toLocalTea)
  },
}
