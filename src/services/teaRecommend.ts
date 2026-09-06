/**
 * 茶叶推荐纯函数（可单测）。
 */
import { teas } from '@/data/teas'
import type { Tea } from '@/types/tea'

/**
 * 同类型相似茶推荐：排除自身，按数据顺序取前 limit 款。
 * @param teaId 当前茶 id
 * @param limit 返回数量，默认 3
 */
export function getSimilarTeas(teaId: string, limit = 3): Tea[] {
  const current = teas.find(t => t.id === teaId)
  if (!current) return []
  return teas.filter(t => t.type === current.type && t.id !== teaId).slice(0, limit)
}
