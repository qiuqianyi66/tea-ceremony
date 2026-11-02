/**
 * 字符串工具单测：中文 / emoji 按码点计、空串边界、HTML 转义不二次编码。
 */
import { describe, expect, it } from 'vitest'
import { camelCase, capitalize, escapeHtml, kebabCase, truncate } from '@/utils/string'

describe('truncate', () => {
  it('短文本原样返回', () => {
    expect(truncate('一盏茶', 10)).toBe('一盏茶')
    expect(truncate('一盏茶', 3)).toBe('一盏茶')
  })

  it('超长截断并追加省略号（中文按字符计）', () => {
    expect(truncate('一盏茶的时间', 3)).toBe('一盏茶…')
    expect(truncate('一盏茶的时间', 3, '...')).toBe('一盏茶...')
  })

  it('emoji 不被截成半个代理对', () => {
    expect(truncate('🍵🍵🍵', 2)).toBe('🍵🍵…')
  })

  it('max <= 0 返回空串，空串输入原样返回', () => {
    expect(truncate('一盏茶', 0)).toBe('')
    expect(truncate('一盏茶', -1)).toBe('')
    expect(truncate('', 5)).toBe('')
  })
})

describe('capitalize', () => {
  it('首字符大写，其余原样保留', () => {
    expect(capitalize('tea')).toBe('Tea')
    expect(capitalize('tEA')).toBe('TEA')
    expect(capitalize('')).toBe('')
    expect(capitalize('茶')).toBe('茶')
  })
})

describe('camelCase / kebabCase', () => {
  it('多种分隔符统一成 camelCase', () => {
    expect(camelCase('hello world')).toBe('helloWorld')
    expect(camelCase('hello-world')).toBe('helloWorld')
    expect(camelCase('Hello_World')).toBe('helloWorld')
    expect(camelCase('alreadyCamel')).toBe('alreadyCamel')
    expect(camelCase('')).toBe('')
  })

  it('多种写法统一成 kebabCase', () => {
    expect(kebabCase('helloWorld')).toBe('hello-world')
    expect(kebabCase('Hello World')).toBe('hello-world')
    expect(kebabCase('')).toBe('')
  })
})

describe('escapeHtml', () => {
  it('五个敏感字符全部转义且不二次编码', () => {
    expect(escapeHtml(`<a href="x" data-y='1'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; data-y=&#39;1&#39;&gt;&amp;&lt;/a&gt;',
    )
  })

  it('中文与空串原样返回', () => {
    expect(escapeHtml('一盏茶')).toBe('一盏茶')
    expect(escapeHtml('')).toBe('')
  })
})
