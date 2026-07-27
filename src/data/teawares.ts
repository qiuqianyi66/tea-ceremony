/**
 * 茶器具数据
 * 基于真实茶道资料
 */

import { TeaWareType, type TeaWare } from '@/types/teaware'

export const teawares: TeaWare[] = [
  // ============ 基础款（初始即可用）============
  {
    id: 'gaiwan',
    name: '白瓷盖碗',
    type: TeaWareType.GAIWAN,
    capacity: 150,
    material: '白瓷（釉面）',
    description: '瓷器釉面光滑不吸味，薄壁散热适中，出汤速度可控。适合冲泡大多数茶类，尤其高香细嫩茶。',
    story: '盖碗始于明代，又称"三才碗"——盖为天、托为地、碗为人。鲁迅在《喝茶》中写道："喝好茶，是要用盖碗的。"',
    bonus: { speed: 1.2, heatRetention: 0.8, visual: 1.0 },
    recommended: ['绿茶', '白茶', '青茶', '黄茶'],
    rarity: 'common',
    unlockHint: '初始解锁',
  },
  {
    id: 'yixing',
    name: '紫砂壶',
    type: TeaWareType.YIXING,
    capacity: 150,
    material: '宜兴紫砂（双气孔，无釉）',
    description: '紫砂双气孔结构保温性极佳，会吸附茶味形成"茶山"（建议一壶一茶）。适合普洱、红茶、焙火乌龙。',
    story: '紫砂壶产于江苏宜兴，明代供春创制。其"透气不透水"的独特结构，使其成为茶道至宝。',
    bonus: { speed: 0.8, heatRetention: 1.3, visual: 0.6 },
    recommended: ['黑茶', '红茶', '青茶'],
    rarity: 'common',
    unlockHint: '初始解锁',
  },
  {
    id: 'glass',
    name: '玻璃杯',
    type: TeaWareType.GLASS,
    capacity: 300,
    material: '高硼硅玻璃',
    description: '玻璃完全无孔不吸味、导热快散热最快。透明度高，可全程欣赏茶叶舒展与"茶舞"，视觉体验最佳。',
    story: '玻璃茶具虽不如瓷器紫砂历史悠久，但现代高硼硅玻璃的耐热性能使其成为观赏绿茶茶舞的理想之选。',
    bonus: { speed: 1.0, heatRetention: 0.6, visual: 1.4 },
    recommended: ['绿茶', '白茶', '黄茶'],
    rarity: 'common',
    unlockHint: '初始解锁',
  },

  // ============ 进阶款（需解锁）============
  {
    id: 'celadon',
    name: '青瓷盖碗',
    type: TeaWareType.GAIWAN,
    capacity: 130,
    material: '龙泉青瓷（釉面）',
    description: '龙泉青瓷以"青如玉、明如镜、声如磬"著称。釉色温润，与绿茶茶汤相映成趣，视觉享受极佳。',
    story: '龙泉青瓷始于三国，盛于南宋。弟窑白胎厚釉、哥窑紫口铁足，各具风韵。',
    bonus: { speed: 1.1, heatRetention: 0.9, visual: 1.3 },
    recommended: ['绿茶', '白茶', '黄茶'],
    rarity: 'uncommon',
    unlockHint: '品鉴 3 款绿茶后解锁',
  },
  {
    id: 'duanning',
    name: '段泥石瓢壶',
    type: TeaWareType.YIXING,
    capacity: 180,
    material: '宜兴段泥（紫砂）',
    description: '段泥紫砂色泽米黄，砂质感强。石瓢造型稳重大方，壶口宽大便于投放条索型茶叶。',
    story: '石瓢壶为紫砂经典器型之一，源自清代陈曼生设计的"曼生十八式"，一改紫砂繁复之风，开文人壶先河。',
    bonus: { speed: 0.9, heatRetention: 1.1, visual: 0.9 },
    recommended: ['青茶', '红茶', '黑茶'],
    rarity: 'uncommon',
    unlockHint: '累计品鉴 5 次后解锁',
  },
  {
    id: 'jianzhan',
    name: '建盏天目杯',
    type: TeaWareType.GLASS,
    capacity: 80,
    material: '建阳铁胎（黑釉）',
    description: '建盏为宋代点茶神器，铁胎厚实保温极佳。兔毫/油滴釉面在茶汤映照下流光溢彩，极具观赏性。',
    story: '建盏产自福建建阳，宋徽宗在《大观茶论》中推崇备至。"兔毫连盏烹云液，能解红颜入醉乡。"',
    bonus: { speed: 0.7, heatRetention: 1.4, visual: 1.2 },
    recommended: ['黑茶', '红茶'],
    rarity: 'rare',
    unlockHint: '连续 3 次评分 8 分以上解锁',
  },
]

/** 根据 ID 获取茶器 */
export function getTeaWareById(id: string): TeaWare | undefined {
  return teawares.find(w => w.id === id)
}

/** 根据茶器类型筛选 */
export function getTeaWaresByType(type: TeaWareType): TeaWare[] {
  return teawares.filter(w => w.type === type)
}

/** 获取某茶类推荐的茶器 */
export function getTeaWaresForTeaType(teaTypeName: string): TeaWare[] {
  return teawares.filter(w => w.recommended.includes(teaTypeName))
}
