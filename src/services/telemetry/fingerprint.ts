/**
 * 错误指纹（契约 §5，前后端必须一致）
 *
 * 为什么不用 SHA-256：站点当前跑在 HTTP 上，`crypto.subtle` 不可用（实测 hasCryptoSubtle: false）。
 * 指纹必须在任何上下文都能算，故用纯 JS FNV-1a 64bit；16 hex = 64bit，碰撞风险对本用途可接受。
 */
import { LINENO_BUCKET, MAX_SOURCE_LEN, MESSAGE_TRUNCATE_LEN } from './config'
import type { TelemetryErrorKind } from './types'

// 归一化规则（契约 §5 步骤 1）。顺序不能换：
// 先去 URL（里面的数字/长串会污染后续规则），再去 UUID，再压长 token，最后压引号字面量与数字。
const URL_RE = /https?:\/\/[^\s)]+/g
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const TOKEN_RE = /[A-Za-z0-9_-]{24,}/g
const QUOTED_RE = /'[^']*'|"[^"]*"/g
const NUMBER_RE = /\b\d+\b/g

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const FNV_MASK_64 = 0xffffffffffffffffn

/**
 * message 归一化（契约 §5）：把同一 bug 的不同实例压成同一串。
 * 五条替换规则 + 截断 300。
 */
export function normalizeMessage(msg: string): string {
  return msg
    .trim()
    .replace(URL_RE, '<url>')
    .replace(UUID_RE, '<uuid>')
    .replace(TOKEN_RE, '<token>')
    .replace(QUOTED_RE, '<str>')
    .replace(NUMBER_RE, '<n>')
    .slice(0, MESSAGE_TRUNCATE_LEN)
}

/**
 * 取 source 的 pathname（契约 §3.1/§5 步骤 2）：去 query 与 hash。
 * 绝对 URL 也压成 pathname，避免同一文件因 host 不同产生两个指纹。
 */
export function toPathname(source: string): string {
  const raw = source.trim()
  if (!raw) return ''

  const hashAt = raw.indexOf('#')
  const queryAt = raw.indexOf('?')
  let cut = raw.length
  if (hashAt >= 0) cut = Math.min(cut, hashAt)
  if (queryAt >= 0) cut = Math.min(cut, queryAt)
  const withoutQuery = raw.slice(0, cut)

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(withoutQuery)) {
    try {
      return new URL(withoutQuery).pathname || '/'
    } catch {
      // 伪 URL（如带协议头的相对串）解析失败时退回原串，宁可指纹粗一点也不要抛错
      return withoutQuery
    }
  }
  return withoutQuery
}

/**
 * 手工 UTF-8 编码：不依赖 TextEncoder，保证在任意运行时（旧 WebView / 测试环境）字节序列一致。
 * 中文错误消息必须按字节运算——若只取 charCode 低 8 位，不同汉字会塌成同一字节而撞指纹。
 */
function utf8Bytes(input: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) {
    const code = input.codePointAt(i) ?? 0
    if (code > 0xffff) i++ // 4 字节码位占两个 code unit，跳过低位代理
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }
  return bytes
}

/**
 * FNV-1a 64bit → 16 位小写 hex。
 * JS 位运算只有 32 位，64 位乘法必须走 BigInt（双 32 位模拟可读性太差且更易出错）。
 */
export function fnv1a64(str: string): string {
  let hash = FNV_OFFSET_BASIS
  for (const byte of utf8Bytes(str)) {
    hash ^= BigInt(byte)
    hash = (hash * FNV_PRIME) & FNV_MASK_64
  }
  return hash.toString(16).padStart(16, '0')
}

/**
 * 错误指纹（契约 §5 步骤 3-5）。
 * lineno 按 10 行分桶：行号漂移 10 行内视为同一处（压缩产物重新构建后行号会整体平移）。
 */
export function fingerprint(
  kind: TelemetryErrorKind,
  source: string,
  lineno: number | undefined,
  message: string,
): string {
  const pathname = toPathname(source).slice(0, MAX_SOURCE_LEN)
  const bucket = Math.floor((lineno ?? 0) / LINENO_BUCKET) * LINENO_BUCKET
  const key = `${kind}|${pathname}|${bucket}|${normalizeMessage(message)}`
  return fnv1a64(key)
}
