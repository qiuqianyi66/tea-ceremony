/**
 * DESIGN_SPEC 色彩令牌常量（供 JS / Canvas 等无法使用 CSS 变量的场景）
 * 值与 DESIGN_SPEC.md「一、色彩令牌」一一对应；新增色值先入 DESIGN_SPEC 再入此表。
 * 禁止在此表外散落裸色值（见 docs/frontend-engineering-spec.md「维护性」）。
 */
export const colorTokens = {
  /** 页面背景 */
  cream: '#FAF6F0',
  /** 正文 */
  ink: '#3D3225',
  /** 深色背景/文字 */
  inkDeep: '#1C1C1C',
  /** 强调色/高亮（唯一强调色） */
  teaGold: '#9E8050',
  /** 按钮/标题 */
  wood: '#5D4E37',
  /** 次要文字 */
  woodLight: '#7E6A55',
  /** 自然相关 */
  bamboo: '#6B7D5A',
  /** 印章/成就/警示 */
  cinnabar: '#A33B2E',
  /** AI 茶灵相关 */
  indigoDeep: '#36454F',
  /** 卡片背景 */
  paper: '#F5F0E8',
  /** 暗色茶席变体（brew-dark / taste-dark）：与 CSS -dark 令牌同值，供 JS/图表消费 */
  creamDark: '#1a120a',
  /** 暗色卡片背景 */
  paperDark: '#2a1f15',
  /** 暗色正文（暖白） */
  inkDark: '#f5e6c8',
  /** 暗色强调（暗色场景唯一强调色） */
  teaGoldDark: '#c9a96e',
  /** 暗色主文字/标题 */
  woodDark: '#e8d5b0',
  /** 暗色次要文字 */
  woodLightDark: '#b8a080',
} as const

export type ColorToken = keyof typeof colorTokens
