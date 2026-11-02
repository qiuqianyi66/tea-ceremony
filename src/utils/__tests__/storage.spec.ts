/**
 * localStorage JSON 读写单测：正常往返 + 非法 JSON / 循环引用 / 配额超限降级。
 * 用自建 fake Storage 替换全局实现，避免 jsdom 内部实现差异带来的假阴性。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readJson, removeKey, writeJson } from '@/utils/storage'

type StorageMethod = 'getItem' | 'setItem' | 'removeItem' | 'clear'
type StorageOverrides = Partial<Pick<Storage, StorageMethod>>

const realStorage: Storage = globalThis.localStorage

/** 内存版 Storage；overrides 用来模拟隐私模式 / 配额超限 */
function fakeStorage(overrides: StorageOverrides = {}): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key)
    },
    setItem: (key, value) => {
      store.set(key, value)
    },
    ...overrides,
  }
}

function installStorage(overrides: StorageOverrides = {}): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: fakeStorage(overrides),
    configurable: true,
    writable: true,
  })
}

describe('storage JSON 读写', () => {
  beforeEach(() => {
    installStorage()
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: realStorage,
      configurable: true,
      writable: true,
    })
  })

  it('写入后读回同构数据', () => {
    expect(writeJson('tea:settings', { theme: 'ink', level: 3 })).toBe(true)
    expect(readJson('tea:settings', { theme: 'paper', level: 0 })).toEqual({
      theme: 'ink',
      level: 3,
    })
    expect(writeJson('tea:list', [1, 2, 3])).toBe(true)
    expect(readJson<number[]>('tea:list', [])).toEqual([1, 2, 3])
  })

  it('键不存在时返回 fallback 本身', () => {
    const fallback = { theme: 'paper' }
    expect(readJson('tea:missing', fallback)).toBe(fallback)
  })

  it('非法 JSON 返回 fallback', () => {
    localStorage.setItem('tea:broken', '{not json')
    expect(readJson('tea:broken', { ok: false })).toEqual({ ok: false })
  })

  it('存储字面量 null 时原样返回 null', () => {
    localStorage.setItem('tea:null', 'null')
    expect(readJson<number | null>('tea:null', 1)).toBeNull()
  })

  it('removeKey 后读回 fallback', () => {
    writeJson('tea:temp', { a: 1 })
    expect(removeKey('tea:temp')).toBe(true)
    expect(readJson('tea:temp', null)).toBeNull()
  })

  it('循环引用写入失败但不抛异常', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(writeJson('tea:circular', circular)).toBe(false)
    expect(localStorage.getItem('tea:circular')).toBeNull()
  })

  it('配额超限 / 读取被拒时静默降级', () => {
    installStorage({
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      getItem: () => {
        throw new Error('SecurityError')
      },
    })
    expect(writeJson('tea:quota', { a: 1 })).toBe(false)
    expect(readJson('tea:quota', { fallback: true })).toEqual({ fallback: true })
  })

  it('removeKey 异常时返回 false', () => {
    installStorage({
      removeItem: () => {
        throw new Error('denied')
      },
    })
    expect(removeKey('tea:denied')).toBe(false)
  })
})
