/**
 * 数组工具单测：不可变性、边界（空数组 / 非法 size）、原型键安全。
 */
import { describe, expect, it } from 'vitest'
import { chunk, groupBy, sortBy, unique, uniqueBy } from '@/utils/array'

describe('unique', () => {
  it('去重并保留首次出现顺序', () => {
    expect(unique([3, 1, 3, 2, 1])).toEqual([3, 1, 2])
  })

  it('空数组返回空数组', () => {
    expect(unique([])).toEqual([])
  })

  it('对象按引用去重，同值不同引用保留', () => {
    const shared = { id: 1 }
    expect(unique([shared, shared, { id: 1 }])).toEqual([shared, { id: 1 }])
  })
})

describe('uniqueBy', () => {
  it('按 keyFn 保留首项', () => {
    const items = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 1, name: 'c' },
    ]
    expect(uniqueBy(items, (item) => item.id).map((item) => item.name)).toEqual(['a', 'b'])
  })

  it('空数组返回空数组', () => {
    expect(uniqueBy([], (item: number) => item)).toEqual([])
  })
})

describe('groupBy', () => {
  it('按 key 分组，空数组返回空对象', () => {
    expect(groupBy(['a', 'bb', 'cc', 'd'], (item) => item.length)).toEqual({
      1: ['a', 'd'],
      2: ['bb', 'cc'],
    })
    expect(groupBy([], (item: number) => item)).toEqual({})
  })

  it('原型键按普通键处理，不污染原型', () => {
    const grouped = groupBy(['__proto__', 'toString'], (item) => item)
    expect(Object.keys(grouped)).toEqual(['__proto__', 'toString'])
    expect(Object.getPrototypeOf(grouped)).toBe(Object.prototype)
  })
})

describe('chunk', () => {
  it('按 size 切块，尾部不足保留', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunk([1, 2], 2)).toEqual([[1, 2]])
    expect(chunk([], 3)).toEqual([])
  })

  it('非法 size 返回空数组而不抛异常', () => {
    expect(chunk([1, 2], 0)).toEqual([])
    expect(chunk([1, 2], -1)).toEqual([])
    expect(chunk([1, 2], 2.5)).toEqual([])
  })
})

describe('sortBy', () => {
  it('升序 / 降序，且不修改入参', () => {
    const items = [{ n: 3 }, { n: 1 }, { n: 2 }]
    expect(sortBy(items, (item) => item.n).map((item) => item.n)).toEqual([1, 2, 3])
    expect(sortBy(items, (item) => item.n, 'desc').map((item) => item.n)).toEqual([3, 2, 1])
    expect(items.map((item) => item.n)).toEqual([3, 1, 2])
  })

  it('字符串按码点比较，空数组返回空数组', () => {
    expect(sortBy(['b', 'a', 'c'], (item) => item)).toEqual(['a', 'b', 'c'])
    expect(sortBy([], (item: number) => item)).toEqual([])
  })
})
