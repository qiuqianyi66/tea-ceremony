/**
 * API 服务层
 * 封装后端 API 调用，开发模式下可选择性降级
 */

import type { TasteDimensions, TastingRecord } from '@/types/tasting'
import { TeaType, type Tea } from '@/types/tea'

export interface RecordCreateDto {
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

export function toRecordDto(record: Partial<TastingRecord>): RecordCreateDto {
  const dto: RecordCreateDto = { tea_name: record.teaName ?? '未命名茶' }
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
    id: `server-${dto.id}`,
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

// ============ 配置 ============

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const DEV_MODE = import.meta.env.DEV && import.meta.env.VITE_DEV_MODE === 'true'
const REQUEST_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ============ 工具 ============

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  // 附加认证 token
  try {
    const authData = localStorage.getItem('tea-auth')
    if (authData) {
      const { token } = JSON.parse(authData)
      if (token && token !== 'dev-token') {
        headers['Authorization'] = `Bearer ${token}`
      }
    }
  } catch {
    // 忽略解析错误
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { ...headers, ...options?.headers as Record<string, string> },
      ...options,
      signal: options?.signal ?? controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      const message = errText || res.statusText || '请求失败'
      throw new ApiError(`API ${res.status}: ${message}`, res.status)
    }

    // 204 No Content
    if (res.status === 204) return undefined as T

    return await res.json()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时，请检查网络连接')
    }
    if (error instanceof TypeError) {
      throw new ApiError('网络不可用，请稍后重试')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

// 开发模式：返回 mock 数据而非抛错
async function requestOrMock<T>(path: string, options?: RequestInit, mockData?: T): Promise<T> {
  if (DEV_MODE) {
    try {
      return await request<T>(path, options)
    } catch {
      console.warn(`[DEV_MODE] API 调用失败，使用 mock 数据: ${path}`)
      return mockData as T
    }
  }
  return request<T>(path, options)
}

// ============ 认证 API ============

export const authApi = {
  async register(username: string, password: string, displayName?: string) {
    return requestOrMock('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, display_name: displayName }),
    }, {
      access_token: 'dev-token',
      user: { id: 1, username, display_name: displayName || username, level: 1, xp: 0 },
    })
  },

  async login(username: string, password: string) {
    return requestOrMock('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }, {
      access_token: 'dev-token',
      user: { id: 1, username, display_name: username, level: 1, xp: 0 },
    })
  },
}

// ============ 品鉴记录 API ============

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

// ============ 茶叶 API ============

export const teasApi = {
  async list(type?: string): Promise<Tea[]> {
    const query = type ? `?type=${type}` : ''
    const result = await requestOrMock<TeaResponseDto[]>(`/teas${query}`, undefined, [])
    return result.map(toLocalTea)
  },
}
