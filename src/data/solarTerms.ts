/**
 * 二十四节气数据
 * 每个节气包含：名称、时间范围、推荐茶类、文化描述、相关诗词
 */

export interface SolarTerm {
  id: string
  name: string
  month: number      // 公历月份（1-12）
  day: number        // 公历日期（约）
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  teaTypes: string[] // 推荐茶类
  description: string
  poem: string       // 相关诗词
  poet: string       // 诗人
}

export const SOLAR_TERMS: SolarTerm[] = [
  {
    id: 'lichun',
    name: '立春',
    month: 2, day: 4,
    season: 'spring',
    teaTypes: ['花茶', '白茶'],
    description: '立春为二十四节气之首，万物复苏。此时宜饮花茶助阳气升发，白牡丹清雅甘润，最合春日意境。',
    poem: '春日春盘细生菜，忽忆两京梅发时。',
    poet: '杜甫',
  },
  {
    id: 'yushui',
    name: '雨水',
    month: 2, day: 19,
    season: 'spring',
    teaTypes: ['绿茶', '白茶'],
    description: '雨水润物细无声。此时春茶尚未采摘，宜饮去岁的绿茶或陈年白茶，感受时光沉淀的滋味。',
    poem: '天街小雨润如酥，草色遥看近却无。',
    poet: '韩愈',
  },
  {
    id: 'jingzhe',
    name: '惊蛰',
    month: 3, day: 6,
    season: 'spring',
    teaTypes: ['绿茶'],
    description: '惊蛰春雷动，万物长。此时江南茶区开始采摘首批春茶，明前龙井的鲜爽最为珍贵。',
    poem: '微雨众卉新，一雷惊蛰始。',
    poet: '韦应物',
  },
  {
    id: 'chunfen',
    name: '春分',
    month: 3, day: 21,
    season: 'spring',
    teaTypes: ['绿茶', '白茶'],
    description: '春分昼夜均，春茶正当时。明前茶采摘进入高峰，碧螺春、龙井皆为此季上品。',
    poem: '春分雨脚落声微，柳岸斜风带客归。',
    poet: '徐铉',
  },
  {
    id: 'qingming',
    name: '清明',
    month: 4, day: 5,
    season: 'spring',
    teaTypes: ['绿茶'],
    description: '清明时节雨纷纷。此时"明前茶"为一年中品质最高的绿茶，芽叶细嫩、香气清雅。',
    poem: '寒食春过半，晴日映花红。且将新火试新茶，诗酒趁年华。',
    poet: '苏轼',
  },
  {
    id: 'liuxia',
    name: '立夏',
    month: 5, day: 6,
    season: 'summer',
    teaTypes: ['绿茶', '白茶'],
    description: '立夏入夏，暑气初生。宜饮清新鲜爽的绿茶或白茶，以清凉解热。',
    poem: '四时天气促相催，一夜薰风带暑来。',
    poet: '赵友直',
  },
  {
    id: 'mangzhong',
    name: '芒种',
    month: 6, day: 6,
    season: 'summer',
    teaTypes: ['绿茶', '青茶'],
    description: '芒种梅雨时节，空气潮湿。宜饮半发酵的乌龙茶，既能解暑又不过分寒凉。',
    poem: '时雨及芒种，四野皆插秧。',
    poet: '陆游',
  },
  {
    id: 'xiazhi',
    name: '夏至',
    month: 6, day: 21,
    season: 'summer',
    teaTypes: ['绿茶', '白茶', '花茶'],
    description: '夏至日最长，暑气最盛。白茶性凉，清甜解暑；茉莉花茶香气芬芳，令人心旷神怡。',
    poem: '夏至一阴生，稍稍夕漏迟。',
    poet: '白居易',
  },
  {
    id: 'dashu',
    name: '大暑',
    month: 7, day: 23,
    season: 'summer',
    teaTypes: ['绿茶', '白茶', '花茶'],
    description: '大暑一年中最热之时。白茶清雅、绿茶鲜爽，皆可消暑。老白茶更可煮饮，祛湿解暑。',
    poem: '赤日几时过，清风无处寻。经书聊枕籍，瓜李漫浮沉。',
    poet: '曾几',
  },
  {
    id: 'liqiu',
    name: '立秋',
    month: 8, day: 7,
    season: 'autumn',
    teaTypes: ['青茶', '红茶'],
    description: '立秋暑去凉来。乌龙茶性平味甘，最宜秋日品饮。铁观音的兰花香、大红袍的岩韵，皆为秋日上选。',
    poem: '自古逢秋悲寂寥，我言秋日胜春朝。',
    poet: '刘禹锡',
  },
  {
    id: 'bailu',
    name: '白露',
    month: 9, day: 8,
    season: 'autumn',
    teaTypes: ['青茶', '红茶'],
    description: '白露秋意渐浓。"春茶苦，夏茶涩，要好喝，秋白露"——此时采制的秋乌龙茶香气高锐，尤为珍贵。',
    poem: '露从今夜白，月是故乡明。',
    poet: '杜甫',
  },
  {
    id: 'qiufen',
    name: '秋分',
    month: 9, day: 23,
    season: 'autumn',
    teaTypes: ['青茶', '红茶'],
    description: '秋分昼夜平分，天高气爽。一壶武夷岩茶，三四好友，品茶论道，最是人间清欢。',
    poem: '自古逢秋悲寂寥，我言秋日胜春朝。晴空一鹤排云上，便引诗情到碧霄。',
    poet: '刘禹锡',
  },
  {
    id: 'hanlu',
    name: '寒露',
    month: 10, day: 8,
    season: 'autumn',
    teaTypes: ['红茶', '黑茶'],
    description: '寒露气温骤降。红茶性温，金骏眉蜜香甘甜；熟普洱醇厚暖胃，皆为御寒上品。',
    poem: '波漂菰米沉云黑，露冷莲房坠粉红。',
    poet: '杜甫',
  },
  {
    id: 'shuangjiang',
    name: '霜降',
    month: 10, day: 23,
    season: 'autumn',
    teaTypes: ['红茶', '黑茶'],
    description: '霜降天寒露重。宜饮全发酵的红茶或陈年黑茶，暖身驱寒，尤为适宜。',
    poem: '霜降碧天静，秋事促西风。',
    poet: '叶梦得',
  },
  {
    id: 'lidong',
    name: '立冬',
    month: 11, day: 7,
    season: 'winter',
    teaTypes: ['黑茶', '红茶'],
    description: '立冬水始冰，地始冻。普洱熟茶醇厚暖胃，陈年六堡茶祛湿养气，为冬日必备。',
    poem: '冻笔新诗懒写，寒炉美酒时温。醉看墨花月白，恍疑雪满前村。',
    poet: '李白',
  },
  {
    id: 'xiaoxue',
    name: '小雪',
    month: 11, day: 22,
    season: 'winter',
    teaTypes: ['黑茶', '红茶'],
    description: '小雪初雪未盛。围炉煮茶，陈年普洱在壶中翻滚，枣香药香弥漫，冬日之乐莫过于此。',
    poem: '绿蚁新醅酒，红泥小火炉。晚来天欲雪，能饮一杯无？',
    poet: '白居易',
  },
  {
    id: 'daxue',
    name: '大雪',
    month: 12, day: 7,
    season: 'winter',
    teaTypes: ['黑茶', '红茶'],
    description: '大雪至此雪盛。窗外飞雪，室内煮茶，一壶老茶头或陈年茯砖，暖身更暖心。',
    poem: '千山鸟飞绝，万径人踪灭。孤舟蓑笠翁，独钓寒江雪。',
    poet: '柳宗元',
  },
  {
    id: 'dongzhi',
    name: '冬至',
    month: 12, day: 22,
    season: 'winter',
    teaTypes: ['黑茶', '红茶'],
    description: '冬至一阳生。此时最宜一壶陈年普洱，围炉夜话，静待春归。',
    poem: '邯郸驿里逢冬至，抱膝灯前影伴身。想得家中夜深坐，还应说着远行人。',
    poet: '白居易',
  },
  {
    id: 'xiaohan',
    name: '小寒',
    month: 1, day: 6,
    season: 'winter',
    teaTypes: ['红茶', '黑茶'],
    description: '小寒二阳至，最是严寒时。红茶暖胃、熟普驱寒，一杯热茶在手，足以抵御严冬。',
    poem: '已是悬崖百丈冰，犹有花枝俏。',
    poet: '毛泽东',
  },
  {
    id: 'dahan',
    name: '大寒',
    month: 1, day: 20,
    season: 'winter',
    teaTypes: ['红茶', '黑茶'],
    description: '大寒二十四节气之终。熬过最冷的时节，便是立春。一壶陈年红茶或安化黑茶，温暖收尾，静待新春。',
    poem: '造物无言却有情，每于寒尽觉春生。',
    poet: '张维屏',
  },
]

/** 获取当前节气 */
export function getCurrentSolarTerm(): SolarTerm {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  // 按日期查找当前节气
  for (let i = SOLAR_TERMS.length - 1; i >= 0; i--) {
    const term = SOLAR_TERMS[i]!
    if (month > term.month || (month === term.month && day >= term.day)) {
      return term
    }
  }
  return SOLAR_TERMS[SOLAR_TERMS.length - 1]!
}

/** 获取季节名称 */
export function getSeasonName(season: string): string {
  const names: Record<string, string> = {
    spring: '春', summer: '夏', autumn: '秋', winter: '冬',
  }
  return names[season] || ''
}
