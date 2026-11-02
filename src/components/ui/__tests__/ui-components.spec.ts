import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import Badge from '@/components/ui/BaseBadge.vue'
import Button from '@/components/ui/BaseButton.vue'
import Card from '@/components/ui/BaseCard.vue'
import Modal from '@/components/ui/BaseModal.vue'
import Tabs from '@/components/ui/BaseTabs.vue'
import Tooltip from '@/components/ui/BaseTooltip.vue'

describe('Button', () => {
  it('渲染文案并在点击时派发 click', async () => {
    const wrapper = mount(Button, { slots: { default: '立即入席' } })
    expect(wrapper.text()).toContain('立即入席')

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('disabled 时不派发 click', async () => {
    const wrapper = mount(Button, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()

    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('loading 时禁用并标记 aria-busy', () => {
    const wrapper = mount(Button, { props: { loading: true }, slots: { default: '保存中' } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.attributes('aria-busy')).toBe('true')
    // 加载态保留文案，避免按钮失去可访问名称
    expect(wrapper.text()).toContain('保存中')
  })

  it('invalid 时标记 aria-invalid 并加朱砂环', () => {
    const wrapper = mount(Button, { props: { invalid: true } })
    expect(wrapper.attributes('aria-invalid')).toBe('true')
    expect(wrapper.html()).toContain('ring-[var(--color-cinnabar)]')
  })

  it('各形态使用设计令牌，不出现裸色值', () => {
    for (const variant of ['primary', 'secondary', 'ghost', 'icon', 'danger'] as const) {
      const html = mount(Button, { props: { variant } }).html()
      expect(html).toContain('var(--color-')
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    }
  })
})

describe('Badge', () => {
  it('默认中性色，指定 tone 后切换令牌', () => {
    expect(mount(Badge, { slots: { default: '新' } }).html()).toContain('var(--color-paper)')
    expect(mount(Badge, { props: { tone: 'cinnabar' } }).html()).toContain(
      'text-[var(--color-cinnabar)]',
    )
  })
})

describe('Card', () => {
  it('渲染 header / 默认 / footer 三个插槽', () => {
    const wrapper = mount(Card, {
      slots: { header: '<span>标题</span>', default: '<p>正文</p>', footer: '<b>底部</b>' },
    })
    expect(wrapper.text()).toContain('标题')
    expect(wrapper.text()).toContain('正文')
    expect(wrapper.text()).toContain('底部')
    expect(wrapper.classes()).toContain('glass-panel')
  })

  it('无 footer 插槽时不渲染 footer 元素', () => {
    const wrapper = mount(Card, { slots: { default: '正文' } })
    expect(wrapper.find('footer').exists()).toBe(false)
  })
})

describe('Tooltip', () => {
  it('渲染 role=tooltip 并把 id 交给作用域插槽', () => {
    const wrapper = mount(Tooltip, {
      props: { text: '快捷键 ⌘K' },
      slots: { default: '<button type="button">搜索</button>' },
    })
    const bubble = wrapper.find('[role="tooltip"]')
    expect(bubble.exists()).toBe(true)
    expect(bubble.text()).toBe('快捷键 ⌘K')
    expect(bubble.attributes('id')).toBeTruthy()
  })

  it('disabled 时不渲染气泡', () => {
    const wrapper = mount(Tooltip, { props: { text: '提示', disabled: true } })
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false)
  })
})

describe('Modal', () => {
  const mountModal = (props: { open: boolean; title?: string }) =>
    mount(Modal, {
      props,
      slots: { default: '内容' },
      global: { stubs: { teleport: true, IconX: true } },
    })

  it('open=false 时不渲染对话框', () => {
    expect(mountModal({ open: false }).find('[role="dialog"]').exists()).toBe(false)
  })

  it('open=true 时渲染 aria-modal 与标题关联', () => {
    const wrapper = mountModal({ open: true, title: '确认出汤' })
    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    const labelledBy = dialog.attributes('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(wrapper.find(`#${labelledBy}`).text()).toBe('确认出汤')
  })

  it('ESC 派发 close，closeOnEsc=false 时不派发', async () => {
    const wrapper = mountModal({ open: true })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(wrapper.emitted('close')).toHaveLength(1)

    const locked = mount(Modal, {
      props: { open: true, closeOnEsc: false },
      global: { stubs: { teleport: true, IconX: true } },
    })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(locked.emitted('close')).toBeUndefined()
  })
})

describe('Tabs', () => {
  const tabs = [
    { key: 'brew', label: '冲泡' },
    { key: 'taste', label: '品鉴' },
  ]

  it('渲染全部标签并标记当前项', () => {
    const wrapper = mount(Tabs, { props: { tabs, active: 'brew' } })
    const items = wrapper.findAll('[role="tab"]')
    expect(items).toHaveLength(2)
    expect(items[0].attributes('aria-selected')).toBe('true')
    expect(items[1].attributes('aria-selected')).toBe('false')
  })

  it('点击派发 update:active 与 change', async () => {
    const wrapper = mount(Tabs, { props: { tabs, active: 'brew' } })
    await wrapper.findAll('[role="tab"]')[1].trigger('click')
    expect(wrapper.emitted('update:active')?.[0]).toEqual(['taste'])
    expect(wrapper.emitted('change')?.[0]).toEqual(['taste'])
  })

  it('点击当前项不重复派发', async () => {
    const wrapper = mount(Tabs, { props: { tabs, active: 'brew' } })
    await wrapper.findAll('[role="tab"]')[0].trigger('click')
    expect(wrapper.emitted('update:active')).toBeUndefined()
  })

  it('方向键切换到下一项', async () => {
    const wrapper = mount(Tabs, { props: { tabs, active: 'brew' } })
    await wrapper.findAll('[role="tab"]')[0].trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:active')?.[0]).toEqual(['taste'])
  })
})
