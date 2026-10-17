/**
 * API 基础路径（单一来源）
 * 生产环境通过 Nginx 代理到 /api；开发环境可用 VITE_API_URL 指向后端。
 * 统一补齐 /api，避免把 http://localhost:8000 配置成不带前缀的错误地址。
 */
export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
