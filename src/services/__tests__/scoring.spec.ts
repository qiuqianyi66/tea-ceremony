/**
 * 评分算法单元测试：src/services/scoring.ts
 * 覆盖：工艺系数、综合评分、评分等级、记录 ID。
 */

import { describe, expect, it } from 'vitest'
import {
  calculateProcessFactor,
  calculateOverallScore,
  getScoreLevel,
  generateRecordId,
  explainProcessFactor,
} from '@/services/scoring'
import type { TeaWare } from '@/types/teaware'
import { TeaWareType } from '@/types/teaware'
import type { TasteDimensions } from '@/types/tasting'

function makeWare(bonus?: Partial<TeaWare['bonus']>): TeaWare {
  return {
    id: 'test-ware',
    name: '测试茶器',
    type: TeaWareType.GAIWAN,
    capacity: 150,
    material: '陶瓷',
    description: '',
    story: '',
    bonus: { speed: 1, heatRetention: 1, visual: 1, ...bonus },
    recommended: [],
    rarity: 'common',
    unlockHint: '',
  }
}

// 理想好茶：不苦涩（反向维度取 1），其余七维满分
const fullDimensions: TasteDimensions = {
  bitterness: 1, sweetness: 5, aftertaste: 5, body: 5,
  aroma: 5, rhyme: 5, shape: 5, mind: 5,
}

// 最差：苦涩很重（反向维度取 5），其余七维最低
const lowDimensions: TasteDimensions = {
  bitterness: 5, sweetness: 1, aftertaste: 1, body: 1,
  aroma: 1, rhyme: 1, shape: 1, mind: 1,
}

describe('calculateProcessFactor 工艺系数', () => {
  it('温度与时间完全匹配时系数为 1', () => {
    expect(calculateProcessFactor(80, 80, 60, 60)).toBe(1)
  })

  it('温度偏差越大扣分越多，偏差 30°C 时温度项归零', () => {
    // 偏差 30：tempFactor = 1 - 30/30 = 0 → baseFactor = (0 + 1) / 2 = 0.5
    expect(calculateProcessFactor(50, 80, 60, 60)).toBe(0.5)
    // 偏差 60：温度项归零，但时间项为 1 → baseFactor = 0.5
    expect(calculateProcessFactor(20, 80, 60, 60)).toBe(0.5)
  })

  it('时间偏差超过 ±50% 时时间项归零', () => {
    // 偏差 = bestTime * 0.5 → timeFactor = 0
    expect(calculateProcessFactor(80, 80, 120, 60)).toBe(0.5)
    expect(calculateProcessFactor(80, 80, 0, 60)).toBe(0.5)
  })

  it('无偏差时优质茶器可带来加成补偿，但不超过 1', () => {
    const factor = calculateProcessFactor(80, 80, 60, 60, makeWare())
    expect(factor).toBe(1)
  })

  it('工艺有偏差时茶器补偿生效（高于无茶器）', () => {
    const withoutWare = calculateProcessFactor(50, 80, 60, 60) // 0.5
    const withWare = calculateProcessFactor(50, 80, 60, 60, makeWare())
    expect(withWare).toBeGreaterThan(withoutWare)
    expect(withWare).toBeLessThanOrEqual(1)
  })

  it('较差茶器（bonus < 0.8）不产生补偿', () => {
    const poorWare = makeWare({ heatRetention: 0.6, visual: 0.6 })
    const factor = calculateProcessFactor(50, 80, 60, 60, poorWare)
    // wareBonus = 0.6 < 0.8 → compensation <= 0 → 保持 0.5
    expect(factor).toBe(0.5)
  })

  it('水质系数参与乘法', () => {
    expect(calculateProcessFactor(80, 80, 60, 60, null, 0.8)).toBe(0.8)
  })
})

describe('explainProcessFactor 工艺系数分解', () => {
  it('返回各组成因子且 factor 与 calculateProcessFactor 一致', () => {
    const parts = explainProcessFactor(70, 80, 90, 60, makeWare(), 1.0)
    expect(parts.tempDiff).toBe(10)
    expect(parts.tempFactor).toBeCloseTo(1 - 10 / 30)
    expect(parts.timeDiff).toBe(30)
    expect(parts.timeFactor).toBeCloseTo(1 - 30 / 30)
    expect(parts.baseFactor).toBeCloseTo((parts.tempFactor + parts.timeFactor) / 2)
    expect(parts.wareName).toBe(makeWare().name)
    expect(parts.wareBonus).toBe((makeWare().bonus.heatRetention + makeWare().bonus.visual) / 2)
    expect(parts.factor).toBe(calculateProcessFactor(70, 80, 90, 60, makeWare(), 1.0))
  })

  it('无茶器时 wareName 为 null 且无补偿', () => {
    const parts = explainProcessFactor(70, 80, 90, 60, null, 1.0)
    expect(parts.wareName).toBeNull()
    expect(parts.wareBonus).toBeNull()
    expect(parts.compensation).toBe(0)
    expect(parts.factor).toBe(parts.baseFactor)
  })

  it('工艺无偏差时无扣减、factor 为 1', () => {
    const parts = explainProcessFactor(80, 80, 60, 60, null, 1.0)
    expect(parts.tempFactor).toBe(1)
    expect(parts.timeFactor).toBe(1)
    expect(parts.baseFactor).toBe(1)
    expect(parts.factor).toBe(1)
  })
})

describe('calculateOverallScore 综合评分', () => {
  it('八维满分 × 系数 1 = 10 分', () => {
    expect(calculateOverallScore(fullDimensions, 1)).toBe(10)
  })

  it('八维最低 × 系数 1 = 2 分（1-10 归一化）', () => {
    expect(calculateOverallScore(lowDimensions, 1)).toBe(2)
  })

  it('评分被工艺系数缩放', () => {
    // 满分 * 0.5 = 5
    expect(calculateOverallScore(fullDimensions, 0.5)).toBe(5)
  })

  it('任意输入结果收敛在 1-10 且保留一位小数', () => {
    const edgeDimensions: TasteDimensions = {
      bitterness: 0, sweetness: 6, aftertaste: -2, body: 3,
      aroma: 10, rhyme: 1, shape: 4, mind: 2,
    }
    const score = calculateOverallScore(edgeDimensions, 2)
    expect(score).toBeGreaterThanOrEqual(1)
    expect(score).toBeLessThanOrEqual(10)
    expect(Number.isInteger(score * 10)).toBe(true)
  })

  it('工艺系数为 0 时最低 1 分', () => {
    expect(calculateOverallScore(fullDimensions, 0)).toBe(1)
  })

  it('苦涩度为反向维度：其他维度相同时，越苦涩得分越低', () => {
    const mild = { ...fullDimensions, bitterness: 1 }
    const bitter = { ...fullDimensions, bitterness: 5 }
    expect(calculateOverallScore(mild, 1)).toBeGreaterThan(calculateOverallScore(bitter, 1))
  })
})

describe('getScoreLevel 评分等级', () => {
  it('阈值边界正确', () => {
    expect(getScoreLevel(9).text).toBe('完美')
    expect(getScoreLevel(8).text).toBe('优秀')
    expect(getScoreLevel(7.5).text).toBe('优秀')
    expect(getScoreLevel(6).text).toBe('良好')
    expect(getScoreLevel(4).text).toBe('一般')
    expect(getScoreLevel(3.9).text).toBe('需改进')
  })
})

describe('generateRecordId 记录 ID', () => {
  it('带 record_ 前缀且不重复', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateRecordId())
    }
    expect(ids.size).toBe(1000)
    for (const id of ids) {
      expect(id.startsWith('record_')).toBe(true)
    }
  })
})
