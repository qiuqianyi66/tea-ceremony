/**
 * 行为埋点服务（T2.2）
 * - 纯本地存储（IndexedDB），无任何网络上报，离线优先
 * - 只存结构化事件（category/event/label/result），不采集用户输入等自由文本
 * - 容量上限 MAX_EVENTS，超出裁剪最旧，防本地存储无限膨胀
 * - track() 永不 reject：埋点失败静默消化，不影响主流程
 */
import type { TrackCategory, TrackEvent, TrackInput, TrackResult } from '@/types/tracking'

const loadStorage = () => import('@/services/storage')

/** 本地事件容量上限 */
export const MAX_EVENTS = 2000
/** 超限时单次裁剪条数 */
const TRIM_BATCH = 500
/** 事件名 / 标签最大长度 */
const FIELD_MAX = 40

const CATEGORIES: TrackCategory[] = ['ai', 'tasting', 'nav', 'system']
const RESULTS: TrackResult[] = ['success', 'degraded', 'failed']

/** 白名单拒收计数（非法输入按设计静默丢弃，但必须可观测） */
let rejectedCount = 0
/** 存储失败丢弃计数（IndexedDB 异常被吞，埋点数据丢失必须可观测） */
let droppedCount = 0
/** 最近一次丢弃原因，供诊断；不落盘、不含用户输入 */
let lastDropError: string | null = null

/**
 * 埋点健康度快照：用于断言「静默丢弃」是否真的发生。
 * rejected 是设计行为（非法输入）；dropped 是异常行为（写入失败）。
 */
export function trackingHealth(): { rejected: number; dropped: number; lastError: string | null } {
  return { rejected: rejectedCount, dropped: droppedCount, lastError: lastDropError }
}

/** 重置计数器（测试与隐私清理用） */
export function resetTrackingHealth(): void {
  rejectedCount = 0
  droppedCount = 0
  lastDropError = null
}

/**
 * 记录一条行为事件（fire-and-forget）。
 * 输入白名单校验：非法值静默丢弃并计 rejected；存储异常静默消化并计 dropped，绝不向上抛。
 */
export async function track(input: TrackInput): Promise<void> {
  try {
    if (!CATEGORIES.includes(input.category)) {
      rejectedCount += 1
      return
    }
    if (!input.event || input.event.length > FIELD_MAX) {
      rejectedCount += 1
      return
    }
    if (input.label && input.label.length > FIELD_MAX) {
      rejectedCount += 1
      return
    }
    if (input.result && !RESULTS.includes(input.result)) {
      rejectedCount += 1
      return
    }

    const { db, initDB } = await loadStorage()
    await initDB()

    // 容量上限：超出则删除最旧 TRIM_BATCH 条（避免本地无限增长）
    const count = await db.trackingEvents.count()
    if (count >= MAX_EVENTS) {
      const oldest = await db.trackingEvents.orderBy('ts').limit(TRIM_BATCH).primaryKeys()
      if (oldest.length > 0) await db.trackingEvents.bulkDelete(oldest)
    }

    const record: TrackEvent = {
      category: input.category,
      event: input.event,
      ts: Date.now(),
    }
    if (input.label) record.label = input.label
    if (input.result) record.result = input.result
    await db.trackingEvents.add(record)
  } catch (err) {
    // 埋点失败不影响主流程（静默降级），但必须计数，否则数据丢失不可诊断
    droppedCount += 1
    lastDropError = err instanceof Error ? err.message : String(err)
  }
}

/** 统计汇总：按 `category:event[:result]` 计数，供 T2.4 茶灵去留决策 */
export async function getTrackingSummary(): Promise<Record<string, number>> {
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    const all = await db.trackingEvents.toArray()
    const summary: Record<string, number> = {}
    for (const e of all) {
      const key = e.result ? `${e.category}:${e.event}:${e.result}` : `${e.category}:${e.event}`
      summary[key] = (summary[key] ?? 0) + 1
    }
    return summary
  } catch {
    return {}
  }
}

/** 清空全部事件（测试 / 用户隐私管理） */
export async function clearTracking(): Promise<void> {
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    await db.trackingEvents.clear()
  } catch {
    // 静默
  }
}
