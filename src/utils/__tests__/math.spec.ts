import { describe, expect, it } from 'vitest'

import { clamp, clamp01, lerp } from '@/utils/math'

describe('clamp', () => {
  it('区间内原样返回', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('越界收敛到边界', () => {
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(99, 0, 10)).toBe(10)
  })

  it('负区间同样生效', () => {
    expect(clamp(-5, -10, -1)).toBe(-5)
    expect(clamp(0, -10, -1)).toBe(-1)
  })

  it('min > max 时按 min 收口，不抛异常', () => {
    expect(clamp(5, 10, 0)).toBe(10)
  })

  it('NaN 收口到 min（动画/手势路径不能炸）', () => {
    expect(clamp(Number.NaN, 1, 8)).toBe(1)
  })

  it('小数与 Infinity 正常收敛', () => {
    expect(clamp(0.35, 0, 1)).toBe(0.35)
    expect(clamp(Number.POSITIVE_INFINITY, 0, 1)).toBe(1)
    expect(clamp(Number.NEGATIVE_INFINITY, 0, 1)).toBe(0)
  })
})

describe('clamp01', () => {
  it('夹到 [0, 1]', () => {
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(-0.2)).toBe(0)
    expect(clamp01(1.8)).toBe(1)
  })
})

describe('lerp', () => {
  it('端点与中点', () => {
    expect(lerp(0, 100, 0)).toBe(0)
    expect(lerp(0, 100, 1)).toBe(100)
    expect(lerp(0, 100, 0.5)).toBe(50)
  })

  it('t 越界先夹取，不过冲', () => {
    expect(lerp(0, 100, 2)).toBe(100)
    expect(lerp(0, 100, -1)).toBe(0)
  })

  it('反向区间可用', () => {
    expect(lerp(100, 0, 0.25)).toBe(75)
  })
})
