/**
 * 常量配置
 */

/** 主题配色 */
export const THEME = {
  wood: '#5D4E37',
  woodLight: '#8B7355',
  teaGold: '#9E8050',
  paper: '#F5F0E8',
  ink: '#3D3225',
  cream: '#FAF6F0',
} as const

/** 默认冲泡参数 */
export const DEFAULT_BREW = {
  teaWeight: 3,           // 默认投茶量（克）
  weightRange: { min: 1, max: 8 },
  waterVolume: 150,       // 默认水量（毫升）
} as const

/** 天下名水系数 */
export const WATER_TYPES = [
  { id: 'purified', name: '纯净水', factor: 1.0, description: '中性，适合大多数茶类' },
  { id: 'spring', name: '山泉水', factor: 1.05, description: '清冽甘甜，提升茶汤鲜活度' },
  { id: 'mineral', name: '矿泉水', factor: 1.02, description: '富含矿物质，增强茶汤醇厚感' },
] as const

/** 茶修等级 — 茶修六境 */
export const TEA_LEVELS = [
  { id: 'shicha', name: '识茶', minXp: 0, icon: '🌱', desc: '认识一片叶子的来处' },
  { id: 'zhiqi', name: '知器', minXp: 150, icon: '🫖', desc: '了解茶器与茶性' },
  { id: 'dongshui', name: '懂水', minXp: 400, icon: '💧', desc: '知水者得茶之真味' },
  { id: 'wuxiang', name: '悟香', minXp: 800, icon: '🌸', desc: '闻香识茶，心随香静' },
  { id: 'pinjing', name: '品境', minXp: 1500, icon: '🍃', desc: '品茶入境，天人合一' },
  { id: 'chaxin', name: '茶心', minXp: 3000, icon: '🧘', desc: '茶即心，心即茶' },
] as const

export const ACHIEVEMENTS = [
  {
    id: 'first_brew',
    name: '初识茶道',
    description: '完成第一次完整冲泡',
    icon: '🍵',
  },
  {
    id: 'all_types',
    name: '六大茶类',
    description: '各茶类至少品鉴一款',
    icon: '🌈',
  },
  {
    id: 'temp_accuracy',
    name: '温控大师',
    description: '连续5次温度偏差<5°C',
    icon: '🎯',
  },
  {
    id: 'total_brews_20',
    name: '品鉴达人',
    description: '累计品鉴20款茶',
    icon: '🏆',
  },
  {
    id: 'high_score',
    name: '满分品鉴',
    description: '获得一次9分以上评分',
    icon: '⭐',
  },
] as const
