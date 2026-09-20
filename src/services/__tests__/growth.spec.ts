/**
 * 成长数据看板聚合逻辑单测（T1.1 成长数据看板）。
 *
 * 覆盖：
 * - computeGrowthStats：空记录 → 全零；多条记录 → 总数/平均分/最高分/最常喝
 * - averageDimensions：八维均值（1 位小数），空记录 → 全 0
 * - categoryDistribution：按 teaId 映射茶类、计数/占比/降序、未知 teaId 跳过
 * - solarTermFootprint：按记录日期映射节气、聚合计数、降序、非法日期跳过
 * - getSolarTermByDate：节气首日 / 跨年（1 月属上一节气年区间）/ 时区无关解析
 */
import { describe, expect, it } from 'vitest'
import { getSolarTermByDate } from '@/data/solarTerms'
import {
  averageDimensions,
  categoryDistribution,
  computeGrowthStats,
  solarTermFootprint,
} from '@/services/growth'
import type { TastingRecord } from '@/types/tasting'
import { TeaType } from '@/types/tea'

function makeRecord(overrides: Partial<TastingRecord> = {}): TastingRecord {
  return {
    id: `rec_${Math.random().toString(36).slice(2, 8)}`,
    teaId: 'longjing',
    teaName: '西湖龙井',
    date: '2026-09-14T10:00:00.000Z',
    brewTemp: 80,
    brewTime: 45,
    infusions: 1,
    dimensions: {
      bitterness: 2,
      sweetness: 4,
      aftertaste: 5,
      body: 3,
      aroma: 5,
      rhyme: 4,
      shape: 3,
      mind: 5,
    },
    overallScore: 8.6,
    processFactor: 0.92,
    ...overrides,
  }
}

describe('computeGrowthStats', () => {
  it('空记录 → 全零、无茶名', () => {
    expect(computeGrowthStats([])).toEqual({
      total: 0,
      avgScore: 0,
      maxScore: 0,
      maxScoreTea: null,
      topTeaName: null,
    })
  })

  it('多条记录 → 总数/平均分/最高分/最高分茶/最常喝', () => {
    const records = [
      makeRecord({ overallScore: 7.0, teaName: '西湖龙井', teaId: 'longjing' }),
      makeRecord({ overallScore: 9.4, teaName: '金骏眉', teaId: 'jinjunmei' }),
      makeRecord({ overallScore: 8.0, teaName: '西湖龙井', teaId: 'longjing' }),
      makeRecord({ overallScore: 6.4, teaName: '白毫银针', teaId: 'yinzhen' }),
    ]
    const stats = computeGrowthStats(records)
    expect(stats.total).toBe(4)
    expect(stats.avgScore).toBe(7.7) // (7.0+9.4+8.0+6.4)/4 = 7.7
    expect(stats.maxScore).toBe(9.4)
    expect(stats.maxScoreTea).toBe('金骏眉')
    expect(stats.topTeaName).toBe('西湖龙井')
  })

  it('平均分按 1 位小数四舍五入', () => {
    expect(
      computeGrowthStats([makeRecord({ overallScore: 7.0 }), makeRecord({ overallScore: 8.4 })])
        .avgScore,
    ).toBe(7.7)
  })

  it('最常喝茶平票时保留先出现的茶', () => {
    const records = [
      makeRecord({ teaName: '西湖龙井', teaId: 'longjing' }),
      makeRecord({ teaName: '金骏眉', teaId: 'jinjunmei' }),
      makeRecord({ teaName: '西湖龙井', teaId: 'longjing' }),
      makeRecord({ teaName: '金骏眉', teaId: 'jinjunmei' }),
      makeRecord({ teaName: '白毫银针', teaId: 'yinzhen' }),
    ]
    expect(computeGrowthStats(records).topTeaName).toBe('西湖龙井')
  })
})

describe('averageDimensions', () => {
  it('空记录 → 八维全 0', () => {
    const avg = averageDimensions([])
    expect(avg).toEqual({
      bitterness: 0,
      sweetness: 0,
      aftertaste: 0,
      body: 0,
      aroma: 0,
      rhyme: 0,
      shape: 0,
      mind: 0,
    })
  })

  it('多条记录 → 各维均值（1 位小数）', () => {
    const records = [
      makeRecord({
        dimensions: {
          bitterness: 2,
          sweetness: 4,
          aftertaste: 5,
          body: 3,
          aroma: 5,
          rhyme: 4,
          shape: 3,
          mind: 5,
        },
      }),
      makeRecord({
        dimensions: {
          bitterness: 3,
          sweetness: 2,
          aftertaste: 3,
          body: 4,
          aroma: 2,
          rhyme: 3,
          shape: 4,
          mind: 2,
        },
      }),
    ]
    expect(averageDimensions(records)).toEqual({
      bitterness: 2.5,
      sweetness: 3,
      aftertaste: 4,
      body: 3.5,
      aroma: 3.5,
      rhyme: 3.5,
      shape: 3.5,
      mind: 3.5,
    })
  })
})

describe('categoryDistribution', () => {
  const typeById: Record<string, TeaType> = {
    longjing: TeaType.GREEN,
    jinjunmei: TeaType.RED,
    yinzhen: TeaType.WHITE,
  }

  it('按 teaId 映射茶类计数与占比，未知 teaId 跳过', () => {
    const records = [
      makeRecord({ teaId: 'longjing' }),
      makeRecord({ teaId: 'jinjunmei' }),
      makeRecord({ teaId: 'yinzhen' }),
      makeRecord({ teaId: 'unknown-tea' }),
    ]
    const dist = categoryDistribution(records, typeById)
    expect(dist).toHaveLength(3)
    expect(dist.map((d) => d.type)).toEqual([TeaType.GREEN, TeaType.WHITE, TeaType.RED])
    expect(dist.map((d) => d.count)).toEqual([1, 1, 1])
    dist.forEach((d) => {
      expect(d.ratio).toBeCloseTo(1 / 3, 5)
    })
  })

  it('按计数降序，计数相同时按茶类枚举序', () => {
    const records = [
      makeRecord({ teaId: 'jinjunmei' }),
      makeRecord({ teaId: 'jinjunmei' }),
      makeRecord({ teaId: 'longjing' }),
    ]
    const dist = categoryDistribution(records, typeById)
    expect(dist.map((d) => d.type)).toEqual([TeaType.RED, TeaType.GREEN])
    expect(dist[0]!.ratio).toBeCloseTo(2 / 3, 5)
  })

  it('空记录 → 空数组', () => {
    expect(categoryDistribution([], typeById)).toEqual([])
  })
})

describe('solarTermFootprint', () => {
  it('按日期映射节气聚合计数，降序，非法日期跳过', () => {
    const records = [
      makeRecord({ date: '2026-04-05T10:00:00.000Z' }), // 清明
      makeRecord({ date: '2026-04-10T10:00:00.000Z' }), // 清明
      makeRecord({ date: '2026-01-25T10:00:00.000Z' }), // 大寒
      makeRecord({ date: 'not-a-date' }),
    ]
    expect(solarTermFootprint(records)).toEqual([
      { id: 'qingming', name: '清明', count: 2 },
      { id: 'dahan', name: '大寒', count: 1 },
    ])
  })

  it('空记录 → 空数组', () => {
    expect(solarTermFootprint([])).toEqual([])
  })
})

describe('getSolarTermByDate', () => {
  it('节气首日命中该节气', () => {
    expect(getSolarTermByDate('2026-02-04').name).toBe('立春')
    expect(getSolarTermByDate('2026-09-08').name).toBe('白露')
    expect(getSolarTermByDate('2026-12-22').name).toBe('冬至')
  })

  it('节气区间内取最近节气', () => {
    expect(getSolarTermByDate('2026-09-14').name).toBe('白露')
    expect(getSolarTermByDate('2026-04-21').name).toBe('谷雨')
  })

  it('跨年边界：1 月落在上一节气年区间（小寒/大寒/冬至）', () => {
    expect(getSolarTermByDate('2026-01-01').name).toBe('冬至')
    expect(getSolarTermByDate('2026-01-06').name).toBe('小寒')
    expect(getSolarTermByDate('2026-01-25').name).toBe('大寒')
  })

  it('立春前一日仍属大寒', () => {
    expect(getSolarTermByDate('2026-02-03').name).toBe('大寒')
  })

  it('带时间的 ISO 字符串与 Date 对象解析一致（时区无关）', () => {
    expect(getSolarTermByDate('2026-09-14T10:00:00.000Z').name).toBe(
      getSolarTermByDate(new Date(2026, 8, 14)).name,
    )
    expect(getSolarTermByDate('2026-09-14T10:00:00.000Z').name).toBe('白露')
  })
})
