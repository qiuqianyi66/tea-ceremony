/**
 * 茶叶推荐纯函数（可单测）。
 */
import { teas } from '@/data/teas'
import type { Tea } from '@/types/tea'

/**
 * 风味标签 Jaccard 相似度：|A∩B| / |A∪B|，两者皆空时记 0（无信号不猜）。
 */
function flavorJaccard(a: string[], b: string[]): number {
  const union = new Set([...a, ...b]).size
  if (union === 0) return 0
  const sa = new Set(a)
  const inter = b.filter((f) => sa.has(f)).length
  return inter / union
}

/**
 * 冲泡水温接近度：与 scoring.ts 工艺系数同刻度（30°C 线性衰减，1 - |Δ|/30），
 * 作为风味全同时的次级排序信号。
 */
function tempCloseness(a: number, b: number): number {
  return Math.max(0, 1 - Math.abs(a - b) / 30)
}

/**
 * 同类型相似茶推荐：排除自身，按风味 Jaccard 降序 → 水温接近度降序 → 数据顺序（稳定排序）。
 * 旧实现按数据顺序取前 limit，无相似度计算；排序信号只有两个可解释因子，不引入权重猜值。
 * @param teaId 当前茶 id
 * @param limit 返回数量，默认 3
 */
export function getSimilarTeas(teaId: string, limit = 3): Tea[] {
  const current = teas.find((t) => t.id === teaId)
  if (!current) return []
  return teas
    .filter((t) => t.type === current.type && t.id !== teaId)
    .map((t) => ({
      tea: t,
      flavorSim: flavorJaccard(current.flavor, t.flavor),
      tempSim: tempCloseness(current.bestTemp, t.bestTemp),
    }))
    .sort((a, b) => b.flavorSim - a.flavorSim || b.tempSim - a.tempSim)
    .slice(0, limit)
    .map((x) => x.tea)
}
