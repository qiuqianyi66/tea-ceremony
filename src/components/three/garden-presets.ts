/**
 * garden-presets.ts — 四茶园可视化预设（同一 3D 引擎，不同山场气质）
 *
 * 依据（古籍 + 地理常识，不编造）：
 * - 杭州龙井：丘陵梯田翠绿茶垄、红壤、云雾缭绕 ——《茶经》"砾壤"红壤 + 梯田
 * - 武夷岩茶：丹霞地貌、三十六峰九十九岩、茶树生于岩缝砾土 —— 山高石多、雾多
 * - 云南勐海：世界茶树原产地、热带雨林、千年古树参天 —— 高大深色、树多茶稀
 * - 福鼎白茶：太姥山下东海之滨、山海云雾 —— 开阔丘陵、明净
 *
 * 每个字段都有视觉含义；terrain/tea-field/ecology/weather 按 preset 装配。
 */

export interface GardenPreset {
  id: string
  name: string
  /** 山脊骨架 */
  ridgeZ: number // 山脊线基准 z（负 = 相机前方南坡）
  ridgeWander: number // 山脊蜿蜒幅度
  ridgeHeight: number // 主山体高度（m）
  sigmaSouth: number // 南坡 σ（大=宽缓茶园坡）
  sigmaNorth: number // 北坡 σ（小=陡峭阴林坡）
  centralRadius: number // 中央茶山隆起半径
  centralBump: number // 中央隆起强度
  edgeFadeAt: number // 边缘渐消起点（r>此值开始压平）
  edgeFadeRate: number // 边缘渐消斜率
  /** 土壤色带 tint（×贴图） */
  tintLoess: [number, number, number]
  tintGravel: [number, number, number]
  tintRock: [number, number, number]
  /** 天空渐变（Equirect，天顶→地平线） */
  sky: [string, string, string, string, string]
  /** 雾 */
  fogColor: string
  fogDensity: number
  /** 太阳 */
  sunColor: string
  sunIntensity: number
  /** 雨天 */
  rainColor: string
  rainFogColor: string
  /** 茶行 */
  rowZStart: number
  rowZEnd: number
  rowXRange: number
  rowSpacing: number
  bushSpacing: number
  bushBase: [number, number, number] // 蓬面绿 base（RGB 0-1）
  bushScaleMin: number // 蓬面球缩放范围
  bushScaleMax: number
  /** 遮阴树 */
  shadeTreeCount: number
  shadeScale: number // 树整体尺度系数
  /** 装饰密度 */
  rockCount: number
  grassCount: number
  flowerCount: number
}

export const DEFAULT_PRESET: GardenPreset = {
  id: 'hangzhou',
  name: '杭州·西湖龙井茶园',
  ridgeZ: -12,
  ridgeWander: 14,
  ridgeHeight: 15,
  sigmaSouth: 18,
  sigmaNorth: 13,
  centralRadius: 64,
  centralBump: 4.5,
  edgeFadeAt: 105,
  edgeFadeRate: 0.12,
  tintLoess: [1.0, 0.95, 0.8],
  tintGravel: [1.14, 0.9, 0.72],
  tintRock: [1.0, 0.97, 0.94],
  sky: ['#1f56ad', '#3f86cf', '#86bae4', '#c6e0f2', '#eef6fc'],
  fogColor: '#b9cfdf',
  fogDensity: 0.006,
  sunColor: '#fff5e0',
  sunIntensity: 2.5,
  rainColor: '#9fb2c6',
  rainFogColor: '#8fa6ba',
  rowZStart: -26.5,
  rowZEnd: -41.5,
  rowXRange: 44,
  rowSpacing: 1.5,
  bushSpacing: 1.2,
  bushBase: [0.36, 0.55, 0.23],
  bushScaleMin: 0.85,
  bushScaleMax: 1.2,
  shadeTreeCount: 12,
  shadeScale: 1.15,
  rockCount: 45,
  grassCount: 420,
  flowerCount: 90,
}

export const GARDEN_PRESETS: Record<string, GardenPreset> = {
  hangzhou: {
    id: 'hangzhou',
    name: '杭州·西湖龙井茶园',
    ridgeZ: -12,
    ridgeWander: 14,
    ridgeHeight: 15,
    sigmaSouth: 18,
    sigmaNorth: 13,
    centralRadius: 64,
    centralBump: 4.5,
    edgeFadeAt: 105,
    edgeFadeRate: 0.12,
    tintLoess: [1.0, 0.95, 0.8],
    tintGravel: [1.14, 0.9, 0.72],
    tintRock: [1.0, 0.97, 0.94],
    sky: ['#1f56ad', '#3f86cf', '#86bae4', '#c6e0f2', '#eef6fc'],
    fogColor: '#b9cfdf',
    fogDensity: 0.006,
    sunColor: '#fff5e0',
    sunIntensity: 2.5,
    rainColor: '#9fb2c6',
    rainFogColor: '#8fa6ba',
    rowZStart: -26.5,
    rowZEnd: -41.5,
    rowXRange: 44,
    rowSpacing: 1.5,
    bushSpacing: 1.2,
    bushBase: [0.36, 0.55, 0.23],
    bushScaleMin: 0.85,
    bushScaleMax: 1.2,
    shadeTreeCount: 12,
    shadeScale: 1.15,
    rockCount: 45,
    grassCount: 420,
    flowerCount: 90,
  },
  wuyishan: {
    id: 'wuyishan',
    name: '武夷山·岩茶茶园',
    ridgeZ: -8,
    ridgeWander: 22,
    ridgeHeight: 19,
    sigmaSouth: 14,
    sigmaNorth: 10,
    centralRadius: 48,
    centralBump: 3.2,
    edgeFadeAt: 102,
    edgeFadeRate: 0.16,
    tintLoess: [1.08, 0.84, 0.6], // 谷底涧水带偏褐
    tintGravel: [1.42, 0.72, 0.48], // 丹霞红岩（茶园土赤红，《东溪试茶录》"厥土赤坟"）
    tintRock: [1.38, 0.68, 0.5], // 上部裸露岩壁赤红
    sky: ['#2260b8', '#448fd6', '#8fc0e8', '#cfe6f4', '#f4f8fc'],
    fogColor: '#aebfd2',
    fogDensity: 0.0075, // 峡谷薄雾：藏住峰脚、露出峰头（200 多天云雾）
    sunColor: '#fff0d8',
    sunIntensity: 2.3,
    rainColor: '#8fa3ba',
    rainFogColor: '#7d93ab',
    rowZStart: -16,
    rowZEnd: -30, // 岩壁砾土带（更贴山体）
    rowXRange: 34,
    rowSpacing: 2.0, // 岩茶行距疏（岩缝丛植）
    bushSpacing: 1.6,
    bushBase: [0.22, 0.4, 0.2], // 岩茶墨绿（厚叶深绿，与赤壁对比）
    bushScaleMin: 0.7,
    bushScaleMax: 1.05,
    shadeTreeCount: 8,
    shadeScale: 1.15,
    rockCount: 85, // 丹霞多岩石
    grassCount: 260,
    flowerCount: 45,
  },
  yunnan: {
    id: 'yunnan',
    name: '云南·勐海古茶园',
    ridgeZ: -10,
    ridgeWander: 18,
    ridgeHeight: 20,
    sigmaSouth: 20,
    sigmaNorth: 14,
    centralRadius: 72,
    centralBump: 5.2,
    edgeFadeAt: 110,
    edgeFadeRate: 0.1,
    tintLoess: [0.82, 0.74, 0.58], // 热带腐殖黑土
    tintGravel: [0.9, 0.72, 0.55],
    tintRock: [0.95, 0.88, 0.8],
    sky: ['#1c4f9e', '#3a7cc8', '#82b4e0', '#c2dcf0', '#eaf4fb'],
    fogColor: '#a8bfc8',
    fogDensity: 0.01, // 雨林晨雾
    sunColor: '#fff3da',
    sunIntensity: 2.2,
    rainColor: '#96a9bd',
    rainFogColor: '#7f95a6',
    rowZStart: -22,
    rowZEnd: -40,
    rowXRange: 40,
    rowSpacing: 2.4, // 古茶树大丛稀疏
    bushSpacing: 2.0,
    bushBase: [0.3, 0.5, 0.19], // 大叶种深绿
    bushScaleMin: 0.9,
    bushScaleMax: 1.45, // 古树蓬更大
    shadeTreeCount: 26, // 雨林遮阴树多
    shadeScale: 1.6, // 树更参天
    rockCount: 30,
    grassCount: 220,
    flowerCount: 40,
  },
  fuding: {
    id: 'fuding',
    name: '福建·福鼎白茶园',
    ridgeZ: -14,
    ridgeWander: 12,
    ridgeHeight: 11,
    sigmaSouth: 22,
    sigmaNorth: 16,
    centralRadius: 76,
    centralBump: 3.0,
    edgeFadeAt: 108,
    edgeFadeRate: 0.1,
    tintLoess: [1.05, 0.98, 0.82], // 海风黄棕壤
    tintGravel: [1.08, 0.96, 0.78],
    tintRock: [1.04, 0.99, 0.93],
    sky: ['#1d5db4', '#3e86d0', '#8abae6', '#cde3f2', '#f6fafd'], // 明净通透
    fogColor: '#c2d4e0',
    fogDensity: 0.004, // 开阔少雾
    sunColor: '#fff6e6',
    sunIntensity: 2.7,
    rainColor: '#a8b8c8',
    rainFogColor: '#93a9ba',
    rowZStart: -20,
    rowZEnd: -38,
    rowXRange: 50, // 开阔茶行更宽
    rowSpacing: 1.5,
    bushSpacing: 1.2,
    bushBase: [0.42, 0.6, 0.27], // 白茶蓬偏亮绿
    bushScaleMin: 0.85,
    bushScaleMax: 1.2,
    shadeTreeCount: 10,
    shadeScale: 1.05,
    rockCount: 28,
    grassCount: 480, // 开阔草坡
    flowerCount: 150, // 山海野花多
  },
}

/** 取预设（未知 id 回退杭州龙井） */
export function getGardenPreset(id?: string): GardenPreset {
  return (id ? GARDEN_PRESETS[id] : undefined) ?? DEFAULT_PRESET
}





