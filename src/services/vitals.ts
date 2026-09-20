/**
 * Web Vitals 真实用户指标采集（P1-9）
 * - 使用官方 web-vitals 库（RUM 方式）采集 CLS/INP/LCP/FCP/TTFB
 * - 结果只写本地 IndexedDB（webVitals 表），无任何网络上报，遵循 ADR-006
 * - 容量上限 MAX_VITALS，超出裁剪最旧；采集失败静默消化，绝不影响主流程
 */

import type { Metric } from 'web-vitals'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import { db, initDB } from '@/services/storage'
import type { VitalName, WebVitalRecord } from '@/types/vitals'

/** 本地指标容量上限（个人单机使用，500 条足够覆盖近期会话） */
export const MAX_VITALS = 500
/** 超限时单次裁剪条数 */
const TRIM_BATCH = 100

let started = false

/** 注册指标监听（幂等，模块/入口重复调用安全） */
export function initWebVitals(): void {
  if (started) return
  started = true
  // web-vitals 在不支持 PerformanceObserver 的环境（旧浏览器/jsdom）内部自动 no-op
  onLCP(saveVital)
  onINP(saveVital)
  onCLS(saveVital)
  onFCP(saveVital)
  onTTFB(saveVital)
}

/** 单条指标落库（fire-and-forget，永不 reject） */
async function saveVital(metric: Metric): Promise<void> {
  try {
    await initDB()

    const count = await db.webVitals.count()
    if (count >= MAX_VITALS) {
      const oldest = await db.webVitals.orderBy('ts').limit(TRIM_BATCH).primaryKeys()
      if (oldest.length > 0) await db.webVitals.bulkDelete(oldest)
    }

    const record: WebVitalRecord = {
      name: metric.name as VitalName,
      // CLS 保留 4 位小数，时间类指标保留 1 位（web-vitals 原始精度）
      value: Math.round(metric.value * 1000) / 1000,
      rating: metric.rating,
      navigationType: metric.navigationType,
      ts: Date.now(),
    }
    await db.webVitals.add(record)
  } catch {
    // 指标采集失败不影响主流程（静默降级）
  }
}

/** 读取全部指标（本地调试 / 未来设置页性能面板用） */
export async function getWebVitals(): Promise<WebVitalRecord[]> {
  try {
    await initDB()
    return await db.webVitals.orderBy('ts').toArray()
  } catch {
    return []
  }
}

/** 清空指标（测试 / 隐私管理） */
export async function clearWebVitals(): Promise<void> {
  try {
    await initDB()
    await db.webVitals.clear()
  } catch {
    // 静默
  }
}
