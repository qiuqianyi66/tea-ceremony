/**
 * 遥测待发队列（IndexedDB outbox，契约 §7 第 4 级兜底）
 *
 * 为什么不复用 errorBuffer 表：outbox 需要 attempts / nextAttemptAt / status 三个投递状态字段，
 * 且成功即出队（errorBuffer 是本地留存日志），两者裁剪策略与生命周期完全不同。
 *
 * 全部导出函数永不 reject：遥测不可用不能影响业务（承重墙，与 teaAI 降级同级）。
 */
import { MAX_ATTEMPTS, OUTBOX_MAX } from './config'
import type { OutboxRecord, TelemetryEvent } from './types'

const loadStorage = () => import('@/services/storage')

/** 入队一批事件（容量超限淘汰最旧，照 errorBuffer 的裁剪风格） */
export async function enqueue(events: TelemetryEvent[]): Promise<void> {
  if (events.length === 0) return
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    // 单次入队就超过上限时只留最新 OUTBOX_MAX 条：更旧的此刻已无投递价值
    const accepted = events.length > OUTBOX_MAX ? events.slice(events.length - OUTBOX_MAX) : events
    const now = Date.now()
    const records: OutboxRecord[] = accepted.map((event) => ({
      event,
      status: 'queued',
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
    }))

    await db.transaction('rw', db.telemetryOutbox, async () => {
      const count = await db.telemetryOutbox.count()
      const overflow = count + records.length - OUTBOX_MAX
      if (overflow > 0) {
        // 按入队时间淘汰最旧（dead 记录通常也最旧，顺带清掉）
        const oldest = await db.telemetryOutbox.orderBy('createdAt').limit(overflow).primaryKeys()
        if (oldest.length > 0) await db.telemetryOutbox.bulkDelete(oldest)
      }
      await db.telemetryOutbox.bulkAdd(records)
    })
  } catch {
    // 落库失败静默：本次事件丢失，优于影响主流程
  }
}

/**
 * 取一批已到期的待发记录（status=queued 且 nextAttemptAt <= now），并标为 inflight。
 * 标 inflight 的作用：debounce 触发与 60s 兜底可能重叠，不标记会把同一批发两次。
 */
export async function takeBatch(limit: number): Promise<OutboxRecord[]> {
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    const now = Date.now()
    const queued = await db.telemetryOutbox.where('status').equals('queued').toArray()
    const due = queued
      .filter((record) => record.nextAttemptAt <= now)
      .sort(
        (a, b) =>
          a.nextAttemptAt - b.nextAttemptAt ||
          a.createdAt - b.createdAt ||
          (a.id ?? 0) - (b.id ?? 0),
      )
      .slice(0, limit)
    if (due.length === 0) return []

    const ids = due.map((record) => record.id).filter((id): id is number => typeof id === 'number')
    if (ids.length > 0) {
      await db.telemetryOutbox.bulkUpdate(
        ids.map((key) => ({ key, changes: { status: 'inflight' as const } })),
      )
    }
    return due.map((record) => ({ ...record, status: 'inflight' as const }))
  } catch {
    return []
  }
}

/**
 * 标记已送达：直接出队。
 * 不保留副本是因为服务端用 client_event_id 唯一约束做幂等（契约 §9），重复投递无副作用。
 */
export async function markSent(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    await db.telemetryOutbox.bulkDelete(ids)
  } catch {
    // 静默
  }
}

/** 标记发送失败：attempts+1，按 backoffMs 推迟下次到期；超过 MAX_ATTEMPTS 转 dead */
export async function markFailed(ids: number[], backoffMs: number): Promise<void> {
  if (ids.length === 0) return
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    const now = Date.now()
    await db.transaction('rw', db.telemetryOutbox, async () => {
      for (const id of ids) {
        const record = await db.telemetryOutbox.get(id)
        if (!record) continue
        const attempts = record.attempts + 1
        if (attempts >= MAX_ATTEMPTS) {
          // 退避轮次用完：留在队列里等人工/下次启动评估，不再自动重试
          await db.telemetryOutbox.update(id, { attempts, status: 'dead' })
        } else {
          await db.telemetryOutbox.update(id, {
            attempts,
            status: 'queued',
            nextAttemptAt: now + backoffMs,
          })
        }
      }
    })
  } catch {
    // 静默：记录留在 inflight，下次启动 requeueInflight 会放回队列
  }
}

/** 标记永久失败（如 400 契约错误）：重试不会变好，直接 dead */
export async function markDead(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    await db.telemetryOutbox.bulkUpdate(
      ids.map((key) => ({ key, changes: { status: 'dead' as const } })),
    )
  } catch {
    // 静默
  }
}

/** 待发记录数（queued + inflight）；dead 不算待发 */
export async function pendingCount(): Promise<number> {
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    return await db.telemetryOutbox.where('status').anyOf('queued', 'inflight').count()
  } catch {
    return 0
  }
}

/** 把上次会话卡在 inflight 的记录放回队列（页面在发送中被关闭时会留下这种记录） */
export async function requeueInflight(): Promise<void> {
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    await db.telemetryOutbox.where('status').equals('inflight').modify({ status: 'queued' })
  } catch {
    // 静默
  }
}

/** 清空队列（测试 / 用户隐私管理） */
export async function clearOutbox(): Promise<void> {
  try {
    const { db, initDB } = await loadStorage()
    await initDB()
    await db.telemetryOutbox.clear()
  } catch {
    // 静默
  }
}
