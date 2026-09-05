import { ref, type Ref } from 'vue'
import { BrewPhase } from '@/types/brewing'

/**
 * 泡茶动画状态
 * 每个字段是 0~1 的 progress，表示对应动画阶段的完成度
 */
export interface BrewAnimationState {
  /** 入水动画（水壶倾斜+水流+盖碗液面上升） */
  pourWater: Ref<number>
  /** 放茶动画（茶则移入+茶叶粒子下落） */
  addLeaves: Ref<number>
  /** 闷泡动画（盖碗盖子盖上+蒸汽增强） */
  steep: Ref<number>
  /** 出汤动画（盖碗倾斜+茶汤流入公道杯） */
  pourOut: Ref<number>
  /** 分茶动画（公道杯倾斜+茶汤均匀分到品茗杯） */
  fairnessPour: Ref<number>
  /** 喝茶动画（品茗杯端起+液面减少） */
  drink: Ref<number>
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** smoothstep 缓动（开始和结束平滑，避免突兀） */
export function smoothstep(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

/** 阻尼逼近（帧速率无关，lambda 越大逼近越快） */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

/**
 * 泡茶动画 composable
 * 基于 BrewPhase 状态机和 isPouringOut 标志，计算各动画阶段的 progress
 * 每帧调用 update(dt) 更新 progress
 *
 * 动画时序（DONE 阶段）：
 * 1. isPouringOut=true → pourOut（盖碗→公道杯出汤）
 * 2. isPouringOut=false → fairnessPour（公道杯→品茗杯分茶）
 * 3. fairnessPour>0.7 → drink（品茗杯端起喝茶）
 *
 * @param phase 当前冲泡阶段（响应式 Ref）
 * @param isPouringOut 是否正在出汤（响应式 Ref）
 */
export function useBrewAnimation(
  phase: Ref<BrewPhase>,
  isPouringOut: Ref<boolean>,
): BrewAnimationState & { update: (dt: number) => void } {
  const pourWater = ref(0)
  const addLeaves = ref(0)
  const steep = ref(0)
  const pourOut = ref(0)
  const fairnessPour = ref(0)
  const drink = ref(0)

  // 每个动画的目标值（由 phase 和 isPouringOut 决定）
  const targets = {
    pourWater: 0,
    addLeaves: 0,
    steep: 0,
    pourOut: 0,
    fairnessPour: 0,
    drink: 0,
  }

  function updateTargets(): void {
    const p = phase.value
    // 入水：温杯/醒茶/准备/浸泡阶段均有水
    targets.pourWater = [
      BrewPhase.WARMING,
      BrewPhase.RINSING,
      BrewPhase.READY,
      BrewPhase.STEEPING,
    ].includes(p)
      ? 1
      : 0
    // 放茶：醒茶/浸泡阶段有茶叶
    targets.addLeaves = [BrewPhase.RINSING, BrewPhase.STEEPING].includes(p) ? 1 : 0
    // 闷泡：浸泡阶段盖子盖上
    targets.steep = p === BrewPhase.STEEPING ? 1 : 0
    // 出汤：isPouringOut 为 true 时（盖碗→公道杯）
    targets.pourOut = isPouringOut.value ? 1 : 0
    // 分茶：DONE 阶段且出汤完成后（公道杯→品茗杯）
    targets.fairnessPour = p === BrewPhase.DONE && !isPouringOut.value ? 1 : 0
    // 喝茶：分茶完成 70% 后触发（在 update 中动态判断）
  }

  /**
   * 每帧更新动画 progress
   * 使用阻尼逼近目标值，帧速率无关
   * @param dt 距上一帧的时间（秒）
   */
  function update(dt: number): void {
    updateTargets()
    // lambda 值决定逼近速度：3≈0.5s 达 95%，4≈0.4s，1.5≈1s，1≈1.5s
    pourWater.value = damp(pourWater.value, targets.pourWater, 3, dt)
    addLeaves.value = damp(addLeaves.value, targets.addLeaves, 2, dt)
    steep.value = damp(steep.value, targets.steep, 1.5, dt)
    pourOut.value = damp(pourOut.value, targets.pourOut, 4, dt)
    fairnessPour.value = damp(fairnessPour.value, targets.fairnessPour, 2.5, dt)
    // 喝茶：分茶完成 70% 后才触发，确保先分茶再喝茶
    const drinkTarget =
      targets.fairnessPour === 1 && fairnessPour.value > 0.7 ? 1 : 0
    drink.value = damp(drink.value, drinkTarget, 1, dt)
  }

  return { pourWater, addLeaves, steep, pourOut, fairnessPour, drink, update }
}
