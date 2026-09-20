/**
 * 成长数据看板截图（T1.1 设计审计用）。
 * - growth-empty.png：空态（无记录）
 * - growth-desktop.png：注入品鉴记录后的桌面端 1440x900
 * - growth-mobile.png：移动端 390x844
 * 用法：node scripts/screenshot-growth.cjs（需本地 dev :5174）
 */
const { chromium } = require('@playwright/test')

const RECORDS = [
  {
    id: 'seed_1',
    teaId: 'longjing',
    teaName: '西湖龙井',
    date: '2026-04-05T10:00:00.000Z',
    brewTemp: 80,
    brewTime: 60,
    infusions: 2,
    dimensions: {
      bitterness: 2,
      sweetness: 4,
      aftertaste: 5,
      body: 3,
      aroma: 5,
      rhyme: 4,
      shape: 3,
      mind: 5,
    },
    overallScore: 8.6,
    processFactor: 0.92,
    syncStatus: 'synced',
  },
  {
    id: 'seed_2',
    teaId: 'jinjunmei',
    teaName: '金骏眉',
    date: '2026-09-14T10:00:00.000Z',
    brewTemp: 90,
    brewTime: 45,
    infusions: 3,
    dimensions: {
      bitterness: 1,
      sweetness: 5,
      aftertaste: 5,
      body: 4,
      aroma: 4,
      rhyme: 5,
      shape: 3,
      mind: 5,
    },
    overallScore: 9.4,
    processFactor: 0.95,
    syncStatus: 'synced',
  },
  {
    id: 'seed_3',
    teaId: 'baihaoyinzhen',
    teaName: '白毫银针',
    date: '2026-06-21T10:00:00.000Z',
    brewTemp: 85,
    brewTime: 50,
    infusions: 2,
    dimensions: {
      bitterness: 1,
      sweetness: 3,
      aftertaste: 4,
      body: 2,
      aroma: 3,
      rhyme: 3,
      shape: 4,
      mind: 4,
    },
    overallScore: 7.2,
    processFactor: 0.88,
    syncStatus: 'synced',
  },
  {
    id: 'seed_4',
    teaId: 'dahongpao',
    teaName: '大红袍',
    date: '2026-01-25T10:00:00.000Z',
    brewTemp: 95,
    brewTime: 30,
    infusions: 4,
    dimensions: {
      bitterness: 4,
      sweetness: 2,
      aftertaste: 4,
      body: 5,
      aroma: 4,
      rhyme: 3,
      shape: 4,
      mind: 3,
    },
    overallScore: 6.8,
    processFactor: 0.8,
    syncStatus: 'synced',
  },
  {
    id: 'seed_5',
    teaId: 'longjing',
    teaName: '西湖龙井',
    date: '2026-03-21T10:00:00.000Z',
    brewTemp: 80,
    brewTime: 55,
    infusions: 2,
    dimensions: {
      bitterness: 2,
      sweetness: 4,
      aftertaste: 4,
      body: 3,
      aroma: 5,
      rhyme: 4,
      shape: 3,
      mind: 5,
    },
    overallScore: 8.2,
    processFactor: 0.9,
    syncStatus: 'synced',
  },
  {
    id: 'seed_6',
    teaId: 'biluochun',
    teaName: '碧螺春',
    date: '2026-02-04T10:00:00.000Z',
    brewTemp: 75,
    brewTime: 45,
    infusions: 2,
    dimensions: {
      bitterness: 2,
      sweetness: 5,
      aftertaste: 4,
      body: 2,
      aroma: 5,
      rhyme: 3,
      shape: 3,
      mind: 4,
    },
    overallScore: 8.0,
    processFactor: 0.85,
    syncStatus: 'synced',
  },
]

async function seedRecords(page) {
  await page.goto('http://localhost:5174/')
  await page.waitForTimeout(800)
  await page.evaluate(
    (records) =>
      new Promise((resolve, reject) => {
        // 不带版本号打开已存在的库（app 先行初始化），避免与 Dexie 当前版本冲突
        const req = indexedDB.open('teaCeremonyDB')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('tastings', 'readwrite')
          const store = tx.objectStore('tastings')
          for (const record of records) store.put(record)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    RECORDS,
  )
}

;(async () => {
  const browser = await chromium.launch({
    channel: 'chromium',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  })
  const base = 'http://localhost:5174'

  // 桌面端
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 250)))
  await page.route('**/api/ai/*', (route) => route.abort())

  // 空态
  await page.goto(base + '/growth')
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'docs/screenshots/growth-empty.png' })

  // 注入记录后
  await seedRecords(page)
  await page.goto(base + '/growth')
  await page.waitForTimeout(1400) // 等图表动画
  await page.screenshot({ path: 'docs/screenshots/growth-desktop.png' })
  // 滚动到底部，确认节气足迹渲染
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'docs/screenshots/growth-desktop-bottom.png' })

  // 移动端
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const mpage = await mctx.newPage()
  await mpage.route('**/api/ai/*', (route) => route.abort())
  await seedRecords(mpage)
  await mpage.goto(base + '/growth')
  await mpage.waitForTimeout(1400)
  await mpage.screenshot({ path: 'docs/screenshots/growth-mobile.png' })

  await browser.close()
  console.log('growth screenshots done')
})().catch((error) => {
  console.error('SCREENSHOT_ERROR', error)
  process.exit(1)
})
