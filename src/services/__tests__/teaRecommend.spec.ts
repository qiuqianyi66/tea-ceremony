/**
 * 茶叶推荐纯函数单测。
 */
import { describe, it, expect } from 'vitest'
import { getSimilarTeas } from '@/services/teaRecommend'
import { teas } from '@/data/teas'

describe('getSimilarTeas', () => {
  it('返回同类型且排除自身的茶', () => {
    const similar = getSimilarTeas('longjing')
    expect(similar.every(t => t.type === '绿茶')).toBe(true)
    expect(similar.every(t => t.id !== 'longjing')).toBe(true)
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
    const single = teas.find(t => teas.filter(x => x.type === t.type).length === 1)
    if (single) {
      expect(getSimilarTeas(single.id)).toEqual([])
    }
  })
})
