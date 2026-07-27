/**
 * 种子数据生成脚本
 * 在服务器上运行：node seed-data.js
 * 生成 JSON 数据文件，供 API 服务使用
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// ============ 茶叶数据（结构化文化模型）============

const teas = [
  {
    id: 1, name: '西湖龙井', category: '绿茶',
    origin: { province: '浙江', city: '杭州', mountain: '狮峰山' },
    history: { originTime: '唐代', development: '宋元明清', importantEvents: ['乾隆六下江南四次到访', '亲封十八棵御茶树'] },
    craft: { picking: '明前一芽一叶', process: ['摊放', '杀青', '辉锅'] },
    flavor: ['豆香', '栗香', '鲜爽'],
    tasteProfile: { aroma: '豆香', sweetness: 8, aftertaste: 9 },
    brewing: { temperature: 80, time: '60秒', ware: '玻璃杯或白瓷盖碗' },
    story: '乾隆皇帝六下江南，四次驾临龙井茶区，亲封狮峰山下十八棵茶树为"御茶"。龙井以"色绿、香郁、味甘、形美"四绝闻名天下。',
    description: '中国十大名茶之首，扁平光滑，色泽翠绿。',
    soupColorMin: '#F5E6A3', soupColorMax: '#C9B458',
  },
  {
    id: 2, name: '碧螺春', category: '绿茶',
    origin: { province: '江苏', city: '苏州', mountain: '太湖洞庭山' },
    history: { originTime: '清代', development: '康熙赐名', importantEvents: ['康熙南巡赐名', '茶果间作体系'] },
    craft: { picking: '明前一芽一叶', process: ['杀青', '揉捻', '搓团显毫'] },
    flavor: ['花果香', '清甜', '鲜嫩'],
    tasteProfile: { aroma: '花果香', sweetness: 9, aftertaste: 8 },
    brewing: { temperature: 75, time: '45秒', ware: '玻璃杯' },
    story: '原名"吓煞人香"，康熙南巡太湖品尝后赐名"碧螺春"。茶树与枇杷、杨梅等果树间作，天然花果香。',
    description: '产于太湖洞庭山，卷曲如螺，银绿隐翠。',
    soupColorMin: '#E8F5E9', soupColorMax: '#A5D6A7',
  },
  {
    id: 3, name: '黄山毛峰', category: '绿茶',
    origin: { province: '安徽', city: '黄山', mountain: '黄山山脉' },
    history: { originTime: '清代光绪年间', development: '谢裕大茶庄创制', importantEvents: ['徽州茶商谢裕大创制', '中国十大名茶'] },
    craft: { picking: '明前一芽一叶', process: ['杀青', '揉捻', '烘焙'] },
    flavor: ['兰花香', '清鲜', '甘甜'],
    tasteProfile: { aroma: '兰花香', sweetness: 7, aftertaste: 8 },
    brewing: { temperature: 80, time: '50秒', ware: '白瓷盖碗' },
    story: '创制于清光绪年间，茶树生长在高山云雾中，"晴时早晚遍地雾，阴雨成天满山云"。',
    description: '中国十大名茶之一，白毫披身，汤色清澈。',
    soupColorMin: '#F0F5E8', soupColorMax: '#B8C9A8',
  },
  {
    id: 4, name: '信阳毛尖', category: '绿茶',
    origin: { province: '河南', city: '信阳', mountain: '大别山区' },
    history: { originTime: '宋代', development: '苏东坡盛赞', importantEvents: ['苏东坡赞"淮南茶信阳第一"', '1915年巴拿马金奖'] },
    craft: { picking: '谷雨前', process: ['杀青', '揉捻', '烘焙'] },
    flavor: ['板栗香', '鲜爽', '回甘'],
    tasteProfile: { aroma: '板栗香', sweetness: 7, aftertaste: 8 },
    brewing: { temperature: 75, time: '40秒', ware: '白瓷盖碗' },
    story: '中国十大名茶中唯一的北方茶。苏东坡赞"淮南茶，信阳第一"。1915年获巴拿马金奖。',
    description: '细圆光直，白毫显露，汤色嫩绿。北方茶之王。',
    soupColorMin: '#E8F5E0', soupColorMax: '#A8C99A',
  },
  {
    id: 5, name: '太平猴魁', category: '绿茶',
    origin: { province: '安徽', city: '黄山', mountain: '太平县猴坑' },
    history: { originTime: '1900年', development: '创制于清末', importantEvents: ['"茶中君子"之称', '中国十大名茶'] },
    craft: { picking: '谷雨前后', process: ['杀青', '烘焙'] },
    flavor: ['兰花香', '鲜爽', '醇厚'],
    tasteProfile: { aroma: '兰花香', sweetness: 7, aftertaste: 9 },
    brewing: { temperature: 85, time: '50秒', ware: '高筒玻璃杯' },
    story: '创制于1900年，叶片长达5-7厘米，有"茶中君子"之称。',
    description: '中国最大叶片绿茶，两刀夹一芽，宛如君子。',
    soupColorMin: '#EAF0E0', soupColorMax: '#B8CAA0',
  },
  {
    id: 6, name: '安吉白茶', category: '绿茶',
    origin: { province: '浙江', city: '安吉', mountain: '天目山北麓' },
    history: { originTime: '宋代', development: '白化品种发现', importantEvents: ['安吉白茶品种发现', '氨基酸含量是普通绿茶3倍'] },
    craft: { picking: '明前一芽一叶', process: ['杀青', '烘干'] },
    flavor: ['鲜爽', '甘甜', '滑润'],
    tasteProfile: { aroma: '嫩香', sweetness: 9, aftertaste: 7 },
    brewing: { temperature: 80, time: '45秒', ware: '玻璃杯' },
    story: '安吉白茶是珍稀白化品种，氨基酸含量为普通绿茶3倍，滋味格外鲜爽。',
    description: '白化绿茶，氨基酸之王，鲜爽甘甜。',
    soupColorMin: '#F0F5E8', soupColorMax: '#B8C9A8',
  },
  {
    id: 7, name: '六安瓜片', category: '绿茶',
    origin: { province: '安徽', city: '六安', mountain: '大别山北麓' },
    history: { originTime: '明代', development: '清代贡茶', importantEvents: ['周恩来总理生前最爱', '中国唯一无芽无梗绿茶'] },
    craft: { picking: '谷雨前后', process: ['扳片', '生锅', '熟锅', '拉老火'] },
    flavor: ['栗香', '鲜爽', '醇厚'],
    tasteProfile: { aroma: '栗香', sweetness: 7, aftertaste: 8 },
    brewing: { temperature: 80, time: '45秒', ware: '白瓷盖碗' },
    story: '中国唯一无芽无梗绿茶，由单片叶制成。周恩来总理生前最爱。',
    description: '唯一无芽无梗绿茶，单片叶的制作奇迹。',
    soupColorMin: '#E8F5E0', soupColorMax: '#A8C99A',
  },
  {
    id: 8, name: '蒙顶甘露', category: '绿茶',
    origin: { province: '四川', city: '雅安', mountain: '蒙顶山' },
    history: { originTime: '公元前53年', development: '茶祖吴理真手植', importantEvents: ['中国茶文化发源地', '世界最早人工种茶记录'] },
    craft: { picking: '明前', process: ['杀青', '揉捻', '烘焙'] },
    flavor: ['嫩香', '鲜爽', '回甘'],
    tasteProfile: { aroma: '嫩香', sweetness: 7, aftertaste: 8 },
    brewing: { temperature: 80, time: '50秒', ware: '盖碗' },
    story: '蒙顶山是中国茶文化发源地，公元前53年吴理真在此种茶，被尊为"茶祖"。',
    description: '最古老的名茶，茶祖吴理真手植。',
    soupColorMin: '#F0F5E8', soupColorMax: '#B8C9A8',
  },
  { id: 9, name: '恩施玉露', category: '绿茶', origin: { province: '湖北', city: '恩施', mountain: '武陵山区' },
    history: { originTime: '唐代', development: '蒸青工艺活化石', importantEvents: ['中国唯一传承唐代蒸青工艺', '世界硒都'] },
    craft: { picking: '明前', process: ['蒸青', '揉捻', '烘干'] },
    flavor: ['海苔香', '鲜爽', '清甜'], tasteProfile: { aroma: '海苔香', sweetness: 8, aftertaste: 7 },
    brewing: { temperature: 75, time: '40秒', ware: '玻璃杯' }, story: '中国唯一保留下来的蒸青绿茶工艺，源自唐代。恩施是中国最大富硒茶产区。',
    description: '中国唯一蒸青绿茶，唐代工艺活化石。', soupColorMin: '#E8F5E0', soupColorMax: '#A8C99A' },
  { id: 10, name: '庐山云雾', category: '绿茶', origin: { province: '江西', city: '九江', mountain: '庐山' },
    history: { originTime: '汉代', development: '僧人所种', importantEvents: ['庐山佛教名山茶文化', '中国十大名茶'] },
    craft: { picking: '明前', process: ['杀青', '揉捻', '烘干'] },
    flavor: ['豆香', '鲜爽', '甘甜'], tasteProfile: { aroma: '豆香', sweetness: 7, aftertaste: 8 },
    brewing: { temperature: 80, time: '50秒', ware: '白瓷盖碗' }, story: '庐山云雾为中国十大名茶之一，庐山为佛教名山，僧人种茶历史悠久。',
    description: '十大名茶，庐山僧人千年传承。', soupColorMin: '#F0F5E8', soupColorMax: '#B8C9A8' },
  
  // 白茶
  { id: 11, name: '白毫银针', category: '白茶', origin: { province: '福建', city: '福鼎', mountain: '太姥山' },
    history: { originTime: '清代', development: '白茶之王', importantEvents: ['英国皇室下午茶用茶', '白茶唯一全芽茶'] },
    craft: { picking: '春茶纯芽', process: ['萎凋', '干燥'] }, flavor: ['毫香', '清甜', '鲜爽'],
    tasteProfile: { aroma: '毫香', sweetness: 8, aftertaste: 8 }, brewing: { temperature: 85, time: '120秒', ware: '玻璃杯' },
    story: '白茶之王，全部采用肥壮单芽制成。英国维多利亚女王对其清雅之味赞不绝口。',
    description: '芽头肥壮挺直，满披白毫如银似雪。', soupColorMin: '#F5F0D8', soupColorMax: '#D4C89A' },
  { id: 12, name: '白牡丹', category: '白茶', origin: { province: '福建', city: '福鼎', mountain: '太姥山' },
    history: { originTime: '宋代', development: '茶中美人', importantEvents: ['宋徽宗《大观茶论》论白茶'] },
    craft: { picking: '一芽一二叶', process: ['萎凋', '干燥'] }, flavor: ['毫香', '花香', '清甜'],
    tasteProfile: { aroma: '花香', sweetness: 8, aftertaste: 7 }, brewing: { temperature: 90, time: '90秒', ware: '盖碗' },
    story: '白茶制作工艺最简——不炒不揉，自然萎凋。宋徽宗论白茶"与常茶不同"。',
    description: '一芽一二叶，芽叶连枝如花朵般舒展。', soupColorMin: '#F0E68C', soupColorMax: '#DAA520' },
]

// ============ 产区数据 ============

const regions = [
  { id: 1, name: '西湖茶区', province: '浙江', altitude: '50-400米', climate: '亚热带湿润', description: '龙井茶原产地，乾隆四次驾临' },
  { id: 2, name: '武夷山茶区', province: '福建', altitude: '300-1200米', climate: '亚热带湿润', description: '世界双遗产地，岩茶唯一产区' },
  { id: 3, name: '安溪茶区', province: '福建', altitude: '300-1000米', climate: '亚热带季风', description: '铁观音原产地，中国茶都' },
  { id: 4, name: '福鼎茶区', province: '福建', altitude: '400-1000米', climate: '沿海湿润', description: '白茶原产地，太姥山茶文化发祥地' },
  { id: 5, name: '黄山茶区', province: '安徽', altitude: '400-1200米', climate: '高山云雾', description: '黄山毛峰、太平猴魁原产地' },
  { id: 6, name: '勐海茶区', province: '云南', altitude: '1000-1800米', climate: '热带雨林', description: '普洱茶核心产区，布朗山古树茶' },
  { id: 7, name: '洞庭东山', province: '江苏', altitude: '100-300米', climate: '温和湿润', description: '碧螺春原产地，太湖小气候' },
  { id: 8, name: '凤庆茶区', province: '云南', altitude: '1000-1800米', climate: '低纬高原', description: '滇红诞生地，3200年茶树王' },
]

// ============ 茶人数据 ============

const people = [
  { id: 1, name: '陆羽', dynasty: '唐', title: '茶圣', quote: '茶者，南方之嘉木也。', description: '撰《茶经》，中国茶文化奠基者' },
  { id: 2, name: '苏轼', dynasty: '宋', title: '茶中诗仙', quote: '且将新火试新茶，诗酒趁年华。', description: '近百首茶诗传世' },
  { id: 3, name: '陆游', dynasty: '宋', title: '茶诗第一', quote: '晴窗细乳戏分茶。', description: '三百余首茶诗，历史之最' },
  { id: 4, name: '乾隆', dynasty: '清', title: '六下江南品茶帝', quote: '火前嫩，火后老，惟有骑火品最好。', description: '亲封十八棵御茶树' },
  { id: 5, name: '卢仝', dynasty: '唐', title: '七碗茶歌者', quote: '七碗吃不得也，唯觉两腋习习清风生。', description: '以"七碗茶诗"闻名' },
  { id: 6, name: '白居易', dynasty: '唐', title: '茶中隐士', quote: '无由持一碗，寄与爱茶人。', description: '以诗记茶，晚年号香山居士' },
  { id: 7, name: '蔡襄', dynasty: '宋', title: '茶录作者', quote: '茶色贵白，而饼茶多以珍膏油其面。', description: '著《茶录》，宋代茶学大家' },
  { id: 8, name: '宋徽宗赵佶', dynasty: '宋', title: '皇帝茶人', quote: '至若茶之为物，致清导和。', description: '唯一为茶著书立说的帝王' },
]

// ============ 茶诗数据 ============

const poems = [
  { id: 1, title: '望江南·超然台作', author: '苏轼', dynasty: '宋', content: '且将新火试新茶，诗酒趁年华。', description: '以茶寄情的千古名句' },
  { id: 2, title: '山泉煎茶有怀', author: '白居易', dynasty: '唐', content: '坐酌泠泠水，看煎瑟瑟尘。无由持一碗，寄与爱茶人。', description: '品茶真谛——因分享而更美' },
  { id: 3, title: '七碗茶诗', author: '卢仝', dynasty: '唐', content: '一碗喉吻润，两碗破孤闷。三碗搜枯肠，惟有文字五千卷。七碗吃不得也，唯觉两腋习习清风生。', description: '中国最著名的茶诗' },
  { id: 4, title: '观采茶作歌', author: '乾隆', dynasty: '清', content: '火前嫩，火后老，惟有骑火品最好。西湖龙井旧擅名，适来试一观其道。', description: '乾隆亲观龙井采制' },
  { id: 5, title: '汲江煎茶', author: '苏轼', dynasty: '宋', content: '活水还须活火烹，自临钓石取深清。大瓢贮月归春瓮，小杓分江入夜瓶。', description: '烹茶要诀：活水活火' },
  { id: 6, title: '临安春雨初霁', author: '陆游', dynasty: '宋', content: '小楼一夜听春雨，深巷明朝卖杏花。矮纸斜行闲作草，晴窗细乳戏分茶。', description: '宋代文人风雅' },
  { id: 7, title: '一字至七字诗·茶', author: '元稹', dynasty: '唐', content: '茶。香叶，嫩芽。慕诗客，爱僧家。碾雕白玉，罗织红纱。', description: '宝塔诗写茶' },
  { id: 8, title: '重过何氏', author: '杜甫', dynasty: '唐', content: '落日平台上，春风啜茗时。石栏斜点笔，桐叶坐题诗。', description: '品茶题诗，文人风雅' },
]

// ============ 写入文件 ============

function save(name, data) {
  writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2))
  console.log(`✅ ${name}.json (${data.length} 条)`)
}

save('teas', teas)
save('regions', regions)
save('people', people)
save('poems', poems)

console.log(`\n🎉 种子数据已生成到 ${DATA_DIR}`)
