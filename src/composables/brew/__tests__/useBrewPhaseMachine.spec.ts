// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { getTeaById } from '@/data/teas'
import { useBrewStore } from '@/stores/brew'
import { useTeaStore } from '@/stores/tea'
import { BrewPhase } from '@/types/brewing'
import { FAIRNESS_DWELL_MS, useBrewPhaseMachine } from '@/composables/brew/useBrewPhaseMachine'

// 状态机只碰音频、路由与两个 store；音频与路由在 jsdom 里没有实现，按最小形状替身。
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/composables/useAudio', () => ({
  useAudio: () => ({
    playPourWater: vi.fn(),
    playPourTea: vi.fn(),
    playSuccess: vi.fn(),
  }),
}))

function setup(infusions: number) {
  // 先选茶再建状态机：selectTea 会换掉 brewStore 的 state 对象，
  // 状态机在创建时缓存了 state 引用，顺序反了会读到替换前的那份。
  const teaStore = useTeaStore()
  const tea = getTeaById('longjing')
  expect(tea).toBeTruthy()
  teaStore.selectTea({ ...tea!, infusions })
  return useBrewPhaseMachine()
}

describe('useBrewPhaseMachine · 出汤后的停留', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    push.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('出汤 1.8s 结束仍停在 DONE，分茶/品饮演完才进下一泡', () => {
    const machine = setup(3)
    const brew = useBrewStore()
    brew.startSteeping()

    machine.startSteeping()
    vi.advanceTimersByTime(3000)
    machine.handleMainAction() // 点「出汤」

    expect(machine.isPouringOut.value).toBe(true)
    vi.advanceTimersByTime(1800)
    expect(machine.isPouringOut.value).toBe(false)
    // 关键断言：出汤结束不等于立刻换泡，DONE 段要留住
    expect(brew.state.phase).toBe(BrewPhase.DONE)
    expect(brew.state.infusionsDone).toBe(1)

    vi.advanceTimersByTime(FAIRNESS_DWELL_MS - 1)
    expect(brew.state.phase).toBe(BrewPhase.DONE)

    vi.advanceTimersByTime(1)
    expect(brew.state.phase).toBe(BrewPhase.STEEPING)
    expect(brew.state.infusionsDone).toBe(1)
  })

  it('停留期内用户点「继续冲泡」，只推进一次', () => {
    const machine = setup(3)
    const brew = useBrewStore()
    brew.startSteeping()

    machine.startSteeping()
    vi.advanceTimersByTime(3000)
    machine.handleMainAction() // 出汤
    vi.advanceTimersByTime(1800) // 出汤结束，进入停留

    machine.handleMainAction() // 用户点「继续冲泡」
    expect(brew.state.phase).toBe(BrewPhase.STEEPING)

    // 原本的定时推进已被撤掉：再走完停留时长不应有第二次切换
    const steepTime = brew.state.steepTime
    vi.advanceTimersByTime(FAIRNESS_DWELL_MS + 500)
    expect(brew.state.phase).toBe(BrewPhase.STEEPING)
    expect(brew.state.steepTime).toBeGreaterThanOrEqual(steepTime)
  })

  it('最后一泡停留结束后浮一句收尾再进品鉴页', () => {
    const machine = setup(1)
    const brew = useBrewStore()
    brew.startSteeping()

    machine.startSteeping()
    vi.advanceTimersByTime(3000)
    machine.handleMainAction() // 出汤
    vi.advanceTimersByTime(1800 + FAIRNESS_DWELL_MS)

    expect(machine.showFinale.value).toBe(true)
    expect(machine.finaleLine.value).not.toBe('')
    expect(brew.state.phase).toBe(BrewPhase.DONE)

    vi.advanceTimersByTime(2000)
    expect(machine.showFinale.value).toBe(false)
    expect(push).toHaveBeenCalledWith('/taste')
  })
})
