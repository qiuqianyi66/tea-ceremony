/**
 * 前端本地错误缓冲（P2-9）
 * - window.onerror / unhandledrejection 捕获后写入 IndexedDB（纯本地，无外发，ADR-006）
 * - 只存结构化错误信息（message/source/lineno/stack），不存用户输入
 * - 容量上限 MAX_ERRORS，超出裁剪最旧；record() 永不 reject
 * - 用途：错误定位数据源（比 Sentry 便宜且不破离线优先）
 */
import { db, initDB } from '@/services/storage'
import type { ErrorBufferRecord } from '@/types/errors'

/** 本地错误记录容量上限（错误比埋点稀少，200 条足够定位） */
export const MAX_ERRORS = 200
/** 超限时单次裁剪条数 */
const TRIM_BATCH = 50

/** 记录一条错误（fire-and-forget，任何失败静默消化） */
export async function recordError(entry: Omit<ErrorBufferRecord, 'ts' | 'id'>): Promise<void> {
  try {
    await initDB()
    // 容量上限：超出则删除最旧 TRIM_BATCH 条
    const count = await db.errorBuffer.count()
    if (count >= MAX_ERRORS) {
      const oldest = await db.errorBuffer.orderBy('ts').limit(TRIM_BATCH).primaryKeys()
      if (oldest.length > 0) await db.errorBuffer.bulkDelete(oldest)
    }
    await db.errorBuffer.add({ ...entry, ts: new Date().toISOString() })
  } catch {
    // 错误缓冲失败静默：不递归、不阻塞主流程
  }
}

/** 读取全部错误（按时间倒序，最近在前） */
export async function listErrors(): Promise<ErrorBufferRecord[]> {
  try {
    await initDB()
    return db.errorBuffer.orderBy('ts').reverse().toArray()
  } catch {
    return []
  }
}

/** 清空错误记录（测试 / 用户隐私管理） */
export async function clearErrors(): Promise<void> {
  try {
    await initDB()
    await db.errorBuffer.clear()
  } catch {
    // 静默
  }
}

/** 安装全局错误捕获（main.ts 入口调用一次） */
export function installErrorBuffer(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    void recordError({
      kind: event.target instanceof HTMLElement ? 'resource' : 'error',
      message: event.message || '未知脚本错误',
      ...(event.filename ? { source: event.filename } : {}),
      ...(event.lineno ? { lineno: event.lineno } : {}),
      ...(event.colno ? { colno: event.colno } : {}),
      ...(event.error instanceof Error && event.error.stack ? { stack: event.error.stack } : {}),
    })
  })
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    void recordError({
      kind: 'unhandledrejection',
      message: reason instanceof Error ? reason.message : String(reason),
      ...(reason instanceof Error && reason.stack ? { stack: reason.stack } : {}),
    })
  })
}
