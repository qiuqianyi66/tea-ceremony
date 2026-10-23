/** 端到端同步验证：登录 → 种茶 → 前端 synced + 后端落库 → 采摘 → 后端状态更新
 *  2026-10-22：注册路径对齐新栈 /api/v1/auth + ApiResponse 解包（旧 /api/auth 随 FastAPI 退役）。
 *  前置：本地 PG 运行中；queryPg 的 python 需装 sqlalchemy + psycopg2（默认找 backend/.venv，
 *  可用 TEA_PY 环境变量覆盖，如指向新栈开发用的任意 python）。
 *  口令不入库（R9）：PG 连接串走 TEA_PG 环境变量，仓库只留本地开发默认值的占位说明。 */
const { chromium } = require('@playwright/test')
const { execSync } = require('child_process')

const PG = process.env.TEA_PG || 'postgresql://tea_user:<本地开发口令>@localhost:5432/tea_ceremony'
const PY = process.env.TEA_PY || 'backend/.venv/Scripts/python.exe'

function queryPg(sql) {
  const script = `from sqlalchemy import create_engine, text; e=create_engine('${PG}'); print([[str(c) if c is not None else 'null' for c in r] for r in e.connect().execute(text('''${sql}'''))])`
  const fs = require('fs')
  fs.writeFileSync('backend/_pgq.py', script)
  const out = execSync(`cd backend && "${PY}" _pgq.py`, { encoding: 'utf8' })
  fs.unlinkSync('backend/_pgq.py')
  return out.trim()
}

;(async () => {
  const browser = await chromium.launch({ channel: 'chromium', args: ['--mute-audio'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => {
    errors.push(e.message)
    console.log('[pageerror]', e.message)
  })

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)

  // 1. 注册/登录（真实后端；2026-10-22 对齐新栈：/api/v1 + ApiResponse 解包）
  const username = `sync_${Date.now().toString(36)}`
  await page.evaluate(async (u) => {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: 'pass-123', display_name: '同步测试' }),
    })
    const body = await res.json()
    const data = body.data // ApiResponse<TokenVo>：{ token, expiresInSeconds, user }
    localStorage.setItem('tea-auth', JSON.stringify({ token: data.token, user: data.user }))
  }, username)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  console.log('[1] 已注册登录:', username)

  // 2. 进入茶园种茶
  await page.goto('http://localhost:5173/garden/hangzhou', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  const plantBtn = page.locator('.plant-btn-3d')
  if (await plantBtn.isVisible().catch(() => false)) {
    await plantBtn.click()
    await page.waitForTimeout(500)
    await page.locator('.tea-select-item').first().click()
    await page.waitForTimeout(300)
    await page.locator('.dialog-btn.confirm').click()
    await page.waitForTimeout(8000) // 等 3D 渲染 + 同步
  }
  console.log('[2] 种茶完成')

  // 3. 检查前端 IndexedDB syncStatus
  const local = await page.evaluate(async () => {
    const req = indexedDB.open('teaCeremonyDB')
    const db = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('gardenPlants', 'readonly')
    const store = tx.objectStore('gardenPlants')
    const plants = await new Promise((res) => {
      const r = store.getAll()
      r.onsuccess = () => res(r.result)
    })
    return plants.map((p) => ({
      id: p.id,
      teaId: p.teaId,
      syncStatus: p.syncStatus,
      syncError: p.syncError ?? null,
    }))
  })
  console.log('[3] 前端本地:', JSON.stringify(local))

  // 4. 检查后端落库
  const server = queryPg(
    `SELECT client_id, region_id, tea_id, status, harvest_count FROM garden_plants ORDER BY id DESC LIMIT 3`,
  )
  console.log('[4] 后端:', server)
  const serverOk = server.includes('hangzhou') && server.includes('longjing')

  // 5. 采摘 → 后端状态更新（改 IndexedDB 造成熟再采）
  await page.evaluate(async () => {
    const req = indexedDB.open('teaCeremonyDB')
    const db = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('gardenPlants', 'readwrite')
    const store = tx.objectStore('gardenPlants')
    const plants = await new Promise((res) => {
      const r = store.getAll()
      r.onsuccess = () => res(r.result)
    })
    for (const p of plants) {
      p.plantedAt = new Date(Date.now() - 12 * 86400000).toISOString()
      store.put(p)
    }
    await new Promise((res) => {
      tx.oncomplete = res
    })
  })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(6000)
  console.log('[5] 已改为成熟期并刷新')

  const scan = await page.evaluate(() => {
    const g = window.__teaGarden
    const scene = g.scene()
    const camera = g.activeCamera()
    const cam = camera.value || camera
    let hitbox = null
    scene.traverse((o) => {
      if (!hitbox && o.isMesh && o.userData && typeof o.userData.plantId === 'number') hitbox = o
    })
    if (!hitbox) return null
    const rc = new g.THREE.Raycaster()
    const v = new g.THREE.Vector2()
    const hits = []
    for (let sy = 0; sy < 900; sy += 8)
      for (let sx = 0; sx < 1440; sx += 8) {
        v.x = (sx / 1440) * 2 - 1
        v.y = -(sy / 900) * 2 + 1
        rc.setFromCamera(v, cam)
        if (rc.intersectObject(hitbox, true).length > 0) hits.push([sx, sy])
      }
    if (!hits.length) return null
    return {
      x: Math.round(hits.reduce((a, p) => a + p[0], 0) / hits.length),
      y: Math.round(hits.reduce((a, p) => a + p[1], 0) / hits.length),
    }
  })
  let opened = false
  if (scan) {
    for (let dy = -25; dy <= 25 && !opened; dy += 12)
      for (let dx = -25; dx <= 25 && !opened; dx += 12) {
        const x = Math.min(1435, Math.max(5, scan.x + dx)),
          y = Math.min(895, Math.max(5, scan.y + dy))
        await page.mouse.move(x, y)
        await page.waitForTimeout(50)
        await page.mouse.down()
        await page.waitForTimeout(50)
        await page.mouse.up()
        await page.waitForTimeout(200)
        if (
          await page
            .locator('.plant-detail')
            .isVisible()
            .catch(() => false)
        ) {
          opened = true
          break
        }
      }
  }
  const harvestBtn = page.locator('.dialog-btn.harvest')
  const hasHarvest = await harvestBtn.isVisible().catch(() => false)
  if (hasHarvest) {
    await harvestBtn.click()
    await page.waitForTimeout(2500)
  }
  console.log(`[6] 采摘: 详情打开=${opened}, 采摘按钮=${hasHarvest}`)

  const serverAfter = queryPg(
    `SELECT status, harvest_count FROM garden_plants ORDER BY id DESC LIMIT 1`,
  )
  console.log('[7] 采摘后后端:', serverAfter)
  const harvestSynced = serverAfter.includes('harvested') && serverAfter.includes('1')

  const localAfter = await page.evaluate(async () => {
    const req = indexedDB.open('teaCeremonyDB')
    const db = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('gardenPlants', 'readonly')
    const store = tx.objectStore('gardenPlants')
    const plants = await new Promise((res) => {
      const r = store.getAll()
      r.onsuccess = () => res(r.result)
    })
    return plants.map((p) => ({
      status: p.status,
      harvestCount: p.harvestCount,
      syncStatus: p.syncStatus,
    }))
  })
  console.log('[8] 采摘后本地:', JSON.stringify(localAfter))

  console.log(`[9] 页面错误: ${errors.length ? errors.join(' | ') : '无'}`)
  const pass = serverOk && harvestSynced && errors.length === 0
  console.log(pass ? '\n=== ✅ 端到端同步验证通过 ===' : '\n=== ❌ 验证未通过 ===')
  await browser.close()
  process.exit(pass ? 0 : 1)
})().catch((e) => {
  console.error('脚本失败:', e.message)
  process.exit(1)
})
