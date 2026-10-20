// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ShareView from '@/views/ShareView.vue'
import {
  encodeShareData,
  encodeTeaShare,
  type TastingCardShareData,
  type TeaShareData,
} from '@/services/share'

const TastingCardStub = {
  name: 'TastingCard',
  template: '<div class="tasting-card-stub"></div>',
  props: ['record', 'standalone'],
}
const TeaKnowledgeCardStub = {
  name: 'TeaKnowledgeCard',
  template: '<div class="tea-knowledge-stub"></div>',
  props: ['tea', 'standalone'],
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div>home</div>' } },
      { path: '/share', name: 'share', component: { template: '<div>share</div>' } },
    ],
  })
}

async function mountWithQuery(query: Record<string, string>) {
  const router = makeRouter()
  router.push({ path: '/share', query })
  await router.isReady()
  const wrapper = mount(ShareView, {
    global: {
      plugins: [router],
      stubs: { TastingCard: TastingCardStub, TeaKnowledgeCard: TeaKnowledgeCardStub },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

const sampleCard: TastingCardShareData = {
  version: 1,
  teaName: '测试茶',
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
}

const sampleTea: TeaShareData = {
  teaId: 'longjing',
  teaName: '龙井',
  teaType: '绿茶',
  origin: '杭州',
  flavor: ['豆香'],
  description: '扁平光滑，香郁味甘',
}

describe('ShareView', () => {
  it('renders the invalid message for a garbage ?r payload', async () => {
    const { wrapper } = await mountWithQuery({ r: 'not-a-valid-share-payload!!!' })
    expect(wrapper.text()).toContain('无效或已损坏')
    expect(wrapper.find('.tasting-card-stub').exists()).toBe(false)
  })

  it('renders the invalid message for a garbage ?t payload', async () => {
    const { wrapper } = await mountWithQuery({ t: '!!!bad' })
    expect(wrapper.text()).toContain('无效或已损坏')
    expect(wrapper.find('.tea-knowledge-stub').exists()).toBe(false)
  })

  it('renders TastingCard for a valid ?r payload', async () => {
    const { wrapper } = await mountWithQuery({ r: encodeShareData(sampleCard) })
    expect(wrapper.find('.tasting-card-stub').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('无效或已损坏')
  })

  it('renders TeaKnowledgeCard for a valid ?t payload', async () => {
    const { wrapper } = await mountWithQuery({ t: encodeTeaShare(sampleTea) })
    expect(wrapper.find('.tea-knowledge-stub').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('无效或已损坏')
  })

  it('renders the invalid message when no share params are present', async () => {
    const { wrapper } = await mountWithQuery({})
    expect(wrapper.text()).toContain('无效或已损坏')
  })
})
