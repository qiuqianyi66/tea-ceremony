/**
 * 茶器类型定义
 * 盖碗、紫砂壶、玻璃杯
 */

/** 茶器类型枚举 */
export enum TeaWareType {
  GAIWAN = '盖碗',
  YIXING = '紫砂壶',
  GLASS = '玻璃杯',
}

/** 茶器加成属性 */
export interface TeaWareBonus {
  speed: number       // 出汤速度加成（影响浸泡效率）
  heatRetention: number // 保温系数（影响温度保持）
  visual: number      // 观赏系数（影响观色评分）
}

/** 茶器数据结构 */
export interface TeaWare {
  id: string
  name: string
  type: TeaWareType
  capacity: number         // 容量 ml
  material: string         // 材质
  description: string      // 描述
  story: string            // 文化故事
  bonus: TeaWareBonus
  recommended: string[]    // 推荐茶类名
  rarity: 'common' | 'uncommon' | 'rare'  // 稀有度
  unlockHint: string       // 解锁条件提示
}
