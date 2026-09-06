/**
 * 茶园系统类型定义
 * 种茶→养茶→采茶→制茶→喝茶 完整闭环
 */

/** 生长阶段 */
export type GrowthStage = 'sprout' | 'seedling' | 'growing' | 'mature' | 'recovery'

/** 植物状态 */
export type PlantStatus = 'growing' | 'mature' | 'harvested' | 'dead'

/** 一株已种植的茶树 */
export interface PlantedTea {
  id?: number
  regionId: string
  teaId: string
  plantedAt: string // ISO 时间戳
  lastWateredAt: string // ISO 时间戳
  waterLevel: number // 0-100 土壤湿度
  pruned: boolean // 是否定型修剪过
  status: PlantStatus
  harvestedAt?: string // 上次采摘时间
  harvestCount: number // 已采摘次数
}

/** 茶园地区 */
export interface GardenRegion {
  id: string
  name: string
  shortName: string
  teaArea: string // 所属茶区（江南/华南/西南/江北）
  description: string
  climate: string // 气候特点
  teaIds: string[] // 可种茶种 ID 列表
  backgroundImage: string // 真实茶山场景图
  accentColor: string // 主题色
}

/** 生长阶段信息 */
export interface GrowthStageInfo {
  stage: GrowthStage
  label: string
  dayRange: [number, number] // 第几天到第几天
  description: string
  needsPruning: boolean // 是否需要修剪
}
