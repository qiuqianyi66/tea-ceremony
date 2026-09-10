/**
 * 品鉴评分算法
 */

import type { TasteDimensions, TastingRecord } from '@/types/tasting'
import type { TeaWare } from '@/types/teaware'

/** 工艺系数分解（可解释：温度 / 时间 / 茶器 / 水 各因子） */
export interface ProcessFactorParts {
  tempDiff: number
  tempFactor: number
  timeDiff: number
  timeFactor: number
  baseFactor: number
  wareName: string | null
  wareBonus: number | null
  compensation: number
  waterFactor: number
  factor: number
}

/** 计算工艺系数各组成因子（calculateProcessFactor 与 explainProcessFactor 共用）。 */
function computeProcessParts(
  actualTemp: number,
  bestTemp: number,
  actualTime: number,
  bestTime: number,
  teaWare?: TeaWare | null,
  waterFactor: number = 1.0,
): ProcessFactorParts {
  // 温度偏差系数：偏差越大，扣分越多
  const tempDiff = Math.abs(actualTemp - bestTemp)
  const tempFactor = Math.max(0, 1 - tempDiff / 30)

  // 时间偏差系数：允许±50%的偏差
  const timeDiff = Math.abs(actualTime - bestTime)
  const maxTimeDev = Math.max(bestTime * 0.5, 1)  // 防止除零
  const timeFactor = Math.max(0, 1 - timeDiff / maxTimeDev)

  // 基础工艺系数 = 温度 + 时间 取平均
  const baseFactor = (tempFactor + timeFactor) / 2

  // 茶器匹配加成：工艺偏差越大、茶器越合用时补偿越多（弥补操作偏差）
  let wareName: string | null = null
  let wareBonus: number | null = null
  let compensation = 0
  if (teaWare) {
    wareName = teaWare.name
    wareBonus = (teaWare.bonus.heatRetention + teaWare.bonus.visual) / 2
    compensation = Math.max(0, (1 - baseFactor) * (wareBonus - 0.8) * 0.5)
  }

  const factor = Math.min(1, (baseFactor + compensation) * waterFactor)
  return { tempDiff, tempFactor, timeDiff, timeFactor, baseFactor, wareName, wareBonus, compensation, waterFactor, factor }
}

/** 计算工艺系数 */
export function calculateProcessFactor(
  actualTemp: number,
  bestTemp: number,
  actualTime: number,
  bestTime: number,
  teaWare?: TeaWare | null,
  waterFactor: number = 1.0,
): number {
  return computeProcessParts(actualTemp, bestTemp, actualTime, bestTime, teaWare, waterFactor).factor
}

/** 工艺系数分解（供 UI 展示"为什么是这个系数"）。 */
export function explainProcessFactor(
  actualTemp: number,
  bestTemp: number,
  actualTime: number,
  bestTime: number,
  teaWare?: TeaWare | null,
  waterFactor: number = 1.0,
): ProcessFactorParts {
  return computeProcessParts(actualTemp, bestTemp, actualTime, bestTime, teaWare, waterFactor)
}

/** 计算综合评分（1-10分） */
export function calculateOverallScore(
  dimensions: TasteDimensions,
  processFactor: number,
): number {
  const { bitterness, sweetness, aftertaste, body, aroma, rhyme, shape, mind } = dimensions

  // 苦涩度是反向维度：对绝大多数茶而言越不苦涩越好，用 (6 - bitterness) 转成"适口度"
  // （bitterness=1 → 5 分，bitterness=5 → 1 分），其余七维为正向。
  const palatability = 6 - bitterness

  // 八维平均分（1-5）
  const baseScore = (palatability + sweetness + aftertaste + body + aroma + rhyme + shape + mind) / 8

  // 归一化到 1-10 分
  const normalizedScore = baseScore * 2

  // 乘以工艺系数
  const finalScore = normalizedScore * processFactor

  // 保留一位小数，范围 1-10
  return Math.round(Math.max(1, Math.min(10, finalScore)) * 10) / 10
}

/** 获取评分等级（色值在 cream #FAF6F0 上对比度 ≥ 4.5:1，达标见 P0-3 审计） */
export function getScoreLevel(score: number): { text: string; color: string } {
  if (score >= 9) return { text: '完美', color: '#8A6A3A' }
  if (score >= 7.5) return { text: '优秀', color: '#4A7C59' }
  if (score >= 6) return { text: '良好', color: '#5D4E37' }
  if (score >= 4) return { text: '一般', color: '#7E6A55' }
  return { text: '需改进', color: '#6E6259' }
}

/** 生成记录 ID */
export function generateRecordId(): string {
  return `record_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
