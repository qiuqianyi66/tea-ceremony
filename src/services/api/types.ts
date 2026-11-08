/**
 * API 共享类型（与后端 ApiResponse 契约一致：code / message / data）
 * 收敛历史：原在 auth / garden / records / teas 四个文件各自重复定义，2026-10-17 统一到此处。
 */
export interface ApiResponse<T> {
  code: string
  message: string
  data: T
}

/**
 * 离线 / 后端不可用时的成功兜底响应（requestOrMock 的 mock 分支专用）。
 * 语义固定为 OK + 'ok'：mock 数据视为成功，避免调用方把离线当失败重试。
 */
export function offlineOk<T>(data: T): ApiResponse<T> {
  return { code: 'OK', message: 'ok', data }
}
