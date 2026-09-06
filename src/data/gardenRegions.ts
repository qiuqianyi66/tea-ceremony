/**
 * 茶园地区数据
 * 4 个起步地区，真实茶山场景，后续可扩展
 */
import type { GardenRegion } from '@/types/garden'

export const gardenRegions: GardenRegion[] = [
  {
    id: 'hangzhou',
    name: '杭州·西湖龙井茶园',
    shortName: '杭州西湖',
    teaArea: '江南茶区',
    description: '西子湖畔，狮峰山下，千年贡茶核心产区。丘陵梯田翠绿茶垄，云雾缭绕，以"色绿、香郁、味甘、形美"四绝闻名。',
    climate: '亚热带季风，温和湿润，年均温16℃，年降水1500mm',
    teaIds: ['longjing', 'shifeng_lj', 'anji_bai', 'guzhu_zs', 'huangshanmaofeng'],
    backgroundImage: '/garden/hangzhou.jpg',
    accentColor: '#4A7C59',
  },
  {
    id: 'wuyishan',
    name: '武夷山·岩茶茶园',
    shortName: '武夷山',
    teaArea: '华南茶区',
    description: '丹霞地貌，三十六峰九十九岩，茶树生长于岩壁缝隙砾土中。"看青做青、看天做青"，岩骨花香，联合国人类非物质文化遗产。',
    climate: '亚热带季风，年均温18℃，年降水2000mm，200多天云雾',
    teaIds: ['dahongpao', 'shuixian', 'rougui', 'qilan', 'lapsangsouchong', 'jinjunmei'],
    backgroundImage: '/garden/wuyishan.jpg',
    accentColor: '#8B4513',
  },
  {
    id: 'yunnan',
    name: '云南·勐海古茶园',
    shortName: '云南勐海',
    teaArea: '西南茶区',
    description: '世界茶树原产地中心，原始森林中千年古茶树参天。大叶种茶，低纬度高海拔，"冬无严寒夏无酷暑"，普洱茶发祥地，茶马古道源头。',
    climate: '亚热带高原季风，年均温20℃，年降水1300mm，低纬度高海拔',
    teaIds: ['puer', 'sheng_pu', 'shou_pu', 'jingmai_sh', 'dianhong', 'yunnan_gh'],
    backgroundImage: '/garden/yunnan.jpg',
    accentColor: '#3D2B1F',
  },
  {
    id: 'fuding',
    name: '福建·福鼎白茶园',
    shortName: '福建福鼎',
    teaArea: '华南茶区',
    description: '太姥山下，东海之滨，白茶发源地。"世界白茶在中国，中国白茶在福鼎"。不炒不揉，自然萎凋，日晒干燥，一年茶三年药七年宝。',
    climate: '亚热带海洋性季风，年均温19℃，年降水1700mm，山海云雾',
    teaIds: ['baihaoyinzhen', 'baimudan', 'shoumei', 'zhenhe_bh'],
    backgroundImage: '/garden/fuding.jpg',
    accentColor: '#9AAD8A',
  },
]

export function getRegionById(id: string): GardenRegion | undefined {
  return gardenRegions.find(r => r.id === id)
}
