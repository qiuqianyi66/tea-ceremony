/**
 * 数组工具：全部返回新数组 / 新对象，不修改入参。
 */

/** 去重（Set 语义，保留首次出现顺序） */
export function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items))
}

/** 按 keyFn 结果去重，保留首次出现的那一项 */
export function uniqueBy<T, K>(items: readonly T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>()
  const result: T[] = []
  for (const item of items) {
    const key = keyFn(item)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

/**
 * 分组。内部先用 Map 累积，再逐个 defineProperty 落到普通对象，
 * 让 `__proto__` / `toString` 这类键也按普通键处理，不污染原型。
 * 空数组返回空对象。
 */
export function groupBy<T, K extends string | number>(
  items: readonly T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  const buckets = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, [item])
    else bucket.push(item)
  }
  const result = {} as Record<K, T[]>
  for (const [key, value] of buckets) {
    Object.defineProperty(result, String(key), {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
  return result
}

/** 切块；size 非正整数时返回空数组（不抛异常） */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) return []
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

/**
 * 排序（稳定，返回新数组）。key 为 string | number，字符串按码点比较，不依赖 locale。
 */
export function sortBy<T>(
  items: readonly T[],
  keyFn: (item: T) => string | number,
  order: 'asc' | 'desc' = 'asc',
): T[] {
  const direction = order === 'desc' ? -1 : 1
  return [...items].sort((left, right) => {
    const a = keyFn(left)
    const b = keyFn(right)
    if (a === b) return 0
    return (a < b ? -1 : 1) * direction
  })
}
