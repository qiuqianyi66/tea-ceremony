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
