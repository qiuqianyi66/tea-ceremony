/** 品鉴记录 API */

import type { TasteDimensions, TastingRecord } from '@/types/tasting'
import { requestOrMock } from '../http'

export interface RecordCreateDto {
  client_id?: string
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

interface RecordResponseDto extends RecordCreateDto {
  id: number
  user_id?: number | null
  created_at: string
}

export function toRecordDto(record: Partial<TastingRecord>): RecordCreateDto {
  const dto: RecordCreateDto = {
    client_id: record.id,
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
function fromRecordDto(dto: RecordResponseDto): TastingRecord {
  const dimensions = dto.dimensions ?? {} as TasteDimensions
  return {
    id: dto.client_id ?? `server-${dto.id}`,
    teaId: dto.tea_id == null ? '' : String(dto.tea_id),
    teaApiId: dto.tea_id ?? undefined,
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
    aromaType: dto.aroma_type,
    notes: dto.notes,
    weather: dto.weather,
    mood: dto.mood,
    syncStatus: 'synced',
  }
}

export const recordsApi = {
  async list(): Promise<TastingRecord[]> {
    const records = await requestOrMock<RecordResponseDto[]>('/records', undefined, [])
    return records.map(fromRecordDto)
  },

  async create(record: Partial<TastingRecord>) {
    return requestOrMock('/records', {
      method: 'POST',
      body: JSON.stringify(toRecordDto(record)),
    })
  },

  async delete(id: number) {
    return requestOrMock(`/records/${id}`, { method: 'DELETE' })
  },
}
