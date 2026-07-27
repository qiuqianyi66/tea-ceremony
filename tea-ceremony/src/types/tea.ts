/**
 * 茶叶类型定义
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

/** 茶叶数据结构 */
export interface Tea {
  id: string
  name: string
  type: TeaType
  origin: string
  altitude: string
  process: string          // 工艺
  bestTemp: number         // 最佳水温 °C
  bestTime: number         // 最佳浸泡时间 秒
  infusions: number        // 可冲泡次数
  flavor: string[]         // 风味标签
  story: string            // 茶叶故事
  description: string      // 简介
  dryTeaColor: string      // 干茶颜色
  soupColorMin: string     // 茶汤颜色（淡）
  soupColorMax: string     // 茶汤颜色（浓）
}

/** 茶叶展示选项 */
export interface TeaFilter {
  type: TeaType | null
  keyword: string
}
