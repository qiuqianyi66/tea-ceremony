/**
 * 冲泡相关类型定义
 */

/** 冲泡阶段 — 工夫茶完整流程 */
export enum BrewPhase {
  IDLE = 'idle',           // 初始：选择茶器 + 设定温度
  HEATING = 'heating',     // 烧水中（温度可调）
  WARMING = 'warming',     // 温杯（热水入器→倒出）
  RINSING = 'rinsing',     // 醒茶（洗茶：注水→5s→倒出）
  READY = 'ready',         // 准备就绪
  STEEPING = 'steeping',   // 浸泡中（计时）
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
