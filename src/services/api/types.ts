/**
 * API 共享类型（与后端 ApiResponse 契约一致：code / message / data）
 * 收敛历史：原在 auth / garden / records / teas 四个文件各自重复定义，2026-10-17 统一到此处。
 */
export interface ApiResponse<T> {
  code: string
  message: string
  data: T
}
