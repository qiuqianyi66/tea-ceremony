/** verify-icons.cjs — 清理后关键页面图标渲染审计截图 */
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ channel: 'chromium', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 150)))
  await page.route('**/api/ai/*', r => r.abort())
  const base = 'http://localhost:5173'

  // 首页：导航卡片 + 茶人故事 + 图谱入口
  await page.goto(base + '/')
  await page.waitForTimeout(2500)
  await page.screenshot({ path: 'verify_icons_home.png' })

  // 茶修档案（等级六境图标）
  await page.goto(base + '/profile')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'verify_icons_profile.png' })

  // 品鉴历史（等级 + 成就图标）
  await page.goto(base + '/history')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'verify_icons_history.png' })

  // 茶歇（麦克风/声音图标）
  await page.goto(base + '/break')
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'verify_icons_break.png' })

  console.log('ERRORS:', JSON.stringify(errors))
  await browser.close()
})()
