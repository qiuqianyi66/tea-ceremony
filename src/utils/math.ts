/**
 * 数值收敛：夹取与插值。纯函数，无副作用。
 *
 * 项目里 `Math.max(0, Math.min(1, x))` 这类手写夹取曾出现 21 处（composables / stores /
 * services / views），语义全靠读者自己推断上下界；统一走 clamp 后边界一眼可见。
 */

/** 把 value 夹到 [min, max]；min > max 时按 min 收口（不抛异常，动画/手势路径不能炸） */
export function clamp(value: number, min: number, max: number): number {
  if (min > max) return min
  if (Number.isNaN(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** 夹到 [0, 1]：进度 / 强度 / 音量的统一口径 */
export function clamp01(value: number): number {
  return clamp(value, 0, 1)
}

/** 线性插值：t 先夹到 [0, 1]，避免过冲 */
export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp01(t)
}
