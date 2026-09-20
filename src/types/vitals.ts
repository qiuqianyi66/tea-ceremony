/**
 * Web Vitals 真实用户指标类型（P1-9）
 * 隐私约束（ADR-006）：只写本地 IndexedDB，无任何网络上报。
 */

/** 核心指标名（web-vitals 官方 RUM） */
export type VitalName = 'CLS' | 'INP' | 'LCP' | 'FCP' | 'TTFB'

/** 评级：良好 / 待改进 / 差 */
export type VitalRating = 'good' | 'needs-improvement' | 'poor'

/** IndexedDB 中的一条指标记录 */
export interface WebVitalRecord {
  id?: number
  name: VitalName
  /** 指标值（LCP/FCP/TTFB/INP 单位 ms；CLS 为无量纲分数） */
  value: number
  rating: VitalRating
  /** 导航类型：navigate / reload / back-forward / prerender */
  navigationType?: string
  ts: number
}
