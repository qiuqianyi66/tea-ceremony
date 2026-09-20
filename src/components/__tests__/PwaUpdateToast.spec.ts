import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const { registrations } = vi.hoisted(() => ({
  registrations: [] as Array<{
    opts: { onNeedRefresh: () => void }
    updateSW: ReturnType<typeof vi.fn>
  }>,
}))

vi.mock('virtual:pwa-register', () => ({
  registerSW: (opts: { onNeedRefresh: () => void }) => {
    const updateSW = vi.fn()
    registrations.push({ opts, updateSW })
    return updateSW
  },
}))

import PwaUpdateToast from '@/components/PwaUpdateToast.vue'

function mountToast() {
  return mount(PwaUpdateToast, { global: { stubs: { teleport: true } } })
}

describe('PwaUpdateToast', () => {
  beforeEach(() => {
    registrations.length = 0
  })

  it('默认不显示更新提示', () => {
    const wrapper = mountToast()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('needRefresh 触发后显示提示', async () => {
    const wrapper = mountToast()
    expect(wrapper.find('[role="status"]').exists()).toBe(false)

    registrations[0].opts.onNeedRefresh()
    await nextTick()

    expect(wrapper.text()).toContain('新版本已就绪')
  })

  it('点「立即更新」调用 updateSW(true)（SKIP_WAITING + reload）', async () => {
    const wrapper = mountToast()
    registrations[0].opts.onNeedRefresh()
    await nextTick()

    await wrapper.findAll('button')[0].trigger('click')

    expect(registrations[0].updateSW).toHaveBeenCalledTimes(1)
    expect(registrations[0].updateSW).toHaveBeenCalledWith(true)
  })

  it('点「稍后」隐藏提示，不触发更新', async () => {
    const wrapper = mountToast()
    registrations[0].opts.onNeedRefresh()
    await nextTick()

    await wrapper.findAll('button')[1].trigger('click')
    await nextTick()

    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(registrations[0].updateSW).not.toHaveBeenCalled()
  })
})
