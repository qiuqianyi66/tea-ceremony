/**
 * 口味画像计算：从品鉴记录提炼个人风味偏好（纯函数，可单测）。
 *
 * 输出：
 * - typeStats：六大茶类品鉴次数 + 均分 + 相对百分比
 * - flavorStats：风味出现频次（前 N）
 * - avgDimensions：八维口感平均分
 * - personalTip：基于画像的个人茶语推荐
 */
import { teas } from '@/data/teas'
import { TeaType } from '@/types/tea'
import type { TastingRecord } from '@/types/tasting'

export const DIM_KEYS = ['bitterness', 'sweetness', 'aftertaste', 'body', 'aroma', 'rhyme', 'shape', 'mind'] as const

export interface TypeStat {
  type: string
  count: number
  avg: number
  pct: number
}

/** 六大茶类品鉴统计（次数 + 均分），按次数降序，未品鉴的茶类保留 0。 */
export function buildTypeStats(history: TastingRecord[]): TypeStat[] {
  const stats: Record<string, { count: number; scoreSum: number }> = {}
  for (const r of history) {
    const t = teas.find(tt => tt.id === r.teaId)
    const type = t?.type ?? '未知'
    if (!stats[type]) stats[type] = { count: 0, scoreSum: 0 }
    stats[type].count += 1
    stats[type].scoreSum += r.overallScore
  }
  const maxCount = Math.max(1, ...Object.values(stats).map(s => s.count))
  return (Object.values(TeaType) as string[])
    .map(type => {
      const s = stats[type]
      return {
        type,
        count: s?.count ?? 0,
        avg: s?.count ? +(s.scoreSum / s.count).toFixed(1) : 0,
        pct: s ? Math.round((s.count / maxCount) * 100) : 0,
      }
    })
    .sort((a, b) => b.count - a.count)
}

/** 风味偏好：按品鉴记录反查茶叶风味，取出现频次前 limit（默认 8）。 */
export function buildFlavorStats(history: TastingRecord[], limit = 8): Array<[string, number]> {
  const freq = new Map<string, number>()
  for (const r of history) {
    const t = teas.find(tt => tt.id === r.teaId)
    if (!t) continue
    for (const f of t.flavor) freq.set(f, (freq.get(f) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

/** 八维口感平均分；无记录返回空对象。 */
export function buildAvgDimensions(history: TastingRecord[]): Record<string, number> {
  if (history.length === 0) return {}
  const sums: Record<string, number> = {}
  for (const r of history) {
    for (const k of DIM_KEYS) sums[k] = (sums[k] ?? 0) + r.dimensions[k]
  }
  return Object.fromEntries(DIM_KEYS.map(k => [k, +((sums[k] ?? 0) / history.length).toFixed(1)]))
}

/** 个人茶语：推荐最高频茶类中尚未品鉴的一款。 */
export function buildPersonalTip(history: TastingRecord[]): string {
  if (history.length === 0) return '完成第一次品鉴，解锁你的专属口味画像'
  const fav = buildTypeStats(history)[0]!
  const sameTypeUntasted = teas.filter(t =>
    t.type === fav.type && !history.some(r => r.teaId === t.id),
  )
  if (sameTypeUntasted.length > 0) {
    const next = sameTypeUntasted[0]!
    return `你偏爱${fav.type}（品鉴 ${fav.count} 次，均分 ${fav.avg}）。下一杯试试 ${next.name}：${next.description.slice(0, 24)}…`
  }
  return `你偏爱${fav.type}，同门茶已尝遍。不妨跨出舒适区，换一个茶类感受新的风味世界。`
}
