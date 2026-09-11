/** 茶叶 API */

import { TeaType, type Tea } from '@/types/tea'
import { requestOrMock } from '../http'

interface TeaResponseDto {
  id: number
  name: string
  category: string
  origin?: string | null
  region_id?: number | null
  process_id?: number | null
  best_temp?: number | null
  best_time?: number | null
  flavor?: string[] | null
  story?: string | null
  description?: string | null
}

function toLocalTea(dto: TeaResponseDto): Tea {
  const type = Object.values(TeaType).includes(dto.category as TeaType)
    ? dto.category as TeaType
    : TeaType.GREEN
  return {
    id: `server-${dto.id}`,
    apiId: dto.id,
    name: dto.name,
    type,
    origin: dto.origin ?? '未知产地',
    regionId: dto.region_id ?? undefined,
    processId: dto.process_id ?? undefined,
    bestTemp: dto.best_temp ?? 80,
    bestTime: dto.best_time ?? 30,
    infusions: 5,
    flavor: dto.flavor ?? [],
    story: dto.story ?? '一盏茶，静候当下。',
    description: dto.description ?? '来自茶园的当季好茶。',
    dryTeaColor: '#8a6a3d',
    soupColorMin: '#d6b36a',
    soupColorMax: '#8f5d2d',
  }
}

export const teasApi = {
  async list(type?: string): Promise<Tea[]> {
    const query = type ? `?type=${type}` : ''
    const result = await requestOrMock<TeaResponseDto[]>(`/teas${query}`, undefined, [])
    return result.map(toLocalTea)
  },
}
