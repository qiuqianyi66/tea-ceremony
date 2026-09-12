/**
 * brewSkins — 冲泡页环境皮肤（数据驱动，新增皮肤只加这里）
 *
 * 视觉参照：
 *  - mountain-dawn 山顶日出：低角度晨光，云海山尖
 *  - lake-rain 湖畔烟雨：冷灰蓝湖面+露营灯+雨丝
 *  - indoor-storm 室内雨夜：深棕夜色+一盏悬暖灯+窗外雨+热气氤氲
 *
 * 每个皮肤只描述「氛围参数」，不描述器物——茶席器物共用，差异全在
 * 背景 / 灯光方向与色温 / 雾 / 雨 / 蒸汽浓度。背景统一为程序化天幕渐变。
 */

export type BrewSkinId = 'mountain-dawn' | 'lake-rain' | 'indoor-storm'

export interface BrewSkin {
  id: BrewSkinId
  label: string
  /** 程序化天幕上下色 */
  gradientTop: string
  gradientBottom: string
  fogColor: string
  fogNear: number
  fogFar: number
  ambient: { color: string; intensity: number }
  key: { position: [number, number, number]; color: string; intensity: number }
  rim: { color: string; intensity: number }
  /** toneMappingExposure */
  exposure: number
  /** 是否下雨（湖畔烟雨 / 室内雨夜窗外雨） */
  rain: boolean
  /** 蒸汽浓度倍率（室内雨夜热气氤氲用 1.6~1.8，默认 1） */
  steamBoost?: number
}

export const BREW_SKINS: Record<BrewSkinId, BrewSkin> = {
  'mountain-dawn': {
    id: 'mountain-dawn',
    label: '山顶日出',
    // 天幕：顶部浅青蓝 → 地平线橙金
    gradientTop: '#cfd8dc',
    gradientBottom: '#e8a566',
    fogColor: '#c8a882',
    fogNear: 7.0,
    fogFar: 11.0,
    ambient: { color: '#e8c9a0', intensity: 0.3 },
    // 低角度朝阳：左前方，略抬高避免在盖碗白瓷上打出爆白高光
    key: { position: [-3.5, 2.1, 3], color: '#ffb060', intensity: 1.1 },
    rim: { color: '#8a6a4a', intensity: 0.5 },
    exposure: 1.0,
    rain: false,
    steamBoost: 1,
  },
  'lake-rain': {
    id: 'lake-rain',
    label: '湖畔烟雨',
    // 天幕：灰蓝阴天，上深下浅
    gradientTop: '#3d4a55',
    gradientBottom: '#6b7a85',
    fogColor: '#46545f',
    fogNear: 6.5,
    fogFar: 11.0,
    ambient: { color: '#c8d4dc', intensity: 0.35 },
    // 右前方一盏暖露营灯
    key: { position: [3.5, 2.2, 2.5], color: '#ffd9a0', intensity: 1.2 },
    rim: { color: '#5a6a78', intensity: 0.4 },
    exposure: 0.95,
    rain: true,
    steamBoost: 1,
  },
  'indoor-storm': {
    id: 'indoor-storm',
    label: '室内雨夜',
    // 天幕：窗外深夜棕，室内暗棕
    gradientTop: '#16100c',
    gradientBottom: '#2e2016',
    fogColor: '#241812',
    fogNear: 6.5,
    fogFar: 11.0,
    ambient: { color: '#5a3a22', intensity: 0.22 },
    // 头顶一盏悬暖灯（吊灯感），前方偏上，打亮茶席
    key: { position: [0, 3.2, 2.2], color: '#ff9a4a', intensity: 1.4 },
    // 窗外漏进一丝冷蓝，压出暖灯对比
    rim: { color: '#2e3e4a', intensity: 0.3 },
    exposure: 0.9,
    rain: true,
    // 热气氤氲但不炸白（配合蒸汽颜色压暗）
    steamBoost: 1.2,
  },
}

export const BREW_SKIN_LIST: BrewSkin[] = [
  BREW_SKINS['lake-rain'],
  BREW_SKINS['mountain-dawn'],
  BREW_SKINS['indoor-storm'],
]
