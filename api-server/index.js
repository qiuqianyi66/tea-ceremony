/**
 * 一盏茶 API 服务（轻量版）
 * 使用 JSON 文件存储，无需数据库
 * Express + JSON 文件
 */

import express from 'express'
import cors from 'cors'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')
const DIST_DIR = join(__dirname, '..', 'dist')

// 确保数据目录存在
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

// ============ JSON 数据库 ============

function readDB(name) {
  const path = join(DATA_DIR, `${name}.json`)
  if (!existsSync(path)) return []
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return [] }
}

function writeDB(name, data) {
  writeFileSync(join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2))
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ============ 初始化 ============

const app = express()
app.use(cors())
app.use(express.json())

// ============ 用户 API ============

app.post('/api/auth/register', (req, res) => {
  const { username, password, displayName } = req.body
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' })

  const users = readDB('users')
  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: '用户名已存在' })
  }

  // 开发模式——简化的密码存储
  const user = {
    id: users.length + 1,
    username,
    displayName: displayName || username,
    level: 1, xp: 0,
    password,  // 明文存储，仅供开发
    createdAt: new Date().toISOString(),
  }
  users.push(user)
  writeDB('users', users)

  res.json({
    access_token: `token_${user.id}_${Date.now()}`,
    user: { id: user.id, username, display_name: user.displayName, level: 1, xp: 0 },
  })
})

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  const users = readDB('users')
  const user = users.find(u => u.username === username && u.password === password)
  if (!user) return res.status(401).json({ error: '用户名或密码错误' })

  res.json({
    access_token: `token_${user.id}_${Date.now()}`,
    user: { id: user.id, username, display_name: user.displayName, level: user.level || 1, xp: user.xp || 0 },
  })
})

// ============ 品鉴记录 API ============

app.get('/api/records', (req, res) => {
  const records = readDB('records')
  res.json(records.reverse())
})

app.post('/api/records', (req, res) => {
  const records = readDB('records')
  const record = { id: genId(), ...req.body, createdAt: new Date().toISOString() }
  records.push(record)
  writeDB('records', records)
  res.json(record)
})

// ============ 茶文化 API ============

app.get('/api/teas', (req, res) => {
  const teas = readDB('teas')
  const { category } = req.query
  if (category) return res.json(teas.filter(t => t.category === category))
  res.json(teas)
})

app.get('/api/teas/:id', (req, res) => {
  const teas = readDB('teas')
  const tea = teas.find(t => t.id == req.params.id || t.name === req.params.id)
  if (!tea) return res.status(404).json({ error: '未找到' })
  const cultures = readDB('tea_culture')
  tea.culture = cultures.find(c => c.tea_id == tea.id) || null
  res.json(tea)
})

app.get('/api/regions', (req, res) => {
  const regions = readDB('regions')
  if (req.query.province) return res.json(regions.filter(r => r.province === req.query.province))
  res.json(regions)
})

app.get('/api/people', (req, res) => {
  const people = readDB('people')
  if (req.query.dynasty) return res.json(people.filter(p => p.dynasty === req.query.dynasty))
  res.json(people)
})

app.get('/api/poems', (req, res) => {
  const poems = readDB('poems')
  if (req.query.author) return res.json(poems.filter(p => p.author === req.query.author))
  res.json(poems)
})

// 搜索（含知识库）
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase()
  if (!q) return res.json({ teas: [], people: [], regions: [], poems: [], knowledge: [] })
  
  const results = {}
  results.teas = readDB('teas').filter(t => t.name.includes(q) || (t.category || '').includes(q)).slice(0, 5).map(t => ({ id: t.id, name: t.name, type: 'tea' }))
  results.people = readDB('people').filter(p => p.name.includes(q)).slice(0, 5).map(p => ({ id: p.id, name: p.name, dynasty: p.dynasty, type: 'person' }))
  results.regions = readDB('regions').filter(r => r.name.includes(q) || (r.province || '').includes(q)).slice(0, 5).map(r => ({ id: r.id, name: r.name, province: r.province, type: 'region' }))
  results.poems = readDB('poems').filter(p => (p.title || '').includes(q) || (p.content || '').includes(q)).slice(0, 5).map(p => ({ id: p.id, title: p.title, author: p.author, type: 'poem' }))
  
  // 知识库搜索
  const knowledge = readDB('knowledge')
  results.knowledge = knowledge.filter(k =>
    (k.title || '').includes(q) || (k.content || '').includes(q) || (k.tags || []).some(t => t.includes(q))
  ).slice(0, 5).map(k => ({ id: k.id, title: k.title, category: k.category, source: k.source, content: k.content.slice(0, 100), type: 'knowledge' }))
  
  // 搜索结果摘要
  const total = results.teas.length + results.people.length + results.regions.length + results.poems.length + results.knowledge.length
  
  res.json(results)
})

// RAG 知识查询（返回详细内容供 AI 使用）
app.get('/api/rag', (req, res) => {
  const q = (req.query.q || '').toLowerCase()
  if (!q) return res.json({ sources: [] })
  
  const knowledge = readDB('knowledge')
  const matched = knowledge.filter(k =>
    (k.title || '').includes(q) || (k.content || '').includes(q) || (k.tags || []).some(t => t.includes(q))
  ).slice(0, 3)
  
  const context = matched.map(k => `【${k.title}】（来源：${k.source}）\n${k.content}`).join('\n\n')
  
  res.json({ sources: matched, context })
})

// ============ 用户茶谱 API ============

app.get('/api/profile/:userId', (req, res) => {
  const profiles = readDB('user_profiles')
  let p = profiles.find(p => p.userId == req.params.userId)
  if (!p) {
    p = { userId: parseInt(req.params.userId), teaAgeDays: 0, totalBrews: 0, favoriteCategory: '', favoriteAromas: [], tasteStyle: { sweetness: 5, aftertaste: 5, bitterness: 5 }, personalityId: null }
  }
  if (p.personalityId) {
    const pers = readDB('personalities')
    p.personality = pers.find(x => x.id === p.personalityId) || null
  }
  res.json(p)
})

app.post('/api/profile/:userId/analyze', (req, res) => {
  const { category, score, aroma } = req.body
  let profiles = readDB('user_profiles')
  let p = profiles.find(x => x.userId == req.params.userId)
  if (!p) { p = { userId: parseInt(req.params.userId), teaAgeDays: 0, totalBrews: 0, favoriteCategory: '', favoriteAromas: [], tasteStyle: { sweetness: 5, aftertaste: 5, bitterness: 5 }, personalityId: null }; profiles.push(p) }
  p.totalBrews = (p.totalBrews||0) + 1
  if (category) p.favoriteCategory = category
  if (aroma && !(p.favoriteAromas||[]).includes(aroma)) p.favoriteAromas = [...(p.favoriteAromas||[]), aroma].slice(-5)
  if (score) { const s = p.tasteStyle || {}; if (score >= 8) s.sweetness = Math.min(10,(s.sweetness||5)+1); p.tasteStyle = s }
  if (category && !p.personalityId) {
    const pers = readDB('personalities')
    const m = pers.find(x => (x.preferredCategories||[]).includes(category))
    if (m) p.personalityId = m.id
  }
  writeDB('user_profiles', profiles)
  res.json(p)
})

app.get('/api/personalities', (req, res) => {
  res.json(readDB('personalities'))
})

// ============ 前端静态文件 ============

app.use(express.static(DIST_DIR))

// SPA 路由：所有非 API 请求返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(join(DIST_DIR, 'index.html'))
})

// ============ 启动 ============

const PORT = process.env.PORT || 80
app.listen(PORT, () => {
  console.log(`一盏茶 API 运行在 http://localhost:${PORT}`)
  console.log(`API 文档：http://localhost:${PORT}/api`)
})
