/**
 * 品鉴评分算法
 */

import type { TasteDimensions, TastingRecord } from '@/types/tasting'

/** 计算工艺系数 */
export function calculateProcessFactor(
  actualTemp: number,
  bestTemp: number,
  actualTime: number,
  bestTime: number,
): number {
  // 温度偏差系数：偏差越大，扣分越多
  const tempDiff = Math.abs(actualTemp - bestTemp)
  const tempFactor = Math.max(0, 1 - tempDiff / 30)

  // 时间偏差系数：允许±50%的偏差
  const timeDiff = Math.abs(actualTime - bestTime)
  const timeFactor = Math.max(0, 1 - timeDiff / (bestTime * 0.5))

  // 取平均
  return (tempFactor + timeFactor) / 2
}

/** 计算综合评分（1-10分） */
export function calculateOverallScore(
  dimensions: TasteDimensions,
  processFactor: number,
): number {
  const { bitterness, sweetness, aftertaste, body, aroma } = dimensions

  // 五维平均分（1-5）
  const baseScore = (bitterness + sweetness + aftertaste + body + aroma) / 5

  // 归一化到 1-10 分
  const normalizedScore = baseScore * 2

  // 乘以工艺系数
  const finalScore = normalizedScore * processFactor

  // 保留一位小数，范围 1-10
  return Math.round(Math.max(1, Math.min(10, finalScore)) * 10) / 10
}

/** 获取评分等级 */
export function getScoreLevel(score: number): { text: string; color: string } {
  if (score >= 9) return { text: '完美', color: '#C9A96E' }
  if (score >= 7.5) return { text: '优秀', color: '#4A7C59' }
  if (score >= 6) return { text: '良好', color: '#5D4E37' }
  if (score >= 4) return { text: '一般', color: '#8B7355' }
  return { text: '需改进', color: '#999999' }
}

/** 生成记录 ID */
export function generateRecordId(): string {
  return `record_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
