/**
 * 冲泡相关类型定义
 */

/** 冲泡阶段 */
export enum BrewPhase {
  IDLE = 'idle',           // 空闲
  HEATING = 'heating',     // 烧水中
  READY = 'ready',         // 水已沸
  STEEPING = 'steeping',   // 浸泡中
  DONE = 'done',           // 已出汤
}

/** 冲泡状态 */
export interface BrewState {
  phase: BrewPhase
  currentTemp: number       // 当前水温
  targetTemp: number        // 目标水温
  steepTime: number         // 当前浸泡时间（秒）
  infusionsDone: number     // 已冲泡次数
  teaWeight: number         // 投茶量（克）
}

/** 冲泡配置（来自茶叶数据） */
export interface BrewConfig {
  bestTemp: number
  bestTime: number
  infusions: number
}

/** 冲泡动作 */
export type BrewAction =
  | { type: 'HEAT_START' }
  | { type: 'HEAT_STOP' }
  | { type: 'HEAT_COMPLETE' }
  | { type: 'STEEP_START' }
  | { type: 'STEEP_TICK' }
  | { type: 'STEEP_STOP' }
  | { type: 'NEXT_INFUSION' }
  | { type: 'RESET' }
