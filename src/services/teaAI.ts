/**
 * 茶灵 AI 服务
 * LLM 优先（Pollinations.ai 免费 API），规则引擎降级
 */

import type { Tea } from '@/types/tea'
import type { TasteDimensions, TastingRecord } from '@/types/tasting'
import { teas } from '@/data/teas'
import { getCurrentSolarTerm } from '@/data/solarTerms'

// ============ LLM 调用 ============

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai'

let lastCallTime = 0
const MIN_INTERVAL = 15000  // 15秒间隔（免费版限制）

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const now = Date.now()
  const wait = MIN_INTERVAL - (now - lastCallTime)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastCallTime = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'deepseek',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  } catch {
    return null
  }
}

// ============ 系统提示词 ============

const RECOMMEND_SYSTEM_PROMPT = `你是「一盏茶」的茶灵 AI，一位精通中国茶道的老师傅。
你的任务是根据用户的时间、天气、心情，推荐一款最适合的茶。

规则：
1. 只用中文回答，语言优美雅致
2. 回答格式：
   推荐茶品：[茶名]
   理由：一句话说明为什么推荐这款茶
   冲泡建议：建议水温、浸泡时间
3. 回复不超过 80 字
4. 可以推荐的茶类：绿茶、白茶、黄茶、青茶、红茶、黑茶`

const TASTING_SYSTEM_PROMPT = `你是「一盏茶」的茶灵 AI，一位品茶大师。
用户刚完成一次品鉴，请你根据品鉴数据生成一段优美的茶记。

规则：
1. 只用中文，语言古雅有韵味
2. 格式：一句诗意的开头 + 2-3句品鉴感受
3. 整体不超过 60 字
4. 不要用评价性语言（如"很好""不错"），用描述性语言`

// ============ 推荐引擎 ============

interface RecommendInput {
  time: 'morning' | 'afternoon' | 'evening' | 'night'
  weather: 'sunny' | 'cloudy' | 'rainy' | 'snowy'
  mood: 'energetic' | 'calm' | 'focused' | 'tired' | 'creative'
}

const TIME_RULES: Record<string, string[]> = {
  morning: ['绿茶', '白茶'],
  afternoon: ['青茶', '红茶'],
  evening: ['红茶', '黑茶'],
  night: ['黑茶', '白茶'],
}

const WEATHER_RULES: Record<string, string[]> = {
  sunny: ['绿茶', '白茶'],
  cloudy: ['青茶', '黄茶'],
  rainy: ['红茶', '黑茶'],
  snowy: ['红茶', '黑茶'],
}

const MOOD_RULES: Record<string, string[]> = {
  energetic: ['绿茶', '青茶'],
  calm: ['白茶', '黄茶'],
  focused: ['青茶', '绿茶'],
  tired: ['红茶', '黑茶'],
  creative: ['青茶', '绿茶'],
}

function ruleBasedRecommend(input: RecommendInput): { tea: Tea; reason: string } {
  const scores: Record<string, number> = {}
  for (const tea of teas) scores[tea.type] = (scores[tea.type] || 0) + 1
  for (const type of TIME_RULES[input.time] || []) scores[type] = (scores[type] || 0) + 3
  for (const type of WEATHER_RULES[input.weather] || []) scores[type] = (scores[type] || 0) + 2
  for (const type of MOOD_RULES[input.mood] || []) scores[type] = (scores[type] || 0) + 2

  const bestType = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]![0]
  const candidates = teas.filter(t => t.type === bestType)
  const tea = candidates[Math.floor(Math.random() * candidates.length)]!

  const timeDesc: Record<string, string> = {
    morning: '清晨', afternoon: '午后', evening: '黄昏', night: '静夜',
  }
  const reason = `${timeDesc[input.time] || ''}${input.weather === 'rainy' ? '微雨' : input.weather === 'sunny' ? '晴好' : '宜人'}，推荐一壶${tea.name}。${tea.description.slice(0, 15)}`

  return { tea, reason }
}

export async function recommendTea(input: RecommendInput): Promise<{ tea: Tea; reason: string }> {
  const userPrompt = `现在是${input.time}，天气${input.weather}，心情${input.mood}。推荐一款茶。`
  const llmResult = await callLLM(RECOMMEND_SYSTEM_PROMPT, userPrompt)
  if (llmResult) {
    // 从 LLM 回复中提取茶名
    const match = llmResult.match(/推荐茶品[：:]\s*(.+)/)
    if (match) {
      const teaName = match[1]!.trim()
      const found = teas.find(t => teaName.includes(t.name) || t.name.includes(teaName))
      if (found) return { tea: found, reason: llmResult.replace(/推荐茶品[：:].+?\n/, '').trim() }
    }
  }
  return ruleBasedRecommend(input)
}

// ============ 增强推荐（含用户历史 + 节气）============

export function recommendTeaEnhanced(
  input: RecommendInput,
  history: TastingRecord[] = [],
): { tea: Tea; reason: string; score: number } {
  const term = getCurrentSolarTerm()

  // 计算用户偏好
  const typeCounts: Record<string, number> = {}
  const aromaCounts: Record<string, number> = {}
  let totalScore = 0

  for (const r of history) {
    const t = teas.find(tt => tt.id === r.teaId)
    if (t) {
      typeCounts[t.type] = (typeCounts[t.type] || 0) + 1
      totalScore += r.overallScore
    }
    if (r.aromaType) {
      aromaCounts[r.aromaType] = (aromaCounts[r.aromaType] || 0) + 1
    }
  }

  const avgScore = history.length > 0 ? totalScore / history.length : 0
  const favType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
  const favAroma = Object.entries(aromaCounts).sort((a, b) => b[1] - a[1])[0]?.[0]

  // 综合评分
  const scored = teas.map(tea => {
    let score = 0

    // 1. 季节匹配（权重20%）
    if (term.teaTypes.includes(tea.type)) score += 20
    // 2. 时间匹配（权重15%）
    if ((TIME_RULES[input.time] || []).includes(tea.type)) score += 15
    // 3. 天气匹配（权重15%）
    if ((WEATHER_RULES[input.weather] || []).includes(tea.type)) score += 15
    // 4. 心情匹配（权重15%）
    if ((MOOD_RULES[input.mood] || []).includes(tea.type)) score += 15
    // 5. 用户偏好（权重25%）
    if (favType && tea.type === favType) score += avgScore >= 7 ? 25 : 15
    // 6. 未品鉴优先（权重10%）
    if (!history.some(r => r.teaId === tea.id)) score += 10

    return { tea, score }
  })

  const best = scored.sort((a, b) => b.score - a.score)[0]!

  const parts: string[] = []
  if (favAroma) parts.push(`根据您对${favAroma}的偏好`)
  if (term.name) parts.push(`今日${term.name}`)
  parts.push(`推荐一壶${best.tea.name}`)

  return { tea: best.tea, reason: parts.join('，') + '。', score: best.score }
}

// ============ 品鉴评语生成 ============

function ruleBasedNote(teaName: string, d: TasteDimensions, score: number): string {
  const parts: string[] = [`今日品${teaName}`]
  if (d.bitterness >= 4) parts.push('微苦而化')
  else if (d.bitterness <= 2) parts.push('清甜柔和')
  if (d.sweetness >= 4) parts.push('甘甜生津')
  if (d.aftertaste >= 4) parts.push('回甘悠长')
  if (d.body >= 4) parts.push('醇厚饱满')
  if (d.aroma >= 4) parts.push('香气高锐')
  if (d.rhyme >= 4) parts.push('余韵绕舌')
  if (score >= 9) parts.push('堪称上品')
  else if (score <= 5) parts.push('下次可调整水温')
  return parts.join('，') + '。'
}

export async function generateTastingNote(
  teaName: string,
  dimensions: TasteDimensions,
  score: number,
): Promise<string> {
  const userPrompt = `茶品：${teaName}
苦涩度${dimensions.bitterness}/5，甜度${dimensions.sweetness}/5，回甘${dimensions.aftertaste}/5
醇厚度${dimensions.body}/5，香气${dimensions.aroma}/5，茶韵${dimensions.rhyme}/5
综合评分：${score}/10
请写一段品茶记。`
  const llmResult = await callLLM(TASTING_SYSTEM_PROMPT, userPrompt)
  return llmResult || ruleBasedNote(teaName, dimensions, score)
}

// ============ 工具函数 ============

export function getTimeOfDay(): RecommendInput['time'] {
  const hour = new Date().getHours()
  if (hour < 11) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 21) return 'evening'
  return 'night'
}

export function getWeatherDesc(): string {
  const weathers = ['sunny', 'cloudy', 'rainy']
  return weathers[Math.floor(Math.random() * weathers.length)]!
}

// ============ AI 问答 ============

const AI_SYSTEM_PROMPT = `你是「一盏茶」的茶灵 AI，一位精通中国茶道的老师傅，温文尔雅，言语简练。
用户会问你关于茶的问题。请用中文回答，语言优美雅致。
回答不超过 80 字。保持专业但平易近人。`

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const FALLBACK_REPLIES = [
  '品茶之道，存乎一心。水温、时间、器皿皆外物，静心品味方得真味。',
  '茶有千味，适口者珍。不妨多尝试不同茶类，慢慢找到属于自己的那杯茶。',
  '泡茶如做人，水温不宜过高，心气不宜过急。七分茶，三分情。',
]

// ============ RAG 知识库检索 ============

const API_BASE = import.meta.env.VITE_API_URL || '/api'

async function fetchRAGContext(question: string): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/culture/search?q=${encodeURIComponent(question)}`)
    if (!res.ok) return ''
    const data = await res.json()
    const parts: string[] = ['【茶文化知识库资料】']

    if (data.teas?.length) {
      parts.push('\n相关茶叶：')
      data.teas.forEach((t: any) => parts.push(`- ${t.name}`))
    }
    if (data.people?.length) {
      parts.push('\n相关茶人：')
      data.people.forEach((p: any) => parts.push(`- ${p.name}（${p.dynasty}）`))
    }
    if (data.regions?.length) {
      parts.push('\n相关产区：')
      data.regions.forEach((r: any) => parts.push(`- ${r.name}（${r.province}）`))
    }
    if (data.poems?.length) {
      parts.push('\n相关茶诗：')
      data.poems.forEach((p: any) => parts.push(`- 《${p.title}》${p.author}`))
    }

    return parts.join('\n')
  } catch {
    return ''
  }
}

export async function askTeaMaster(question: string, history: ChatMessage[] = []): Promise<string> {
  // 先尝试获取 RAG 上下文
  const ragContext = await fetchRAGContext(question)
  const systemPrompt = ragContext
    ? `${AI_SYSTEM_PROMPT}\n\n参考以下茶文化知识库资料回答（优先采用资料中的内容，避免编造）：\n${ragContext}`
    : AI_SYSTEM_PROMPT

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-4),
    { role: 'user', content: question },
  ]

  try {
    const now = Date.now()
    const wait = Math.max(0, 15000 - (now - lastCallTime))
    if (wait > 0) await new Promise(r => setTimeout(r, wait))

    const res = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ model: 'deepseek', messages }),
    })
    lastCallTime = Date.now()

    if (!res.ok) return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]!
    const data = await res.json()
    return data.choices?.[0]?.message?.content || FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]!
  } catch {
    return FALLBACK_REPLIES[Math.floor(Math.random() * FALLBACK_REPLIES.length)]!
  }
}

export function getSuggestion(): string[] {
  return ['今天适合喝什么茶？', '绿茶用什么茶器最好？', '如何判断茶汤品质？']
}

export type { RecommendInput }
