/**
 * localStorage 的 JSON 安全读写：隐私模式 / 配额超限 / 非浏览器环境一律静默降级。
 * 风格与 services/authStorage.ts 一致：调用方不直接碰 localStorage。
 */

/** 取存储实例；非浏览器环境或访问被拒时返回 null */
function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * 读取并反序列化；缺失、非法 JSON、读取异常都返回 fallback。
 * 注意：存储内容是 JSON 字面量 null 时原样返回 null（调用方自行判空）。
 */
export function readJson<T>(key: string, fallback: T): T {
  const storage = getStorage()
  if (storage === null) return fallback
  try {
    const raw = storage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * 序列化并写入。
 * @returns 写入成功为 true；循环引用、配额超限、环境不可用均为 false（不抛异常）
 */
export function writeJson<T>(key: string, value: T): boolean {
  const storage = getStorage()
  if (storage === null) return false
  try {
    storage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** 删除键；异常时返回 false */
export function removeKey(key: string): boolean {
  const storage = getStorage()
  if (storage === null) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}
