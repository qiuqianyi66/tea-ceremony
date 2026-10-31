// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'

const { askTeaMasterMock } = vi.hoisted(() => ({ askTeaMasterMock: vi.fn() }))

vi.mock('@/services/teaAI', () => ({
  askTeaMasterStream: askTeaMasterMock,
  TEA_AGENTS: [
    { value: 'auto', label: '自动', icon: 'Sparkles' },
    { value: 'advisor', label: '荐茶', icon: 'Leaf' },
  ],
}))
vi.mock('@/services/tracking', () => ({ track: vi.fn() }))

import AIAsk from '@/views/AIAsk.vue'
import { registerIcons } from '@/plugins/icons'

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/ai', name: 'ai', component: AIAsk },
    ],
  })
}

async function mountChat() {
  const router = makeRouter()
  router.push('/ai')
  await router.isReady()
  const wrapper = mount(AIAsk, {
    global: { plugins: [router, registerIcons] },
  })
  await flushPromises()
  return wrapper
}

describe('AIAsk', () => {
  beforeEach(() => {
    askTeaMasterMock.mockReset()
    // jsdom 未实现 Element.scrollTo，组件 scrollToBottom 会调用它
    Element.prototype.scrollTo = vi.fn()
  })

  it('空状态渲染引导文案与 5 个建议按钮，无气泡', async () => {
    const wrapper = await mountChat()
    expect(wrapper.text()).toContain('有什么关于茶的问题想问？')
    expect(wrapper.findAll('.ai-suggestion-btn')).toHaveLength(5)
    expect(wrapper.find('.ai-user-bubble').exists()).toBe(false)
    expect(wrapper.find('.ai-ai-bubble').exists()).toBe(false)
  })

  it('点建议按钮后调用 askTeaMasterStream 并渲染用户气泡与 AI 回复气泡（含来源 chip）', async () => {
    askTeaMasterMock.mockResolvedValue({ content: '龙井适合今天喝', sources: ['茶·龙井'] })
    const wrapper = await mountChat()

    await wrapper.findAll('.ai-suggestion-btn')[0].trigger('click')
    await flushPromises()

    expect(askTeaMasterMock).toHaveBeenCalledTimes(1)
    expect(askTeaMasterMock).toHaveBeenCalledWith('今天适合喝什么茶？', expect.any(Array), 'auto', expect.any(Function), expect.any(AbortSignal))
    expect(wrapper.find('.ai-user-bubble').text()).toContain('今天适合喝什么茶？')
    expect(wrapper.find('.ai-ai-bubble').text()).toContain('龙井适合今天喝')
    expect(wrapper.find('.ai-source-chip').text()).toContain('茶·龙井')
  })
})
