import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// ============ 茶味人格数据 ============

const personalities = [
  {
    id: 'elegant',
    name: '清雅型',
    icon: '🌸',
    description: '偏爱留白，也懂得细品。喜欢白茶、绿茶的清雅，享受独处的安静时光。',
    preferredCategories: ['绿茶', '白茶'],
    preferredAromas: ['花香', '毫香', '清香'],
    teaSuggestion: '白毫银针、西湖龙井',
    poem: '一盏清茗酬知己，半卷闲书度春秋。',
  },
  {
    id: 'mountain',
    name: '山韵型',
    icon: '🏔️',
    description: '喜欢时间留下的厚度。钟爱岩茶和普洱，欣赏紫砂壶的温润，懂得等待的价值。',
    preferredCategories: ['青茶', '黑茶'],
    preferredAromas: ['岩韵', '陈香', '炭香'],
    teaSuggestion: '大红袍、老班章普洱',
    poem: '溪边奇茗冠天下，武夷仙人从古栽。',
  },
  {
    id: 'floral',
    name: '花香型',
    icon: '🌺',
    description: '追寻自然给予茶的香气。凤凰单丛的百变香型、铁观音的兰花香，都是你的最爱。',
    preferredCategories: ['青茶'],
    preferredAromas: ['花香', '蜜香', '兰花香'],
    teaSuggestion: '凤凰单丛、铁观音',
    poem: '且将新火试新茶，诗酒趁年华。',
  },
  {
    id: 'rich',
    name: '醇厚型',
    icon: '🫖',
    description: '偏爱沉稳与温润。红茶和普洱是你杯中的常客，喜欢茶汤在口中的饱满感。',
    preferredCategories: ['红茶', '黑茶'],
    preferredAromas: ['蜜香', '陈香', '醇厚'],
    teaSuggestion: '金骏眉、熟普洱',
    poem: '坐酌泠泠水，看煎瑟瑟尘。',
  },
  {
    id: 'fresh',
    name: '鲜爽型',
    icon: '🍃',
    description: '追求极致的鲜爽体验。明前龙井、碧螺春的鲜嫩让你着迷，喜欢春天的味道。',
    preferredCategories: ['绿茶'],
    preferredAromas: ['豆香', '嫩香', '栗香'],
    teaSuggestion: '西湖龙井、碧螺春',
    poem: '且将新火试新茶，诗酒趁年华。',
  },
  {
    id: 'calm',
    name: '禅定型',
    icon: '🧘',
    description: '茶是你的修行之道。茶与禅、静与思，在一盏茶中寻找内心的安宁。',
    preferredCategories: ['白茶', '黄茶'],
    preferredAromas: ['毫香', '甜香', '醇和'],
    teaSuggestion: '白毫银针、君山银针',
    poem: '茶禅一味，古今常新。',
  },
]

// ============ 写入文件 ============

writeFileSync(join(DATA_DIR, 'personalities.json'), JSON.stringify(personalities, null, 2))
console.log(`✅ personalities.json (${personalities.length} 种人格)`)

console.log('\n🎉 茶味人格数据已生成')
