/**
 * 品鉴卡分享链接：把品鉴记录编码为可放入 URL 的 base64url 参数，
 * 供「只读分享页」与二维码使用。纯函数、无 DOM 依赖，便于单测。
 */

import type { TastingRecord, TasteDimensions } from '@/types/tasting'

/** 分享用品鉴卡数据快照（不含内部 id / 同步字段，可安全放进 URL） */
export interface TastingCardShareData {
  teaName: string
  date: string
  brewTemp: number
  brewTime: number
  infusions: number
  dimensions: TasteDimensions
  overallScore: number
  processFactor: number
  aromaType?: string
  notes?: string
  weather?: string
  mood?: string
}

const DIMENSION_KEYS = ['bitterness', 'sweetness', 'aftertaste', 'body', 'aroma', 'rhyme', 'shape', 'mind'] as const

/** 从完整品鉴记录提取分享快照（剔除内部 id / 同步字段）。 */
export function toShareData(record: TastingRecord): TastingCardShareData {
  return {
    teaName: record.teaName,
    date: record.date,
    brewTemp: record.brewTemp,
    brewTime: record.brewTime,
    infusions: record.infusions,
    dimensions: { ...record.dimensions },
    overallScore: record.overallScore,
    processFactor: record.processFactor,
    ...(record.aromaType ? { aromaType: record.aromaType } : {}),
    ...(record.notes ? { notes: record.notes } : {}),
    ...(record.weather ? { weather: record.weather } : {}),
    ...(record.mood ? { mood: record.mood } : {}),
  }
}

/** bytes → base64url（RFC 4648，无填充）。 */
function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** base64url → bytes；字符集非法或解码失败返回 null。 */
function base64urlToBytes(value: string): Uint8Array | null {
  const cleaned = value.replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) return null
  try {
    const pad = cleaned.length % 4 === 0 ? '' : '='.repeat(4 - (cleaned.length % 4))
    const binary = atob(cleaned + pad)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** 校验未知输入是否为合法的分享快照；不合法返回 null。 */
function validateShareData(raw: unknown): TastingCardShareData | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.teaName !== 'string' || !r.teaName) return null
  if (typeof r.date !== 'string' || !r.date) return null
  if (typeof r.brewTemp !== 'number' || typeof r.brewTime !== 'number') return null
  if (typeof r.infusions !== 'number') return null
  if (typeof r.overallScore !== 'number' || typeof r.processFactor !== 'number') return null
  if (typeof r.dimensions !== 'object' || r.dimensions === null) return null
  const dims = r.dimensions as Record<string, unknown>
  // 逐个校验并收窄类型（noUncheckedIndexedAccess 下索引取值可为 undefined）
  const dimensions = {} as Record<(typeof DIMENSION_KEYS)[number], number>
  for (const key of DIMENSION_KEYS) {
    const value = dims[key]
    if (typeof value !== 'number') return null
    dimensions[key] = value
  }

  const optional = ['aromaType', 'notes', 'weather', 'mood'] as const
  for (const key of optional) {
    if (r[key] !== undefined && typeof r[key] !== 'string') return null
  }

  const result: TastingCardShareData = {
    teaName: r.teaName,
    date: r.date,
    brewTemp: r.brewTemp,
    brewTime: r.brewTime,
    infusions: r.infusions,
    dimensions,
    overallScore: r.overallScore,
    processFactor: r.processFactor,
  }
  for (const key of optional) {
    if (typeof r[key] === 'string') (result[key] as string) = r[key]
  }
  return result
}

/** 编码分享快照为 base64url 字符串。 */
export function encodeShareData(data: TastingCardShareData): string {
  const json = JSON.stringify(data)
  return bytesToBase64url(new TextEncoder().encode(json))
}

/** 解码并校验 base64url 字符串；任何非法输入返回 null。 */
export function decodeShareData(encoded: string): TastingCardShareData | null {
  if (!encoded) return null
  const bytes = base64urlToBytes(encoded)
  if (!bytes) return null
  try {
    const json = new TextDecoder().decode(bytes)
    return validateShareData(JSON.parse(json))
  } catch {
    return null
  }
}

/**
 * 构建绝对分享 URL（含 BASE_URL 前缀）。
 * @param base 默认取 location.origin + BASE_URL；测试可显式传入。
 */
export function buildShareUrl(
  encoded: string,
  base = `${window.location.origin}${import.meta.env.BASE_URL}`,
): string {
  const normalized = base.endsWith('/') ? base : `${base}/`
  const url = new URL('share', normalized)
  url.searchParams.set('r', encoded)
  return url.toString()
}

/** 从查询参数解析分享记录；缺失或非法返回 null。 */
export function parseShareQuery(raw: unknown): TastingCardShareData | null {
  if (typeof raw !== 'string' || !raw) return null
  return decodeShareData(raw)
}
