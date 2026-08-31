/**
 * 茶叶类型定义 — 与后端 Pydantic TeaResponse 保持一致
 * 六大茶类：绿茶、白茶、黄茶、青茶（乌龙）、红茶、黑茶
 */

/** 茶类枚举 */
export enum TeaType {
  GREEN = '绿茶',
  WHITE = '白茶',
  YELLOW = '黄茶',
  OOLONG = '青茶',
  RED = '红茶',
  DARK = '黑茶',
}

/**
 * 茶叶数据结构。
 *
 * 页面和本地品茶流程使用稳定的 camelCase + 字符串业务 ID。
 * 后端 DTO 在 services/api.ts 中单独转换，避免把两套数据模型混在一个接口里。
 */
export interface Tea {
  id: string
  name: string
  type: TeaType
  origin: string
  altitude?: string
  process?: string
  bestTemp: number
  bestTime: number
  infusions: number
  flavor: string[]
  story: string
  description: string
  dryTeaColor: string
  soupColorMin: string
  soupColorMax: string

  /** API 关联信息，页面可按需使用 */
  regionId?: number
  processId?: number
  historicalPeriod?: string
  waterRequirement?: string
}

/** 茶叶展示选项 */
export interface TeaFilter {
  type: TeaType | null
  keyword: string
}
