/**
 * 统一出口单测：防止新增模块忘记在 index.ts 里导出。
 * 用命名导入而非动态取属性，既验证 barrel 完整，也不影响 tree-shaking。
 */
import { describe, expect, it } from 'vitest'
import {
  appendQuery,
  buildQuery,
  camelCase,
  capitalize,
  chunk,
  debounce,
  escapeHtml,
  formatCompactNumber,
  formatDate,
  formatNumber,
  formatRelativeTime,
  groupBy,
  isArray,
  isBoolean,
  isDefined,
  isNumber,
  isObject,
  isPlainObject,
  isString,
  kebabCase,
  parseQuery,
  readJson,
  removeKey,
  sortBy,
  throttle,
  truncate,
  unique,
  uniqueBy,
  writeJson,
} from '@/utils'

const EXPORTED: [string, unknown][] = [
  ['formatDate', formatDate],
  ['formatRelativeTime', formatRelativeTime],
  ['formatNumber', formatNumber],
  ['formatCompactNumber', formatCompactNumber],
  ['debounce', debounce],
  ['throttle', throttle],
  ['isString', isString],
  ['isNumber', isNumber],
  ['isBoolean', isBoolean],
  ['isObject', isObject],
  ['isArray', isArray],
  ['isDefined', isDefined],
  ['isPlainObject', isPlainObject],
  ['parseQuery', parseQuery],
  ['buildQuery', buildQuery],
  ['appendQuery', appendQuery],
  ['readJson', readJson],
  ['writeJson', writeJson],
  ['removeKey', removeKey],
  ['unique', unique],
  ['uniqueBy', uniqueBy],
  ['groupBy', groupBy],
  ['chunk', chunk],
  ['sortBy', sortBy],
  ['truncate', truncate],
  ['capitalize', capitalize],
  ['camelCase', camelCase],
  ['kebabCase', kebabCase],
  ['escapeHtml', escapeHtml],
]

describe('utils 统一出口', () => {
  it('9 个模块的核心函数都可从 @/utils 取到', () => {
    for (const [name, value] of EXPORTED) {
      expect(typeof value, name).toBe('function')
    }
  })

  it('导出可直接调用', () => {
    expect(unique([1, 1, 2])).toEqual([1, 2])
    expect(truncate('一盏茶的时间', 3)).toBe('一盏茶…')
    expect(parseQuery('?leaf=rock-tea')).toEqual({ leaf: 'rock-tea' })
  })
})
