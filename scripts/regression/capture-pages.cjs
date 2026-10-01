/**
 * capture-pages.cjs — 关键页面回归截图基线
 *
 * 固化五个关键页面的渲染状态：Home / Brew / Taste / Garden / Share
 * 用法：
 *   node scripts/regression/capture-pages.cjs            # 截到 docs/screenshots/regression/latest/
 *   node scripts/regression/capture-pages.cjs --baseline # 首次或确认改动后，覆盖基线 baseline/
 *   $env:REGRESSION_BASE_URL=http://localhost:4173 ...   # 可指定预览/开发地址（默认 5173）
 *
 * 前置：先起 dev 或 preview 服务器。Brew/Taste 需要已选茶（requiresTea 守卫），
 * 脚本会自动在 /select 点击第一张茶卡完成选茶。
 * 有 console/page error 时 exit 1（基线应保持零错误）。
 */
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BASE = process.env.REGRESSION_BASE_URL || 'http://localhost:5173'
const isBaseline = process.argv.includes('--baseline')
const outDir = path.join(
  __dirname,
  '..',
  '..',
  'docs',
  'screenshots',
  'regression',
  isBaseline ? 'baseline' : 'latest',
)
fs.mkdirSync(outDir, { recursive: true })

const VIEWPORT = { width: 1440, height: 900 }
const WAIT = { home: 3000, select: 800, brew: 2500, taste: 2500, garden: 5000, share: 2500 }

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  const page = await browser.newPage({ viewport: VIEWPORT })
  const errors = []
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // 环境噪音：前端 dev 未起后端时，页面请求 /api/* 会连接拒绝；不视为页面回归失败
    if (m.text().includes('ERR_CONNECTION_REFUSED')) return
    errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  const shot = async (name, wait) => {
    await page.waitForTimeout(wait)
    await page.screenshot({ path: path.join(outDir, `${name}.png`) })
    console.log('SHOT', name)
  }

  // 1. Home
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await shot('home', WAIT.home)

  // 2. 选茶（为 Brew/Taste 解锁 requiresTea 守卫）
  await page.goto(`${BASE}/select`, { waitUntil: 'domcontentloaded' })
  const firstCard = page.locator('.tea-card').first()
  await firstCard.waitFor({ timeout: 10000 })
  await shot('select', WAIT.select)
  await firstCard.click()
  await page.waitForTimeout(300)

  // 3. Brew
  await page.goto(`${BASE}/brew`, { waitUntil: 'domcontentloaded' })
  await shot('brew', WAIT.brew)

  // 4. Taste
  await page.goto(`${BASE}/taste`, { waitUntil: 'domcontentloaded' })
  await shot('taste', WAIT.taste)

  // 5. Garden（3D 场景加载慢，多等）
  await page.goto(`${BASE}/garden/hangzhou`, { waitUntil: 'domcontentloaded' })
  await shot('garden', WAIT.garden)

  // 6. Share（空参只读页：渲染空态，页面无错即过）
  await page.goto(`${BASE}/share`, { waitUntil: 'domcontentloaded' })
  await shot('share', WAIT.share)

  console.log('MODE:', isBaseline ? 'baseline' : 'latest')
  console.log('OUT:', outDir)
  console.log('ERRORS:', JSON.stringify(errors))
  await browser.close()
  process.exit(errors.length > 0 ? 1 : 0)
})().catch((e) => {
  console.error('CAPTURE_FAILED', e)
  process.exit(1)
})
