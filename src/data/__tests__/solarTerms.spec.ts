/**
 * 节气茶单映射测试（T1.3）
 *
 * 验收标准「映射无编造」的机器断言：
 * 1. 每个节气推荐的茶类词必须 ∈ TeaType 枚举值（六大茶类，禁止自造分类词）
 * 2. 每个推荐的茶类在 teas 库中至少有一款真实茶（防止"词对但无茶"的断链）
 */
import { describe, it, expect } from 'vitest'
import { SOLAR_TERMS } from '../solarTerms'
import { TeaType } from '@/types/tea'
import { teas } from '../teas'

const VALID_TYPES = new Set(Object.values(TeaType))

describe('节气茶单（T1.3）：映射无编造', () => {
  it('每个节气的推荐茶类都是 TeaType 枚举值（六大茶类）', () => {
    for (const term of SOLAR_TERMS) {
      for (const t of term.teaTypes) {
        expect(VALID_TYPES.has(t), `${term.name} 推荐茶类「${t}」不在 TeaType 枚举内`).toBe(true)
      }
    }
  })

  it('每个节气的推荐茶类在 teas 库中都有对应茶款', () => {
    for (const term of SOLAR_TERMS) {
      for (const t of term.teaTypes) {
        const hasTea = teas.some((tea) => tea.type === t)
        expect(hasTea, `${term.name} 推荐茶类「${t}」在 teas 库中无对应茶款`).toBe(true)
      }
    }
  })
})
