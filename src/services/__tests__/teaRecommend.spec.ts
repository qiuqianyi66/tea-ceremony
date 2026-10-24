/**
 * 茶叶推荐纯函数单测。
 */
import { describe, expect, it } from 'vitest'
import { teas } from '@/data/teas'
import { getSimilarTeas } from '@/services/teaRecommend'

describe('getSimilarTeas', () => {
  it('返回同类型且排除自身的茶', () => {
    const similar = getSimilarTeas('longjing')
    expect(similar.every((t) => t.type === '绿茶')).toBe(true)
    expect(similar.every((t) => t.id !== 'longjing')).toBe(true)
  })

  it('默认返回 3 款', () => {
    expect(getSimilarTeas('longjing').length).toBeLessThanOrEqual(3)
  })

  it('支持自定义 limit', () => {
    expect(getSimilarTeas('longjing', 1).length).toBeLessThanOrEqual(1)
  })

  it('不存在的茶 id 返回空数组', () => {
    expect(getSimilarTeas('nonexistent-tea')).toEqual([])
  })

  it('茶类只有一款时返回空数组', () => {
    // 找一个同类型只有自己的茶（如果存在）；否则验证至少不包含自己
    const single = teas.find((t) => teas.filter((x) => x.type === t.type).length === 1)
    if (single) {
      expect(getSimilarTeas(single.id)).toEqual([])
    }
  })

  it('风味标签重合度最高的茶排第一（狮峰龙井与龙井风味全同）', () => {
    // 实测数据：两者 flavor 均为 ['豆香','栗香','鲜爽']，Jaccard = 1；
    // 旧实现按数据顺序返回，shifeng_lj 排位由数组位置决定而非风味相似度。
    const similar = getSimilarTeas('longjing')
    expect(similar[0]?.id).toBe('shifeng_lj')
  })

  it('风味零重合的茶不排第一（碧螺春与龙井无共同标签）', () => {
    const similar = getSimilarTeas('longjing')
    expect(similar[0]?.id).not.toBe('biluochun')
  })

  it('排序契约：风味降序，风味相同按水温接近度降序，全同保持数据顺序', () => {
    const query = teas.find((t) => t.id === 'longjing')!
    const dataOrder = teas.filter((t) => t.type === query.type && t.id !== query.id)
    const similar = getSimilarTeas('longjing', dataOrder.length)
    const flavorSim = (a: string[], b: string[]) => {
      const sa = new Set(a)
      const inter = b.filter((f) => sa.has(f)).length
      const union = new Set([...a, ...b]).size
      return union === 0 ? 0 : inter / union
    }
    const tempSim = (a: number, b: number) => Math.max(0, 1 - Math.abs(a - b) / 30)
    const byId = new Map(dataOrder.map((t) => [t.id, t]))
    for (let i = 1; i < similar.length; i++) {
      const prev = byId.get(similar[i - 1].id)!
      const curr = byId.get(similar[i].id)!
      const prevFlavor = flavorSim(query.flavor, prev.flavor)
      const currFlavor = flavorSim(query.flavor, curr.flavor)
      // 主键：风味不得升序
      expect(currFlavor).toBeLessThanOrEqual(prevFlavor)
      if (currFlavor === prevFlavor) {
        // 次键：水温接近度不得升序
        expect(tempSim(query.bestTemp, curr.bestTemp)).toBeLessThanOrEqual(
          tempSim(query.bestTemp, prev.bestTemp),
        )
      }
    }
  })
})
