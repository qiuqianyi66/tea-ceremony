import { describe, it, expect } from 'vitest'
import { ref, type Ref } from 'vue'
import { useBrewAnimation, damp, lerp, smoothstep } from '@/composables/useBrewAnimation'
import { BrewPhase } from '@/types/brewing'

/** 按 60fps 推进若干秒，返回 composable 实例 */
function run(
  seconds: number,
  phase: Ref<BrewPhase>,
  isPouringOut: Ref<boolean>,
  drag?: Ref<number>,
) {
  const state = drag
    ? useBrewAnimation(phase, isPouringOut, drag)
    : useBrewAnimation(phase, isPouringOut)
  for (let i = 0; i < Math.round(seconds * 60); i += 1) state.update(1 / 60)
  return state
}

describe('math helpers', () => {
  it('lerp / smoothstep / damp 保持边界与帧率无关', () => {
    expect(lerp(0, 10, 0.5)).toBe(5)
    expect(smoothstep(0)).toBe(0)
    expect(smoothstep(1)).toBe(1)
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 6)
    // 两段 0.5s 与一段 1s 的结果一致，证明阻尼与步长无关
    const one = damp(0, 1, 3, 1)
    const two = damp(damp(0, 1, 3, 0.5), 1, 3, 0.5)
    expect(Math.abs(one - two)).toBeLessThan(1e-6)
  })
})

describe('useBrewAnimation 状态映射', () => {
  it('READY 阶段不自动注水，等用户拖拽', () => {
    const state = run(1, ref(BrewPhase.READY), ref(false))
    expect(state.pourWater.value).toBe(0)
    expect(state.addLeaves.value).toBe(0)
    expect(state.steep.value).toBe(0)
  })

  it('拖拽 override 在 READY 阶段接管注水进度', () => {
    const state = run(3, ref(BrewPhase.READY), ref(false), ref(0.6))
    expect(state.pourWater.value).toBeCloseTo(0.6, 2)
  })

  it('STEEPING 阶段注水、投茶、闷泡同时到位', () => {
    const state = run(3, ref(BrewPhase.STEEPING), ref(false))
    expect(state.pourWater.value).toBeGreaterThan(0.95)
    expect(state.addLeaves.value).toBeGreaterThan(0.95)
    expect(state.steep.value).toBeGreaterThan(0.95)
  })

  it('出汤中只推进 pourOut，不动分茶与品饮', () => {
    const state = run(2, ref(BrewPhase.DONE), ref(true))
    expect(state.pourOut.value).toBeGreaterThan(0.95)
    expect(state.fairnessPour.value).toBeLessThan(0.05)
    expect(state.drink.value).toBeLessThan(0.05)
  })

  it('出汤结束后分茶接管，品饮在分茶过 70% 之后才开始', () => {
    const phase = ref(BrewPhase.DONE)
    const pouringOut = ref(false)
    const state = useBrewAnimation(phase, pouringOut)

    // 0.3s：分茶过半，品饮还没起
    for (let i = 0; i < 18; i += 1) state.update(1 / 60)
    expect(state.fairnessPour.value).toBeGreaterThan(0.4)
    expect(state.fairnessPour.value).toBeLessThan(0.7)
    expect(state.drink.value).toBeLessThan(0.05)

    // 再 2s：分茶到底，品饮跟上，出汤已回落
    for (let i = 0; i < 120; i += 1) state.update(1 / 60)
    expect(state.fairnessPour.value).toBeGreaterThan(0.95)
    expect(state.drink.value).toBeGreaterThan(0.5)
    expect(state.pourOut.value).toBeLessThan(0.05)
  })
})
