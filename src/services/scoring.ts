/**
 * 品鉴评分算法
 */

import type { TasteDimensions } from '@/types/tasting'
import { TeaType } from '@/types/tea'
import type { TeaWare } from '@/types/teaware'

/** 八维口感权重（顺序同 calculateOverallScore 的维度数组）。 */
export type DimensionWeights = Record<
  'bitterness' | 'sweetness' | 'aftertaste' | 'body' | 'aroma' | 'rhyme' | 'shape' | 'mind',
  number
>

/** 等权基线（未指定茶类时行为与旧版完全一致）。 */
const EQUAL_WEIGHTS: DimensionWeights = {
  bitterness: 1,
  sweetness: 1,
  aftertaste: 1,
  body: 1,
  aroma: 1,
  rhyme: 1,
  shape: 1,
  mind: 1,
}

/**
 * 六大茶类八维权重表（v1 启发式，待 live 品鉴数据校准；见 ADR-027）。
 * 权重按加权平均归一化，相对值即重要性：
 * - bitterness 权重作用于反向后的"适口度"：绿茶微苦涩属正常（权重低），红茶要求顺滑（权重高）；
 * - 青茶以香、回甘为王；黑茶以醇厚度为主；绿茶重鲜爽高扬；白茶重清甜毫香。
 */
export const TEA_CATEGORY_WEIGHTS: Partial<Record<TeaType, DimensionWeights>> = {
  [TeaType.GREEN]: {
    bitterness: 0.7,
    sweetness: 1.2,
    aftertaste: 1.2,
    body: 0.9,
    aroma: 1.5,
    rhyme: 1.0,
    shape: 0.9,
    mind: 1.0,
  },
  [TeaType.WHITE]: {
    bitterness: 0.6,
    sweetness: 1.3,
    aftertaste: 1.0,
    body: 1.0,
    aroma: 1.2,
    rhyme: 1.0,
    shape: 0.9,
    mind: 1.0,
  },
  [TeaType.YELLOW]: {
    bitterness: 0.8,
    sweetness: 1.2,
    aftertaste: 1.0,
    body: 1.2,
    aroma: 1.0,
    rhyme: 1.0,
    shape: 0.8,
    mind: 1.0,
  },
  [TeaType.OOLONG]: {
    bitterness: 0.8,
    sweetness: 1.0,
    aftertaste: 1.4,
    body: 0.9,
    aroma: 1.6,
    rhyme: 1.2,
    shape: 0.8,
    mind: 1.0,
  },
  [TeaType.RED]: {
    bitterness: 1.2,
    sweetness: 1.5,
    aftertaste: 1.2,
    body: 1.3,
    aroma: 1.0,
    rhyme: 1.0,
    shape: 0.8,
    mind: 1.0,
  },
  [TeaType.DARK]: {
    bitterness: 0.5,
    sweetness: 0.8,
    aftertaste: 1.2,
    body: 1.5,
    aroma: 1.2,
    rhyme: 1.0,
    shape: 0.8,
    mind: 1.0,
  },
}

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
  const maxTimeDev = Math.max(bestTime * 0.5, 1) // 防止除零
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
  return {
    tempDiff,
    tempFactor,
    timeDiff,
    timeFactor,
    baseFactor,
    wareName,
    wareBonus,
    compensation,
    waterFactor,
    factor,
  }
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
  return computeProcessParts(actualTemp, bestTemp, actualTime, bestTime, teaWare, waterFactor)
    .factor
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

/** 计算综合评分（1-10分；可选茶类权重，缺省等权——向后兼容，见 ADR-027） */
export function calculateOverallScore(
  dimensions: TasteDimensions,
  processFactor: number,
  weights?: DimensionWeights,
): number {
  const { bitterness, sweetness, aftertaste, body, aroma, rhyme, shape, mind } = dimensions

  // 苦涩度是反向维度：对绝大多数茶而言越不苦涩越好，用 (6 - bitterness) 转成"适口度"
  // （bitterness=1 → 5 分，bitterness=5 → 1 分），其余七维为正向。
  const palatability = 6 - bitterness

  const w = weights ?? EQUAL_WEIGHTS
  const keys = [
    'bitterness',
    'sweetness',
    'aftertaste',
    'body',
    'aroma',
    'rhyme',
    'shape',
    'mind',
  ] as const
  const dimVals = [palatability, sweetness, aftertaste, body, aroma, rhyme, shape, mind]

  // 八维加权平均（1-5；权重归一化，等权即旧版行为）
  let weightedSum = 0
  let totalWeight = 0
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!
    weightedSum += dimVals[i]! * w[k]
    totalWeight += w[k]
  }
  const baseScore = weightedSum / totalWeight

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
