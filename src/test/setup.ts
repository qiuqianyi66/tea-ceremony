/**
 * Vitest 全局测试环境：
 * 1. 注入 fake-indexeddb（内存实现替换全局 indexedDB），让 Dexie 可测试。
 * 2. polyfill localStorage：Node 22+ 自带实验性 globalThis.localStorage（方法 undefined，
 *    需 --localstorage-file 才激活），会 shadow jsdom 的 localStorage 导致
 *    `localStorage.getItem is not a function`。这里用内存实现覆盖，恢复 jsdom 语义。
 */
import 'fake-indexeddb/auto'

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  })
}
