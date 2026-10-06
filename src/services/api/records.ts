/** 品鉴记录 API（Spring Boot /api/v1/records，契约见 .harness/wiki/api-contract.md） */

import type { TasteDimensions, TastingRecord } from '@/types/tasting'
import { requestOrMock } from '../http'

export interface RecordCreateDto {
  /** 新契约必填：幂等键（V1 表 NOT NULL，uk_tasting_records_user_client） */
  client_id: string
  tea_name: string
  tea_id?: number
  brew_temp?: number
  brew_time?: number
  infusions?: number
  water_type?: string
  dimensions?: TasteDimensions
  overall_score?: number
  process_factor?: number
  aroma_type?: string
  notes?: string
  weather?: string
  mood?: string
}

/** 新后端 RecordVo（snake_case 字段名；含 client_id/ware_id） */
interface RecordVo {
  id: number
  client_id: string
  tea_id?: number | null
  tea_name: string
  brew_temp?: number | null
  brew_time?: number | null
  infusions?: number | null
  water_type?: string | null
  ware_id?: number | null
  dimensions?: TasteDimensions | null
  overall_score?: number | null
  process_factor?: number | null
  aroma_type?: string | null
  notes?: string | null
  weather?: string | null
  mood?: string | null
  created_at: string
}

interface ApiResponse<T> {
  code: string
  message: string
  data: T
}

/** 新契约分页结构 */
interface RecordPage {
  items: RecordVo[]
  total: number
  page: number
  size: number
}

export function toRecordDto(record: Partial<TastingRecord>): RecordCreateDto {
  const dto: RecordCreateDto = {
    // client_id 必填：本地记录均有 id（uuid/server-*）；兜底时间戳防 400
    client_id: record.id ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tea_name: record.teaName ?? '未命名茶',
  }
  const teaId = record.teaApiId ?? Number(record.teaId)
  if (Number.isInteger(teaId)) dto.tea_id = teaId
  if (record.brewTemp !== undefined) dto.brew_temp = record.brewTemp
  if (record.brewTime !== undefined) dto.brew_time = record.brewTime
  if (record.infusions !== undefined) dto.infusions = record.infusions
  if (record.dimensions) dto.dimensions = record.dimensions
  if (record.overallScore !== undefined) dto.overall_score = record.overallScore
  if (record.processFactor !== undefined) dto.process_factor = record.processFactor
  if (record.aromaType) dto.aroma_type = record.aromaType
  if (record.notes) dto.notes = record.notes
  if (record.weather) dto.weather = record.weather
  if (record.mood) dto.mood = record.mood
  return dto
}

/** 将服务端 snake_case 记录还原为前端离线业务模型。 */
function fromRecordDto(dto: RecordVo): TastingRecord {
  const dimensions = dto.dimensions ?? ({} as TasteDimensions)
  return {
    id: dto.client_id ?? `server-${dto.id}`,
    teaId: dto.tea_id == null ? '' : String(dto.tea_id),
    ...(dto.tea_id != null ? { teaApiId: dto.tea_id } : {}),
    teaName: dto.tea_name,
    date: dto.created_at,
    brewTemp: dto.brew_temp ?? 0,
    brewTime: dto.brew_time ?? 0,
    infusions: dto.infusions ?? 1,
    dimensions: {
      bitterness: dimensions.bitterness ?? 0,
      sweetness: dimensions.sweetness ?? 0,
      aftertaste: dimensions.aftertaste ?? 0,
      body: dimensions.body ?? 0,
      aroma: dimensions.aroma ?? 0,
      rhyme: dimensions.rhyme ?? 0,
      shape: dimensions.shape ?? 0,
      mind: dimensions.mind ?? 0,
    },
    overallScore: dto.overall_score ?? 0,
    processFactor: dto.process_factor ?? 0,
    // exactOptionalPropertyTypes：服务端未返回的可选字段不写，避免显式 undefined
    ...(dto.aroma_type ? { aromaType: dto.aroma_type } : {}),
    ...(dto.notes ? { notes: dto.notes } : {}),
    ...(dto.weather ? { weather: dto.weather } : {}),
    ...(dto.mood ? { mood: dto.mood } : {}),
    syncStatus: 'synced',
  }
}

export const recordsApi = {
  /** 列表（新契约分页；size 取上限 100 保持现有"一次全量"语义） */
  async list(): Promise<TastingRecord[]> {
    const result = await requestOrMock<ApiResponse<RecordPage>>(
      '/v1/records?page=1&size=100',
      undefined,
      { code: 'OK', message: 'ok', data: { items: [], total: 0, page: 1, size: 20 } },
    )
    return result.data.items.map(fromRecordDto)
  },

  /** 创建（幂等：client_id 重复提交返回已有记录）。不设 mock——失败抛错，供离线同步降级（history.ts catch） */
  async create(record: Partial<TastingRecord>) {
    const result = await requestOrMock<ApiResponse<RecordVo>>('/v1/records', {
      method: 'POST',
      body: JSON.stringify(toRecordDto(record)),
    })
    return result.data
  },

  async delete(id: number) {
    const result = await requestOrMock<ApiResponse<{ message: string }>>(`/v1/records/${id}`, {
      method: 'DELETE',
    })
    return result.data
  },
}
