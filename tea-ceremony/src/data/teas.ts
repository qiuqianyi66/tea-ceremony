/**
 * 茶叶数据库
 * 六大茶类，每类1-2款代表性茶叶
 */

import { TeaType, type Tea } from '@/types/tea'

export const teas: Tea[] = [
  // ============ 绿茶 ============
  {
    id: 'longjing',
    name: '西湖龙井',
    type: TeaType.GREEN,
    origin: '浙江杭州',
    altitude: '300-800米',
    process: '炒青',
    bestTemp: 80,
    bestTime: 60,
    infusions: 3,
    flavor: ['豆香', '栗香', '鲜爽'],
    story: '乾隆下江南时御赐"西湖龙井"之名，色绿、香郁、味甘、形美四绝闻名天下。',
    description: '中国十大名茶之首，扁平光滑，色泽翠绿，香气清高。',
    dryTeaColor: '#4A7C59',
    soupColorMin: '#F5E6A3',
    soupColorMax: '#C9B458',
  },
  {
    id: 'biluochun',
    name: '碧螺春',
    type: TeaType.GREEN,
    origin: '江苏苏州',
    altitude: '100-300米',
    process: '炒青',
    bestTemp: 75,
    bestTime: 45,
    infusions: 3,
    flavor: ['花果香', '清甜', '鲜嫩'],
    story: '原名"吓煞人香"，康熙嫌名不雅，赐名"碧螺春"。',
    description: '产于太湖洞庭山，茶叶卷曲如螺，银绿隐翠。',
    dryTeaColor: '#6B8E23',
    soupColorMin: '#E8F5E9',
    soupColorMax: '#A5D6A7',
  },

  // ============ 白茶 ============
  {
    id: 'baimudan',
    name: '白牡丹',
    type: TeaType.WHITE,
    origin: '福建福鼎',
    altitude: '600-1000米',
    process: '萎凋+干燥',
    bestTemp: 90,
    bestTime: 90,
    infusions: 5,
    flavor: ['毫香', '花香', '清甜'],
    story: '白茶制作工艺最简，不炒不揉，自然萎凋，保留了茶叶最原始的风味。',
    description: '白茶中的极品，芽头肥壮，满披白毫，如银似雪。',
    dryTeaColor: '#8B9A6B',
    soupColorMin: '#F0E68C',
    soupColorMax: '#DAA520',
  },

  // ============ 黄茶 ============
  {
    id: 'junshanyinzhen',
    name: '君山银针',
    type: TeaType.YELLOW,
    origin: '湖南岳阳',
    altitude: '100-200米',
    process: '闷黄',
    bestTemp: 85,
    bestTime: 75,
    infusions: 4,
    flavor: ['甜香', '玉米香', '醇和'],
    story: '产于洞庭湖君山岛，三起三落的冲泡奇观，被誉为"茶中极品"。',
    description: '黄茶中的珍品，芽头肥壮，满披白毫，冲泡时三起三落。',
    dryTeaColor: '#C9A96E',
    soupColorMin: '#FFE4B5',
    soupColorMax: '#F4A460',
  },

  // ============ 青茶（乌龙） ============
  {
    id: 'tieguanyin',
    name: '铁观音',
    type: TeaType.OOLONG,
    origin: '福建安溪',
    altitude: '300-1000米',
    process: '做青+烘焙',
    bestTemp: 95,
    bestTime: 45,
    infusions: 7,
    flavor: ['兰花香', '果香', '回甘'],
    story: '铁观音既是茶名又是品种名，独特的"观音韵"让无数茶客为之倾倒。',
    description: '青茶（乌龙茶）代表，半发酵茶，兼具绿茶的清香和红茶的醇厚。',
    dryTeaColor: '#5C4033',
    soupColorMin: '#FFD700',
    soupColorMax: '#DAA520',
  },

  // ============ 红茶 ============
  {
    id: 'jinjunmei',
    name: '金骏眉',
    type: TeaType.RED,
    origin: '福建武夷山',
    altitude: '1000-1500米',
    process: '全发酵',
    bestTemp: 90,
    bestTime: 50,
    infusions: 6,
    flavor: ['蜜香', '薯香', '甘甜'],
    story: '2005年创制的顶级红茶，每500g金骏眉需6-8万颗芽尖。',
    description: '正山小种的顶级品种，金黄色的茶芽，蜜香浓郁。',
    dryTeaColor: '#8B4513',
    soupColorMin: '#FFB347',
    soupColorMax: '#CD853F',
  },

  // ============ 黑茶 ============
  {
    id: 'puer',
    name: '老班章普洱',
    type: TeaType.DARK,
    origin: '云南勐海',
    altitude: '1200-1800米',
    process: '后发酵',
    bestTemp: 100,
    bestTime: 30,
    infusions: 15,
    flavor: ['陈香', '木质香', '回甘'],
    story: '老班章被誉为"普洱之王"，茶气霸道，回甘持久，越陈越香。',
    description: '普洱茶中的王者，条索肥壮，茶气刚烈，回甘持久。',
    dryTeaColor: '#3D2B1F',
    soupColorMin: '#8B4513',
    soupColorMax: '#654321',
  },
]

/** 根据 ID 查找茶叶 */
export function getTeaById(id: string): Tea | undefined {
  return teas.find(tea => tea.id === id)
}

/** 根据茶类筛选 */
export function getTeasByType(type: TeaType): Tea[] {
  return teas.filter(tea => tea.type === type)
}

/** 获取所有茶类 */
export function getAllTypes(): TeaType[] {
  return Object.values(TeaType)
}

/** 插值计算茶汤颜色 */
export function interpolateColor(c1: string, c2: string, t: number): string {
  const r1 = parseInt(c1.slice(1, 3), 16)
  const g1 = parseInt(c1.slice(3, 5), 16)
  const b1 = parseInt(c1.slice(5, 7), 16)
  const r2 = parseInt(c2.slice(1, 3), 16)
  const g2 = parseInt(c2.slice(3, 5), 16)
  const b2 = parseInt(c2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/** 根据浸泡时间计算茶汤颜色 */
export function getSoupColor(tea: Tea, steepTime: number): string {
  const maxSteep = tea.bestTime * 2
  const progress = Math.min(steepTime / maxSteep, 1)
  return interpolateColor(tea.soupColorMin, tea.soupColorMax, progress)
}
