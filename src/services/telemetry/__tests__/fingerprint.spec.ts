/**
 * 错误指纹单测：src/services/telemetry/fingerprint.ts（契约 §5）
 * 重点：五条归一化规则、行号 10 行分桶、契约给的一致性向量、不依赖 crypto.subtle。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fingerprint, fnv1a64, normalizeMessage, toPathname } from '../fingerprint'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeMessage（契约 §5 步骤 1）', () => {
  it('去首尾空白', () => {
    expect(normalizeMessage('   boom   ')).toBe('boom')
  })

  it('URL → <url>', () => {
    expect(normalizeMessage('GET https://api.example.com/a?b=1 failed')).toBe('GET <url> failed')
  })

  it('UUID → <uuid>', () => {
    expect(normalizeMessage('user 8f14e45f-ea9c-4c1b-9c1a-1a2b3c4d5e6f missing')).toBe(
      'user <uuid> missing',
    )
  })

  it('长 token（≥24 位）→ <token>，23 位以下不动', () => {
    expect(normalizeMessage('chunk abcdefghijklmnopqrstuvwx loaded')).toBe('chunk <token> loaded')
    expect(normalizeMessage('chunk abcdefghijklmnopqrstuvw loaded')).toBe(
      'chunk abcdefghijklmnopqrstuvw loaded',
    )
  })

  it('引号内字面量 → <str>（单双引号都算）', () => {
    expect(normalizeMessage("Cannot read properties of undefined (reading 'foo')")).toBe(
      'Cannot read properties of undefined (reading <str>)',
    )
    expect(normalizeMessage('unknown key "bar"')).toBe('unknown key <str>')
  })

  it('独立数字 → <n>', () => {
    expect(normalizeMessage('status 404 after 3 retries')).toBe('status <n> after <n> retries')
  })

  it('超过 300 字符截断', () => {
    // 用带空格的短词，避免被 token 规则先吃掉
    const long = 'ab '.repeat(200)
    expect(normalizeMessage(long).length).toBe(300)
  })

  it('多规则叠加后仍收敛（同一 bug 的不同参数）', () => {
    const a = normalizeMessage(
      "Failed https://x.y/z?id=42 (uuid 8f14e45f-ea9c-4c1b-9c1a-1a2b3c4d5e6f) 'foo'",
    )
    const b = normalizeMessage(
      "Failed https://a.b/c?id=99 (uuid 3c59dc04-8e5c-4a1e-b7f0-0f6a1c2d3e4f) 'bar'",
    )
    expect(a).toBe(b)
  })
})

describe('toPathname（契约 §5 步骤 2）', () => {
  it('去掉 query 与 hash', () => {
    expect(toPathname('/assets/index.js?v=2#top')).toBe('/assets/index.js')
  })

  it('绝对 URL 只留 pathname', () => {
    expect(toPathname('http://42.121.125.4/assets/index-bsowGVBP.js?x=1')).toBe(
      '/assets/index-bsowGVBP.js',
    )
  })

  it('空来源返回空串', () => {
    expect(toPathname('   ')).toBe('')
  })
})

describe('fnv1a64（已知向量）', () => {
  it('空串 → offset basis', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325')
  })

  it('"a" → af63dc4c8601ec8c', () => {
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c')
  })

  it('"foobar" → 85944171f73967e8', () => {
    expect(fnv1a64('foobar')).toBe('85944171f73967e8')
  })

  it('始终返回 16 位小写 hex', () => {
    expect(fnv1a64('中文错误消息')).toMatch(/^[0-9a-f]{16}$/)
  })

  it('中文按 UTF-8 字节参与运算，不同汉字不撞', () => {
    expect(fnv1a64('茶')).not.toBe(fnv1a64('水'))
  })
})

describe('fingerprint（契约 §5 步骤 3-5）', () => {
  it('契约给定的一致性向量：行号 10 行内 + 引号字面量不同 → 同一指纹', () => {
    const a = fingerprint(
      'error',
      '/assets/index.js',
      1234,
      "TypeError: Cannot read properties of undefined (reading 'foo')",
    )
    const b = fingerprint(
      'error',
      '/assets/index.js',
      1239,
      "TypeError: Cannot read properties of undefined (reading 'bar')",
    )
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{16}$/)
  })

  it('行号跨桶（1234 vs 1240）→ 不同指纹', () => {
    const a = fingerprint('error', '/a.js', 1234, 'boom')
    const b = fingerprint('error', '/a.js', 1240, 'boom')
    expect(a).not.toBe(b)
  })

  it('kind 不同 → 不同指纹', () => {
    expect(fingerprint('error', '/a.js', 1, 'boom')).not.toBe(
      fingerprint('unhandledrejection', '/a.js', 1, 'boom'),
    )
  })

  it('source 的 query/hash 与绝对 URL 的 host 不影响指纹', () => {
    const base = fingerprint('error', '/a.js', 1, 'boom')
    expect(fingerprint('error', '/a.js?v=1#x', 1, 'boom')).toBe(base)
    expect(fingerprint('error', 'http://42.121.125.4/a.js?x=1', 1, 'boom')).toBe(base)
  })

  it('lineno 缺失等价于 0 行（仍可算指纹）', () => {
    expect(fingerprint('error', '/a.js', undefined, 'boom')).toBe(
      fingerprint('error', '/a.js', 0, 'boom'),
    )
  })
})

describe('不依赖 crypto.subtle（HTTP 站点也能算）', () => {
  it('源码里没有任何 crypto 引用（注释除外）', () => {
    // jsdom 环境下 import.meta.url 是 http 协议，用 cwd 定位源码文件
    const source = readFileSync(
      resolve(process.cwd(), 'src/services/telemetry/fingerprint.ts'),
      'utf8',
    )
    const codeOnly = source
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim()
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')
      })
      .join('\n')
    expect(codeOnly).not.toMatch(/crypto/i)
  })

  it('全局 crypto 不可用时仍能算出指纹', () => {
    vi.stubGlobal('crypto', undefined)
    const value = fingerprint('error', '/a.js', 1, 'boom')
    expect(value).toMatch(/^[0-9a-f]{16}$/)
  })
})
