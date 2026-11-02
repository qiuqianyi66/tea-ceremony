/**
 * URL 查询串单测：解析 / 构建 / 追加，覆盖重复 key、编码、hash 与非法输入。
 */
import { describe, expect, it } from 'vitest'
import { appendQuery, buildQuery, parseQuery } from '@/utils/url'

describe('parseQuery', () => {
  it('解析完整 URL、相对路径与纯查询串', () => {
    expect(parseQuery('https://tea.test/brew?leaf=rock-tea&temp=95')).toEqual({
      leaf: 'rock-tea',
      temp: '95',
    })
    expect(parseQuery('/brew?leaf=rock-tea')).toEqual({ leaf: 'rock-tea' })
    expect(parseQuery('?leaf=rock-tea')).toEqual({ leaf: 'rock-tea' })
  })

  it('重复 key 收成数组并保持顺序', () => {
    expect(parseQuery('?tag=a&tag=b&tag=c')).toEqual({ tag: ['a', 'b', 'c'] })
  })

  it('解码 UTF-8 与 + 号，忽略 hash', () => {
    expect(parseQuery('?name=%E8%8C%B6&q=a+b#section')).toEqual({ name: '茶', q: 'a b' })
  })

  it('无查询串返回空对象，非法百分号编码不抛异常', () => {
    expect(parseQuery('https://tea.test/brew')).toEqual({})
    expect(parseQuery('https://tea.test/brew#hash')).toEqual({})
    expect(parseQuery('?broken=%zz')).toEqual({ broken: '%zz' })
    expect(parseQuery('')).toEqual({})
  })
})

describe('buildQuery', () => {
  it('编码 key 与 value，数组展开为重复 key', () => {
    expect(buildQuery({ name: '茶', page: 2, ok: true })).toBe('name=%E8%8C%B6&page=2&ok=true')
    expect(buildQuery({ tag: ['a', 'b c'] })).toBe('tag=a&tag=b%20c')
  })

  it('跳过 null / undefined，空对象返回空串', () => {
    expect(buildQuery({ a: null, b: undefined, c: '' })).toBe('c=')
    expect(buildQuery({})).toBe('')
  })
})

describe('appendQuery', () => {
  it('无查询串时插入 ?，保留 hash', () => {
    expect(appendQuery('https://tea.test/brew#step', { leaf: 'rock-tea' })).toBe(
      'https://tea.test/brew?leaf=rock-tea#step',
    )
  })

  it('已有查询串时用 & 追加，同名 key 保留为重复 key', () => {
    expect(appendQuery('/brew?temp=95#top', { leaf: 'rock-tea' })).toBe(
      '/brew?temp=95&leaf=rock-tea#top',
    )
    expect(appendQuery('/brew?tag=a', { tag: 'b' })).toBe('/brew?tag=a&tag=b')
  })

  it('空参数原样返回，尾部空查询串不产生双 &', () => {
    expect(appendQuery('/brew?x=1#h', {})).toBe('/brew?x=1#h')
    expect(appendQuery('/brew?', { x: 1 })).toBe('/brew?x=1')
  })
})
