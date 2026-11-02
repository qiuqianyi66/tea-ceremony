/**
 * URL 查询串工具：手工切分 base / query / hash，不依赖 location，也不假设绝对 URL。
 * 编码一律走 URLSearchParams / encodeURIComponent（UTF-8）。
 */

/** parseQuery 的结果：同名 key 合并为数组，保持出现顺序 */
export type QueryParams = Record<string, string | string[]>

/** buildQuery / appendQuery 接受的取值 */
export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | (string | number | boolean)[]

/** buildQuery / appendQuery 的参数表 */
export type QueryInput = Record<string, QueryValue>

/** 按第一个 '#' 切出 base 与 hash（hash 含 '#' 本身） */
function splitHash(url: string): { base: string; hash: string } {
  const index = url.indexOf('#')
  return index === -1
    ? { base: url, hash: '' }
    : { base: url.slice(0, index), hash: url.slice(index) }
}

/**
 * 解析查询串：支持完整 URL、相对路径、以 '?' 开头的纯查询串。
 * 无 '?' 时返回空对象；重复 key 收成数组；hash 部分被忽略。
 */
export function parseQuery(url: string): QueryParams {
  const { base } = splitHash(url)
  const queryIndex = base.indexOf('?')
  if (queryIndex === -1) return {}
  const result: QueryParams = {}
  for (const [key, value] of new URLSearchParams(base.slice(queryIndex + 1))) {
    const existing = result[key]
    if (existing === undefined) result[key] = value
    else if (Array.isArray(existing)) existing.push(value)
    else result[key] = [existing, value]
  }
  return result
}

/**
 * 拼查询串（不含前导 '?'）。数组展开为重复 key，null / undefined 跳过。
 */
export function buildQuery(params: QueryInput): string {
  const parts: string[] = []
  for (const [key, raw] of Object.entries(params)) {
    if (raw === null || raw === undefined) continue
    const values: (string | number | boolean)[] = Array.isArray(raw) ? raw : [raw]
    for (const value of values) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    }
  }
  return parts.join('&')
}

/**
 * 把参数追加到 URL：保留原 query 与 hash，同名 key 追加为重复 key（不覆盖）。
 * 参数全为空时原样返回输入。
 */
export function appendQuery(url: string, params: QueryInput): string {
  const extra = buildQuery(params)
  if (extra === '') return url
  const { base, hash } = splitHash(url)
  const queryIndex = base.indexOf('?')
  if (queryIndex === -1) return `${base}?${extra}${hash}`
  const head = base.slice(0, queryIndex + 1)
  const tail = base.slice(queryIndex + 1)
  return `${head}${tail === '' ? extra : `${tail}&${extra}`}${hash}`
}
