/**
 * 常量配置
 */

/** 主题配色 */
export const THEME = {
  wood: '#5D4E37',
  woodLight: '#8B7355',
  teaGold: '#C9A96E',
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

/** 成就定义 */
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
