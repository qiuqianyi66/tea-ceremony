/**
 * 首页 + 高分品鉴卡截图（精简版）。
 * - home.png：等待「入席」按钮渲染完成后再截（避免过渡动画首帧全黑）
 * - share.png：用构造的高分记录生成分享链接，直出美观的品鉴卡
 *
 * 用法：node scripts/screenshots-home-share.cjs（需本地 preview :4173）
 */
const { chromium } = require('@playwright/test')

const highScoreRecord = {
  teaName: '西湖龙井',
  date: '2026-09-04T08:39:51.940Z',
  brewTemp: 80,
  brewTime: 30,
  infusions: 3,
  dimensions: {
    bitterness: 2, sweetness: 5, aftertaste: 5, body: 4,
    aroma: 5, rhyme: 4, shape: 4, mind: 5,
  },
  overallScore: 8.6,
  processFactor: 0.86,
  aromaType: 'floral',
  notes: '西湖龙井，豆香清雅，回甘悠长。',
  weather: '晴',
  mood: '安静',
}
const r = Buffer.from(JSON.stringify(highScoreRecord)).toString('base64url')

;(async () => {
  const browser = await chromium.launch({ channel: 'chromium' })
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })
  await page.route('**/api/ai/*', route => route.abort())
  const base = 'http://localhost:4173'

  // 首页：固定等待仪式感动画完成（黑屏 2.5s + 淡出 1s + 余量）。
  // 注意：按钮 opacity:0 时即有布局尺寸，waitFor visible 会过早返回，故用固定时长。
  await page.goto(base + '/')
  await page.waitForTimeout(4600)
  await page.screenshot({ path: 'docs/screenshots/home.png' })

  // 高分品鉴卡分享页
  await page.goto(`${base}/share?r=${r}`)
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'docs/screenshots/share.png', fullPage: true })

  await browser.close()
  console.log('home + share screenshots done')
})().catch(error => {
  console.error('SCREENSHOT_ERROR', error)
  process.exit(1)
})

