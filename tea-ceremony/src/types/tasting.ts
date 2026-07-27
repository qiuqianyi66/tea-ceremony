/**
 * 品鉴相关类型定义
 */

/** 品鉴维度（1-5分） */
export interface TasteDimensions {
  bitterness: number   // 苦涩度
  sweetness: number    // 甜度
  aftertaste: number   // 回甘
  body: number         // 醇厚度
  aroma: number        // 香气持久度
}

/** 品鉴记录 */
export interface TastingRecord {
  id: string
  teaId: string
  teaName: string
  date: string               // ISO 日期
  brewTemp: number           // 冲泡时水温
  brewTime: number           // 浸泡时间
  infusions: number          // 第几泡
  dimensions: TasteDimensions
  overallScore: number       // 综合评分（1-10）
  processFactor: number      // 工艺系数（0-1）
}

/** 成就定义 */
export interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: string
}

/** 成就解锁条件 */
export type AchievementCondition =
  | { type: 'first_brew' }                              // 首次冲泡
  | { type: 'all_types'; count: number }                // 品鉴所有茶类
  | { type: 'temp_accuracy'; count: number }            // 温控大师
  | { type: 'total_brews'; count: number }              // 累计冲泡
  | { type: 'high_score'; count: number }               // 高分品鉴
