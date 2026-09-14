/**
 * 成长数据看板聚合逻辑（T1.1 成长数据看板）
 * 纯函数：输入品鉴记录列表，输出看板所需的统计 / 分布数据，便于单测与复用。
 */
import type { TastingRecord, TasteDimensions } from '@/types/tasting'
import { TeaType } from '@/types/tea'
import { SOLAR_TERMS, getSolarTermByDate } from '@/data/solarTerms'

/** 看板概要统计 */
export interface GrowthStats {
  total: number
  avgScore: number // 1-10，1 位小数
  maxScore: number
  maxScoreTea: string | null
  topTeaName: string | null
}

const DIMENSION_KEYS: (keyof TasteDimensions)[] = [
  'bitterness', 'sweetness', 'aftertaste', 'body', 'aroma', 'rhyme', 'shape', 'mind',
]

/** 概要统计：总数 / 平均分 / 最高分（及其茶名）/ 最常喝的茶 */
export function computeGrowthStats(records: TastingRecord[]): GrowthStats {
  if (records.length === 0) {
    return { total: 0, avgScore: 0, maxScore: 0, maxScoreTea: null, topTeaName: null }
  }

  const total = records.length
  const sum = records.reduce((acc, record) => acc + record.overallScore, 0)
  const avgScore = Number((sum / total).toFixed(1))

  let maxScore = 0
  let maxScoreTea: string | null = null
  const teaCounts = new Map<string, number>()
  for (const record of records) {
    if (record.overallScore > maxScore) {
      maxScore = record.overallScore
      maxScoreTea = record.teaName
    }
    teaCounts.set(record.teaName, (teaCounts.get(record.teaName) ?? 0) + 1)
  }

  // 最常喝：平票保留先出现的茶（记录按日期倒序加载，先出现 = 最近在喝）
  let topTeaName: string | null = null
  let topCount = 0
  for (const [name, count] of teaCounts) {
    if (count > topCount) {
      topCount = count
      topTeaName = name
    }
  }

  return { total, avgScore, maxScore, maxScoreTea, topTeaName }
}

/** 八维均值（1-5 分，1 位小数）；空记录返回全 0 */
export function averageDimensions(records: TastingRecord[]): Record<string, number> {
  const sums: Record<string, number> = {}
  for (const key of DIMENSION_KEYS) sums[key] = 0
  if (records.length === 0) return sums

  for (const record of records) {
    for (const key of DIMENSION_KEYS) {
      sums[key] = (sums[key] ?? 0) + (record.dimensions[key] ?? 0)
    }
  }
  for (const key of DIMENSION_KEYS) {
    sums[key] = Number((sums[key]! / records.length).toFixed(1))
  }
  return sums
}

/** 茶类分布单条 */
export interface CategoryCount {
  type: TeaType
  count: number
  ratio: number
}

/** 茶类分布：按 teaId 映射六大茶类计数与占比；未知 teaId 跳过；按计数降序，平票按茶类枚举序 */
export function categoryDistribution(
  records: TastingRecord[],
  teaTypeById: Record<string, TeaType>,
): CategoryCount[] {
  const counts = new Map<TeaType, number>()
  for (const record of records) {
    const type = teaTypeById[record.teaId]
    if (!type) continue
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((acc, count) => acc + count, 0)
  if (total === 0) return []

  const enumOrder = new Map<TeaType, number>(
    (Object.keys(TeaType) as (keyof typeof TeaType)[]).map((key, index) => [TeaType[key], index]),
  )
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count, ratio: count / total }))
    .sort(
      (a, b) => b.count - a.count || (enumOrder.get(a.type) ?? 0) - (enumOrder.get(b.type) ?? 0),
    )
}

/** 节气足迹单条 */
export interface SolarTermCount {
  id: string
  name: string
  count: number
}

/** 节气足迹：按记录日期映射节气并聚合；非法日期跳过；按计数降序，平票按节气顺序 */
export function solarTermFootprint(records: TastingRecord[]): SolarTermCount[] {
  const counts = new Map<string, SolarTermCount>()
  const order = new Map<string, number>(SOLAR_TERMS.map((term, index) => [term.id, index]))

  for (const record of records) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(record.date)) continue
    const term = getSolarTermByDate(record.date)
    const entry = counts.get(term.id)
    if (entry) {
      entry.count += 1
    } else {
      counts.set(term.id, { id: term.id, name: term.name, count: 1 })
    }
  }

  return [...counts.values()].sort(
    (a, b) => b.count - a.count || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  )
}
