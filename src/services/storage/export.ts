/**
 * 品鉴记录导出（P2-12）
 * 数据自主权：一键把 IndexedDB 品鉴记录导出为 JSON 文件，不做端到端加密。
 * 隐私：只导出用户自己的品鉴记录，不含任何网络上报。
 */

import { db, initDB } from './db'

/** 导出文件元信息 + 记录数组 */
export interface ExportPayload {
  app: '一盏茶'
  schemaVersion: 1
  exportedAt: string
  /** 品鉴记录数（导出时快照） */
  recordCount: number
  records: Array<Record<string, unknown>>
}

/**
 * 读取全部品鉴记录并组装导出载荷。
 * 失败（IndexedDB 不可用等）返回 null，由调用方提示用户，不抛异常。
 */
export async function buildExportPayload(): Promise<ExportPayload | null> {
  try {
    await initDB()
    const records = await db.tastings.toArray()
    return {
      app: '一盏茶',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      records: records.map((r) => ({ ...r })),
    }
  } catch {
    return null
  }
}

/** 触发浏览器下载 .json 文件（文件名带日期） */
export function downloadExport(payload: ExportPayload): void {
  const date = new Date().toISOString().split('T')[0]
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tasting-records-${date}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
