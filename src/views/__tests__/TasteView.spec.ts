// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import TasteView from '@/views/TasteView.vue'
import { useTeaStore } from '@/stores/tea'
import { getTeaById } from '@/data/teas'
import { registerIcons } from '@/plugins/icons'

// 茶灵 AI 在测试里不应真正发起网络请求：mock 成稳定返回的纯函数。
vi.mock('@/services/teaAI', () => ({
  generateTastingNote: vi.fn(() => Promise.resolve('茶灵测试评论')),
}))

const ObserveStub = {
  name: 'TasteObserveStep',
  template: '<button class="observe-next" @click="$emit(\'next\')">next</button>',
  emits: ['next'],
}
const RadarStub = { name: 'TasteRadarChart', template: '<div class="radar-stub"></div>' }
const TrendStub = { name: 'TasteTrendChart', template: '<div class="trend-stub"></div>' }
const CardStub = { name: 'TastingCard', template: '<div class="card-stub"></div>' }
const StepIndicatorStub = { name: 'TasteStepIndicator', template: '<div class="step-stub"></div>' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/select', name: 'select', component: { template: '<div>select</div>' } },
      { path: '/taste', name: 'taste', component: { template: '<div>taste</div>' } },
    ],
  })
}

describe('TasteView', () => {
  let pinia: ReturnType<typeof createPinia>
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    vi.restoreAllMocks()
  })

  async function mountTaste() {
    const router = makeRouter()
    router.push('/taste')
    await router.isReady()
    wrapper = mount(TasteView, {
      global: {
        plugins: [pinia, router, registerIcons],
        stubs: {
          TasteObserveStep: ObserveStub,
          TasteRadarChart: RadarStub,
          TasteTrendChart: TrendStub,
          TastingCard: CardStub,
          TasteStepIndicator: StepIndicatorStub,
        },
      },
    })
    await flushPromises()
    return wrapper
  }

  function buttonByText(w: ReturnType<typeof mount>, text: string) {
    return w.findAll('button').find((b) => b.text().includes(text))!
  }

  it('toggles an aroma selection on click and toggles off on second click', async () => {
    const w = await mountTaste()
    await w.find('.observe-next').trigger('click')
    await flushPromises()
    const flowerBtn = w.findAll('button').find((b) => b.text().includes('花香'))!
    expect(flowerBtn.classes().join(' ')).not.toContain('border-[var(--color-tea-gold)]')
    await flowerBtn.trigger('click')
    await flushPromises()
    expect(flowerBtn.classes().join(' ')).toContain('border-[var(--color-tea-gold)]')
    await flowerBtn.trigger('click')
    await flushPromises()
    expect(flowerBtn.classes().join(' ')).not.toContain('border-[var(--color-tea-gold)]')
  })

  it('enforces mutual exclusion within a feel-tag group', async () => {
    const w = await mountTaste()
    await w.find('.observe-next').trigger('click')
    await flushPromises()
    await buttonByText(w, '闻香完成').trigger('click')
    await flushPromises()
    const bitter = w.findAll('button').find((b) => b.text().trim() === '有点苦')!
    const astringent = w.findAll('button').find((b) => b.text().trim() === '涩口')!
    await bitter.trigger('click')
    await flushPromises()
    expect(bitter.classes().join(' ')).toContain('bg-[var(--color-tea-gold)]')
    await astringent.trigger('click')
    await flushPromises()
    expect(astringent.classes().join(' ')).toContain('bg-[var(--color-tea-gold)]')
    expect(bitter.classes().join(' ')).not.toContain('bg-[var(--color-tea-gold)]')
  })

  it('saves the record and enters the result step on submit success', async () => {
    const tea = useTeaStore()
    tea.currentTea = { ...getTeaById('longjing')!, infusions: 3 } as never
    vi.spyOn(tea, 'calculateScore').mockReturnValue(88)
    const fakeRecord = {
      id: 'r1',
      teaId: 'longjing',
      teaName: '龙井',
      date: '2026-10-20',
      brewTemp: 85,
      brewTime: 30,
      infusions: 3,
      dimensions: {
        bitterness: 2,
        sweetness: 4,
        aftertaste: 5,
        body: 3,
        aroma: 4,
        rhyme: 4,
        shape: 3,
        mind: 4,
      },
      overallScore: 88,
      processFactor: 1.0,
    } as never
    vi.spyOn(tea, 'saveRecord').mockResolvedValue(fakeRecord)
    const w = await mountTaste()
    await w.find('.observe-next').trigger('click')
    await flushPromises()
    await buttonByText(w, '闻香完成').trigger('click')
    await flushPromises()
    await buttonByText(w, '完成品鉴').trigger('click')
    await flushPromises()
    await flushPromises()
    expect(tea.saveRecord).toHaveBeenCalled()
    expect(w.text()).toContain('品鉴结果')
    expect(w.text()).toContain('茶灵测试评论')
    expect(w.text()).not.toContain('保存失败')
  })

  it('shows a save error and stays on the form when saving fails', async () => {
    const tea = useTeaStore()
    tea.currentTea = { ...getTeaById('longjing')!, infusions: 3 } as never
    vi.spyOn(tea, 'saveRecord').mockRejectedValue(new Error('storage denied'))
    const w = await mountTaste()
    await w.find('.observe-next').trigger('click')
    await flushPromises()
    await buttonByText(w, '闻香完成').trigger('click')
    await flushPromises()
    await buttonByText(w, '完成品鉴').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('保存失败')
    expect(w.text()).not.toContain('品鉴结果')
  })
})
