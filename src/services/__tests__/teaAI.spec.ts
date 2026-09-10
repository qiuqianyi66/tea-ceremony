/**
 * teaAI 降级逻辑测试：后端 AI 代理不可用 / 返回 502 时，仍能产出回复。
 *
 * 用 vi.resetModules + 动态 import 获取全新模块实例，规避模块级 15s 节流等待。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { TasteDimensions } from '@/types/tasting'

async function freshTeaAI() {
  vi.resetModules()
  return await import('@/services/teaAI')
}

const DIMENSIONS: TasteDimensions = {
  bitterness: 2, sweetness: 4, aftertaste: 5, body: 3,
  aroma: 5, rhyme: 4, shape: 3, mind: 5,
}

afterEach(() => {
  vi.unstubAllGlobals()
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
