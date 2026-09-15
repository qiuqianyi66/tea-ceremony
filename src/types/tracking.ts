/**
 * 行为埋点类型（T2.2）
 * 隐私约束：只存结构化事件（行为名 + 分类 + 结果），绝不存用户输入等自由文本。
 */

/** 事件分类 */
export type TrackCategory = 'ai' | 'tasting' | 'nav' | 'system'

/** 结果态：成功 / 降级（规则兜底）/ 失败 */
export type TrackResult = 'success' | 'degraded' | 'failed'

/** IndexedDB 中的一条事件记录 */
export interface TrackEvent {
  id?: number
  category: TrackCategory
  event: string
  label?: string
  result?: TrackResult
  ts: number
}

/** track() 入参 */
export interface TrackInput {
  category: TrackCategory
  event: string
  label?: string
  result?: TrackResult
}
