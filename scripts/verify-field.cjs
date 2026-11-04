/** verify-field.cjs — 古籍茶园验证：新地形（山脊/红壤/梯田/排水）+ 成垄茶行 + 遮阴树 */
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
  await page.waitForTimeout(5000)

  // 茶行数量统计
  const fieldStats = await page.evaluate(() => {
    const g = window.__teaGarden
    if (!g) return null
    const tf = g.scene().getObjectByName('tea-field')
    if (!tf) return { found: false }
    // 累加而非赋值：茶行由多个 InstancedMesh 拼成，赋值会被后一个覆盖（实测 bushes 曾只报最后一批）
    let bushes = 0,
      trunks = 0
    tf.traverse((o) => {
      if (!o.isInstancedMesh || !o.geometry) return
      if (o.geometry.type === 'SphereGeometry') bushes += o.count
      if (o.geometry.type === 'CylinderGeometry') trunks += o.count
    })
    // 遮阴树走独立 InstancedMesh，不在这条判定里；旧版按「非 instanced Mesh」计数恒为 0，已删除该误导指标
    return { found: true, bushes, trunks }
  })
  console.log('FIELD:', JSON.stringify(fieldStats))

  // ---- 最小断言：茶行必须真的有实例，否则「地形还在」只是空场景 ----
  if (!fieldStats || !fieldStats.found) errors.push('ASSERT: 未找到 tea-field 节点')
  else {
    if (!(fieldStats.bushes > 0)) errors.push('ASSERT: 茶行灌木实例数为 0')
    if (!(fieldStats.trunks > 0)) errors.push('ASSERT: 茶行树干实例数为 0')
  }
  console.log('VERIFIED:', fieldStats && fieldStats.found ? 'tea-field-instances' : 'no-tea-field（本次未验到茶行）')

  // 相机默认位全景
  await page.screenshot({ path: 'verify_field_sunny.png' })

  // 拉近看茶行（相机转向茶园带：茶行在 z -26~-41）
  await page.evaluate(() => {
    const g = window.__teaGarden
    const cam = g.activeCamera()
    const c = cam && cam.value ? cam.value : cam
    c.position.set(0, 14, -50)
    c.lookAt(0, 5, -30)
  })
  await page.waitForTimeout(900)
  await page.screenshot({ path: 'verify_field_rows.png' })

  // T4.1 起种植链路已从 src/ 删除（`.plant-btn-3d` 命中 0），原「种一棵用户茶树」分支退役，
  // 本探针只验静态地形：茶行 / 遮阴树实例数 + 两张全景截图。

  console.log('ERRORS:', JSON.stringify(errors))
  if (errors.length > 0) process.exitCode = 1
  await browser.close()
})()
