/**
 * teaAI 降级逻辑测试：后端 AI 代理不可用 / 返回 502 时，仍能产出回复。
 *
 * 用 vi.resetModules + 动态 import 获取全新模块实例，规避模块级 15s 节流等待。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TasteDimensions } from '@/types/tasting'

async function freshTeaAI() {
  vi.resetModules()
  return await import('@/services/teaAI')
}

const DIMENSIONS: TasteDimensions = {
  bitterness: 2,
  sweetness: 4,
  aftertaste: 5,
  body: 3,
  aroma: 5,
  rhyme: 4,
  shape: 3,
  mind: 5,
}

// 制造登录态：authStorage.loadAuth 读 localStorage['tea-auth'].token（非 dev-token 即真登录）
function loginAsJwt() {
  localStorage.setItem('tea-auth', JSON.stringify({ token: 'jwt-abc', user: { id: 1 } }))
}
function logout() {
  localStorage.removeItem('tea-auth')
  localStorage.removeItem('tea-ai-session')
}

afterEach(() => {
  vi.unstubAllGlobals()
  logout()
})

describe('teaAI 降级逻辑（后端代理不可用时）', () => {
  it('generateTastingNote：网络失败降级为规则评语', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const { generateTastingNote } = await freshTeaAI()
    const note = await generateTastingNote('西湖龙井', DIMENSIONS, 8.6)
    expect(note).toContain('今日品西湖龙井')
    expect(note).toContain('回甘悠长')
  })

  it('askTeaMaster：网络失败返回兜底回复', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('今天适合喝什么茶？')
    expect(reply).toBeTruthy()
    expect(reply.length).toBeGreaterThan(0)
  })

  it('askTeaMaster：代理返回 502 时返回兜底回复', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('茶道是什么？')
    expect(reply).toBeTruthy()
    expect(reply.length).toBeGreaterThan(0)
  })

  it('askTeaMaster：离线时含茶名问题返回该茶冲泡参数（数据驱动，非通用格言）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('西湖龙井怎么泡？')
    expect(reply).toContain('西湖龙井')
    expect(reply).toContain('80')
    expect(reply).toContain('秒')
  })

  it('askTeaMaster：离线时含茶类问题返回该类基准参数', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('红茶用什么水温？')
    expect(reply).toContain('红茶')
    expect(reply).toContain('90')
  })

  it('askTeaMaster：离线时含茶器问题返回茶器信息', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('盖碗有什么好处？')
    expect(reply).toContain('盖碗')
  })
})

describe('teaAI v1 成功路径（ApiResponse 解包）', () => {
  it('askTeaMaster：v1 端点成功返回 LLM 内容，不走降级', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('culture/search')) {
        return {
          ok: true,
          json: async () => ({
            code: 'OK',
            data: { teas: [], people: [], regions: [], poems: [] },
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({ code: 'OK', data: { content: '这是 AI 茶博士回复' } }),
      }
    })
    vi.stubGlobal('fetch', mockFetch)
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('你好')
    expect(reply).toBe('这是 AI 茶博士回复')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/ai/chat'),
      expect.any(Object),
    )
  })

  it('generateTastingNote：v1 成功返回 LLM 文风评语', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ code: 'OK', data: { content: '这是 AI 生成的品鉴评语' } }),
      })),
    )
    const { generateTastingNote } = await freshTeaAI()
    const note = await generateTastingNote('西湖龙井', DIMENSIONS, 8.6)
    expect(note).toBe('这是 AI 生成的品鉴评语')
  })
})

describe('teaAI 登录态分流 + 会话配额（REQ-ai-session-quota）', () => {
  it('登录：请求带 Authorization + sessionId，不拼本地 history', async () => {
    loginAsJwt()
    localStorage.setItem('tea-ai-session', '42')

    let captured: RequestInit | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = init
        return {
          ok: true,
          json: async () => ({ code: 'OK', data: { content: '回复', sessionId: 42 } }),
        }
      }),
    )

    const { askTeaMaster } = await freshTeaAI()
    await askTeaMaster('你好', [
      { role: 'user', content: '上一句' },
      { role: 'assistant', content: '上一答' },
    ])

    const headers = (captured?.headers as Record<string, string>) ?? {}
    expect(headers.Authorization).toBe('Bearer jwt-abc')
    const body = JSON.parse(captured?.body as string)
    expect(body.sessionId).toBe(42)
    // 登录态不拼本地 history：messages 只有 system + user 两条
    expect(body.messages.length).toBe(2)
  })

  it('登录：首次无 sessionId → 响应返回新 id 后持久化', async () => {
    loginAsJwt()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ code: 'OK', data: { content: '回复', sessionId: 99 } }),
      })),
    )

    const { askTeaMaster } = await freshTeaAI()
    await askTeaMaster('你好')

    expect(localStorage.getItem('tea-ai-session')).toBe('99')
  })

  it('游客：不注入 Authorization，仍拼本地 history', async () => {
    logout()

    let captured: RequestInit | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = init
        return {
          ok: true,
          json: async () => ({ code: 'OK', data: { content: '回复' } }),
        }
      }),
    )

    const { askTeaMaster } = await freshTeaAI()
    await askTeaMaster('你好', [{ role: 'user', content: '上一句' }])

    const headers = (captured?.headers as Record<string, string>) ?? {}
    expect(headers.Authorization).toBeUndefined()
    const body = JSON.parse(captured?.body as string)
    expect(body.sessionId).toBeUndefined()
    // 游客拼本地 history：system + history(1) + user = 3 条
    expect(body.messages.length).toBe(3)
  })

  it('配额超限（429）：清 sessionId + 规则降级', async () => {
    loginAsJwt()
    localStorage.setItem('tea-ai-session', '42')

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 429 })),
    )

    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('西湖龙井怎么泡？')

    expect(localStorage.getItem('tea-ai-session')).toBeNull()
    // 规则降级：茶名问题返回该茶冲泡参数
    expect(reply).toContain('西湖龙井')
  })
})
