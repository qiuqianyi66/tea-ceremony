/**
 * 运行时类型守卫：全部为纯判定函数，不抛异常，可安全用于 unknown 输入。
 */

/** 有限数字（排除 NaN / Infinity） */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** 布尔值 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

/** 字符串 */
export function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/** 数组（任意元素类型，调用方可再收窄） */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/** 非 null / undefined */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

/** 普通对象：非 null、非数组、非类实例（原型为 Object.prototype 或 null） */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto: unknown = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * 广义对象：非 null 且非数组。
 * 包含 Date / Map / 类实例，只判「能不能按对象取值」；要严格判字面量请用 isPlainObject。
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
