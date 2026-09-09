/** diag-glare.cjs — 定位右侧刺眼白光：逐项隐藏对象截图对比 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  const shot = async (name) => { await page.screenshot({ path: name }) }

  // 1. baseline
  await shot('diag_0_baseline.png')

  // 2. 关 environment
  await page.evaluate(() => { const g = window.__teaGarden; g.scene().environment = null })
  await page.waitForTimeout(500)
  await shot('diag_1_noenv.png')

  // 3. 恢复 env，隐藏 ambient 层（云+晨雾）
  await page.evaluate(() => {
    const g = window.__teaGarden
    g.scene().environment = null
    const amb = g.scene().getObjectByName('ambient')
    if (amb) amb.visible = false
  })
  await page.waitForTimeout(500)
  await shot('diag_2_noambient_noenv.png')

  // 4. 隐藏 scenery（茶亭篱笆）
  await page.evaluate(() => {
    const g = window.__teaGarden
    const s = g.scene()
    s.traverse((o) => { if (o.name === 'garden-scenery') o.visible = false })
  })
  await page.waitForTimeout(500)
  await shot('diag_3_noscenery.png')

  // 5. 隐藏动物
  await page.evaluate(() => {
    const g = window.__teaGarden
    g.scene().traverse((o) => { if (o.name === 'garden-animals') o.visible = false })
  })
  await page.waitForTimeout(500)
  await shot('diag_4_noanimals.png')

  // 6. 隐藏云（保留晨雾）—— 重建：只隐藏名字含 cloud 的
  await page.evaluate(() => {
    const g = window.__teaGarden
    const amb = g.scene().getObjectByName('ambient')
    if (amb) amb.visible = true
    const s = g.scene()
    s.traverse((o) => { if (o.name === 'garden-scenery') o.visible = true })
    s.traverse((o) => { if (o.name === 'garden-animals') o.visible = true })
    g.scene().environment = null
    // 隐藏 cloud 相关 mesh（材质 userData.cloud）
    const clouds = []
    amb.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && o.material.emissiveMap) clouds.push(o) })
    // 前 5 个是云（按创建顺序）
    clouds.forEach((m, i) => { if (i < 5) m.visible = false })
  })
  await page.waitForTimeout(500)
  await shot('diag_5_noclouds.png')

  await browser.close()
  console.log('done')
})()
