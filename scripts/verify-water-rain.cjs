/**
 * verify-water-rain.cjs — 复现用户操作：种茶→点击茶树→浇水动画；切雨天→雨丝；捕获 console 错误
 *
 * 已知失效（2026-11-03 实测）：本脚本「若无苗则种茶」分支用的 `.plant-btn-3d` / `.empty-hint`
 * 在 `src/` 已无对应节点（茶园页改走拖拽/接口播种），干净 profile 下本脚本只能当 smoke：
 * 尾部 `VERIFIED:` 会显示 `no-watering-button（本次未验到浇水动画）`。
 */
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  // 后端不在场时 telemetry 上报会刷 ERR_CONNECTION_REFUSED，污染错误桶：直接应答 204
  await page.route('**/v1/telemetry/batch', (r) => r.fulfill({ status: 204, body: '' }))
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)

  // 1. 种茶（若无苗）
  const plantBtn = page.locator('.plant-btn-3d')
  const empty = await page
    .locator('.empty-hint')
    .isVisible()
    .catch(() => false)
  if (empty) {
    await plantBtn.click()
    await page.waitForTimeout(400)
    const items = page.locator('.tea-select-item')
    if ((await items.count()) > 0) {
      await items.first().click()
      await page.waitForTimeout(300)
    }
    const confirm = page.locator('.dialog-btn.confirm')
    if (await confirm.isVisible().catch(() => false)) {
      await confirm.click()
    }
    await page.waitForTimeout(2500)
  }

  // 2. 点击茶树 hitbox 打开详情面板
  const hit = await page.evaluate(() => {
    const g = window.__teaGarden
    if (!g) return null
    const scene = g.scene()
    let hitbox = null
    scene.traverse((o) => {
      if (!hitbox && o.isMesh && o.userData && typeof o.userData.plantId === 'number') hitbox = o
    })
    if (!hitbox) return null
    const cam = (() => {
      const a = g.activeCamera()
      return a && a.value ? a.value : a
    })()
    const v = hitbox.getWorldPosition(new g.THREE.Vector3())
    const p = v.clone().project(cam)
    return { x: (p.x * 0.5 + 0.5) * 1440, y: (-p.y * 0.5 + 0.5) * 900 }
  })
  if (hit) {
    await page.mouse.click(hit.x, hit.y)
    await page.waitForTimeout(1200)
  }

  // 3. 点"浇水"
  const waterBtn = page.locator('.dialog-btn.confirm', { hasText: '浇水' })
  if (await waterBtn.isVisible().catch(() => false)) {
    await waterBtn.click()
    await page.waitForTimeout(450)
    await page.screenshot({ path: 'verify_3d_watering2.png' })
    await page.waitForTimeout(900)
    await page.screenshot({ path: 'verify_3d_watering3.png' })
    // 关闭面板
    const close = page.locator('.dialog-btn.cancel', { hasText: '关闭' })
    if (await close.isVisible().catch(() => false)) await close.click()
    await page.waitForTimeout(400)
  }

  // 4. 切雨天 → 截图（1.6s 渐变后）
  const rainBtn = page.locator('.ambient-btn-3d[title="切换到雨天"]')
  if (await rainBtn.isVisible().catch(() => false)) {
    await rainBtn.click()
    await page.waitForTimeout(2600)
    await page.screenshot({ path: 'verify_3d_rain2.png' })
  }

  const wateringVisible = await waterBtn.isVisible().catch(() => false)
  console.log(
    JSON.stringify({ wateringVisible, errors }, null, 2),
  )
  // 探针如实标注自己验到了什么：按钮不在 = 本次没验到浇水动画，不能算「通过」
  console.log(
    'VERIFIED:',
    wateringVisible ? 'watering-button-present' : 'no-watering-button（本次未验到浇水动画）',
  )
  console.log('ERRORS:', JSON.stringify(errors))
  if (errors.length > 0) process.exitCode = 1
  await browser.close()
})()
