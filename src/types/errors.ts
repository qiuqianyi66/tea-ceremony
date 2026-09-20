/**
 * 前端本地错误缓冲类型（P2-9）
 * 纯本地 IndexedDB，无网络外发（ADR-006）。只存结构化错误信息，不含用户输入。
 */

export interface ErrorBufferRecord {
  /** 自增主键（Dexie 生成） */
  id?: number
  /** 捕获时间（ISO） */
  ts: string
  /** 错误类型：window error / unhandledrejection / 资源加载失败 */
  kind: 'error' | 'unhandledrejection' | 'resource'
  message: string
  /** 出错文件 URL（error 事件） */
  source?: string
  lineno?: number
  colno?: number
  /** 堆栈（error 事件与 rejection reason 为 Error 实例时） */
  stack?: string
}
