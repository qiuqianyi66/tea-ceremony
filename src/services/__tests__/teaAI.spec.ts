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
    expect(reply.content).toBeTruthy()
    expect(reply.content.length).toBeGreaterThan(0)
    // P-O4：降级路径 sources 为空
    expect(reply.sources).toEqual([])
  })

  it('askTeaMaster：代理返回 502 时返回兜底回复', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('茶道是什么？')
    expect(reply.content).toBeTruthy()
    expect(reply.content.length).toBeGreaterThan(0)
  })

  it('askTeaMaster：离线时含茶名问题返回该茶冲泡参数（数据驱动，非通用格言）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('西湖龙井怎么泡？')
    expect(reply.content).toContain('西湖龙井')
    expect(reply.content).toContain('80')
    expect(reply.content).toContain('秒')
  })

  it('askTeaMaster：离线时含茶类问题返回该类基准参数', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('红茶用什么水温？')
    expect(reply.content).toContain('红茶')
    expect(reply.content).toContain('90')
  })

  it('askTeaMaster：离线时含茶器问题返回茶器信息', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network down')))
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('盖碗有什么好处？')
    expect(reply.content).toContain('盖碗')
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
    expect(reply.content).toBe('这是 AI 茶博士回复')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/ai/chat'),
      expect.any(Object),
    )
  })

  it('askTeaMaster：成功响应解包 sources（P-O4），缺省为 null 时为空数组', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          code: 'OK',
          data: { content: '回复', sources: ['茶·龙井', '诗·《茶经》'] },
        }),
      })),
    )
    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('讲讲龙井')
    expect(reply.content).toBe('回复')
    expect(reply.sources).toEqual(['茶·龙井', '诗·《茶经》'])

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ code: 'OK', data: { content: '回复' } }),
      })),
    )
    const { askTeaMaster: askAgain } = await freshTeaAI()
    const noSources = await askAgain('你好')
    expect(noSources.sources).toEqual([])
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
    expect(reply.content).toContain('西湖龙井')
  })
})

describe('teaAI 专家选择（F-M5-7 前端适配）', () => {
  it('不传 agent：body 不含 agent 字段（保持隐式路由，零回归）', async () => {
    let captured: RequestInit | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = init
        return { ok: true, json: async () => ({ code: 'OK', data: { content: '回复' } }) }
      }),
    )

    const { askTeaMaster } = await freshTeaAI()
    await askTeaMaster('你好')

    const body = JSON.parse(captured?.body as string)
    expect(body.agent).toBeUndefined()
  })

  it('传 agent：body 带该 agent，且 system prompt 仍在', async () => {
    let captured: RequestInit | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = init
        return { ok: true, json: async () => ({ code: 'OK', data: { content: '回复' } }) }
      }),
    )

    const { askTeaMaster } = await freshTeaAI()
    await askTeaMaster('我泡的岩茶有焦味', [], 'taster')

    const body = JSON.parse(captured?.body as string)
    expect(body.agent).toBe('taster')
    // 承重墙：system prompt 必须仍在（首条 role=system）
    expect(body.messages[0].role).toBe('system')
  })

  it('agent=auto 视为不传（UI 默认档不改变路由语义）', async () => {
    let captured: RequestInit | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = init
        return { ok: true, json: async () => ({ code: 'OK', data: { content: '回复' } }) }
      }),
    )

    const { askTeaMaster } = await freshTeaAI()
    await askTeaMaster('你好', [], 'auto')

    const body = JSON.parse(captured?.body as string)
    expect(body.agent).toBeUndefined()
  })

  it('传 agent 但降级：仍走规则回复（承重墙不受影响）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 502 })),
    )

    const { askTeaMaster } = await freshTeaAI()
    const reply = await askTeaMaster('西湖龙井怎么泡？', [], 'brewer')

    expect(typeof reply.content).toBe('string')
    expect(reply.content.length).toBeGreaterThan(0)
    expect(reply.sources).toEqual([])
  })
})

describe('teaAI 系统提示安全红线（F-A / Phase 1 回归锁）', () => {
  // 删掉 AI_SYSTEM_PROMPT 的安全段 → 这些断言应变红
  async function captureSystemContent(question: string): Promise<string> {
    let captured: RequestInit | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        captured = init
        return { ok: true, json: async () => ({ code: 'OK', data: { content: '回复' } }) }
      }),
    )
    const { askTeaMaster } = await freshTeaAI()
    await askTeaMaster(question)
    const body = JSON.parse(captured?.body as string)
    return body.messages[0].content as string
  }

  it('system prompt 含功效安全约束（非药物 + 禁暗示疗效）', async () => {
    const system = await captureSystemContent('喝茶能减肥吗？')
    expect(system).toContain('安全红线')
    expect(system).toContain('茶是饮品而非药物')
    expect(system).toContain('禁引经据典暗示疗效')
  })

  it('system prompt 含咖啡因提示与低因替代约束', async () => {
    const system = await captureSystemContent('睡前能喝茶吗？')
    expect(system).toContain('咖啡因')
    expect(system).toContain('低因替代')
  })

  it('system prompt 含越权与整书复制拒绝约束', async () => {
    const system = await captureSystemContent('你好')
    expect(system).toContain('拒绝越权请求')
    expect(system).toContain('整书复制')
  })
})

describe('teaAI 超时预算（RAG / LLM 挂起不拖垮链路）', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  /** 模拟「永不返回、但对 abort 作出响应」的请求（与真实 fetch 的中止语义一致）。 */
  function hangingFetch() {
    return vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<never>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
  }

  it('RAG 请求带中止信号（超时保护存在，删掉即变红）', async () => {
    let ragInit: RequestInit | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        if (url.includes('culture/search')) {
          ragInit = init
          return Promise.resolve({ ok: true, json: async () => ({ code: 'OK', data: {} }) })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ code: 'OK', data: { content: '回复' } }),
        })
      }),
    )
    const { askTeaMaster } = await freshTeaAI()
    await askTeaMaster('你好')
    expect(ragInit?.signal).toBeInstanceOf(AbortSignal)
  })

  it('RAG 检索挂起：在预算内中止并继续 chat，不无限等待', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: RequestInit) => {
        if (url.includes('culture/search')) {
          return new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ code: 'OK', data: { content: 'AI 回复' } }),
        })
      }),
    )

    const { askTeaMaster } = await freshTeaAI()
    const pending = askTeaMaster('西湖龙井怎么泡？')
    // 推进超过 RAG 预算：挂起的检索被中止 → 降级为空 → chat 照常发出
    await vi.advanceTimersByTimeAsync(6_000)
    await expect(pending).resolves.toMatchObject({ content: 'AI 回复' })
  })

  it('LLM 挂起：超过预算后降级为规则评语（callLLM 超时保护）', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingFetch())
    const { generateTastingNote } = await freshTeaAI()
    const pending = generateTastingNote('西湖龙井', DIMENSIONS, 8.6)
    await vi.advanceTimersByTimeAsync(31_000)
    await expect(pending).resolves.toContain('今日品西湖龙井')
  })
})
