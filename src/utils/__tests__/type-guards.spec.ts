/**
 * 类型守卫单测：覆盖正常值、边界（NaN / null / 数组）与类实例。
 */
import { describe, expect, it } from 'vitest'
import {
  isArray,
  isBoolean,
  isDefined,
  isNumber,
  isObject,
  isPlainObject,
  isString,
} from '@/utils/type-guards'

class Sample {
  value = 1
}

describe('isString / isBoolean', () => {
  it('只认原始类型', () => {
    expect(isString('茶')).toBe(true)
    expect(isString('')).toBe(true)
    expect(isString(1)).toBe(false)
    expect(isString(null)).toBe(false)

    expect(isBoolean(false)).toBe(true)
    expect(isBoolean('false')).toBe(false)
    expect(isBoolean(0)).toBe(false)
  })
})

describe('isNumber', () => {
  it('只认有限数字，NaN / Infinity 为假', () => {
    expect(isNumber(0)).toBe(true)
    expect(isNumber(-1.5)).toBe(true)
    expect(isNumber(Number.NaN)).toBe(false)
    expect(isNumber(Number.POSITIVE_INFINITY)).toBe(false)
    expect(isNumber('1')).toBe(false)
  })
})

describe('isArray', () => {
  it('数组为真，类数组与字符串为假', () => {
    expect(isArray([])).toBe(true)
    expect(isArray([1, 2])).toBe(true)
    expect(isArray({ length: 0 })).toBe(false)
    expect(isArray('abc')).toBe(false)
  })
})

describe('isDefined', () => {
  it('只有 null / undefined 为假，假值仍为真', () => {
    expect(isDefined(0)).toBe(true)
    expect(isDefined('')).toBe(true)
    expect(isDefined(false)).toBe(true)
    expect(isDefined(null)).toBe(false)
    expect(isDefined(undefined)).toBe(false)
  })
})

describe('isObject / isPlainObject', () => {
  it('isObject 排除 null 与数组，包含类实例', () => {
    expect(isObject({})).toBe(true)
    expect(isObject(new Sample())).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
    expect(isObject('x')).toBe(false)
  })

  it('isPlainObject 只认字面量与无原型对象', () => {
    expect(isPlainObject({ a: 1 })).toBe(true)
    expect(isPlainObject(Object.create(null))).toBe(true)
    expect(isPlainObject(new Sample())).toBe(false)
    expect(isPlainObject(new Date())).toBe(false)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(null)).toBe(false)
  })
})
