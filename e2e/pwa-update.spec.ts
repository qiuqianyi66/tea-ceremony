import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

/**
 * P0-3 PWA prompt 更新模式 e2e
 *
 * 已知边界（调试实测）：
 * 1. Playwright 的 page.route 无法拦截 Service Worker 的脚本更新请求（SW 更新绕过
 *    页面网络栈，routeHits=0）→ 模拟"新版本发布"必须直接修改 dist/sw.js 文件内容，
 *    让 reg.update() 拿到真实的新字节；try/finally 恢复原内容。
 * 2. 本环境（headless Chromium + preview）下页面无 SW controller（reload 后仍为
 *    false），且 Chrome 会在无 controller 时于 waiting 后自动激活新 SW——因此不
 *    断言"稍后保留 waiting"，只断言 prompt 模式的核心承诺：不自动刷新页面、toast
 *    按用户操作消失、立即更新后新版本激活。有 controller 时的"稍后保留"由单测覆盖
 *    （PwaUpdateToast.spec：dismiss 只隐藏提示、不触发 SKIP_WAITING）。
 * 3. 两测试共享 dist/sw.js 文件 → 必须串行（describe.configure serial）。
 */
const swPath = fileURLToPath(new URL('../dist/sw.js', import.meta.url))
const MARKER = '\n// e2e-simulated-release\n'

// 每次文档初始化计数（sessionStorage 跨 reload 保留）→ 断言"未发生额外 reload"
async function installInitCounter(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    try {
      const n = (Number(sessionStorage.getItem('__page_init')) || 0) + 1
      sessionStorage.setItem('__page_init', String(n))
    } catch {}
  })
}
const pageInitCount = (page: import('@playwright/test').Page) =>
  page.evaluate(() => Number(sessionStorage.getItem('__page_init') ?? '0'))

test.describe.configure({ mode: 'serial' })

test.describe('PWA 更新（prompt 模式）', () => {
  test('新版本就绪时提示，点击稍后 toast 消失且页面不自动刷新', async ({ page }) => {
    await installInitCounter(page)
    await page.goto('/')
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
      undefined,
      { timeout: 30000 },
    )
    // 等注册流程稳定，避免与首次安装竞态
    await page.waitForTimeout(1500)
    await expect(page.getByText('新版本已就绪')).toHaveCount(0)

    const original = fs.readFileSync(swPath, 'utf8')
    try {
      // 模拟发布新版本：追加内容 → sw.js 字节变化 → 更新检查发现新字节
      fs.appendFileSync(swPath, MARKER)
      await page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration()
        await r?.update()
      })
      await expect(page.getByText('新版本已就绪')).toBeVisible({ timeout: 10000 })
      await page.waitForFunction(
        async () =>
          (await navigator.serviceWorker.getRegistration())?.waiting?.state === 'installed',
      )

      // 点击「稍后」：toast 消失、页面无额外 reload
      await page.getByRole('button', { name: '稍后' }).click()
      await expect(page.getByText('新版本已就绪')).toHaveCount(0)
      expect(await pageInitCount(page)).toBe(1)
    } finally {
      fs.writeFileSync(swPath, original)
    }
  })

  test('点击立即更新后新版本激活、toast 消失且页面不自动刷新', async ({ page }) => {
    await installInitCounter(page)
    await page.goto('/')
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
      undefined,
      { timeout: 30000 },
    )
    await page.waitForTimeout(1500)

    const original = fs.readFileSync(swPath, 'utf8')
    try {
      fs.appendFileSync(swPath, MARKER)
      await page.evaluate(async () => {
        const r = await navigator.serviceWorker.getRegistration()
        await r?.update()
      })
      await expect(page.getByText('新版本已就绪')).toBeVisible({ timeout: 10000 })

      // 点击「立即更新」：发送 SKIP_WAITING → 新 SW 激活（waiting 清空），toast 消失
      await page.getByRole('button', { name: '立即更新' }).click()
      await expect(page.getByText('新版本已就绪')).toHaveCount(0)
      await page.waitForFunction(
        async () => {
          const r = await navigator.serviceWorker.getRegistration()
          return r?.active?.state === 'activated' && !r?.waiting
        },
        undefined,
        { timeout: 10000 },
      )
      // prompt 模式：更新确认后不强制刷新页面
      expect(await pageInitCount(page)).toBe(1)
    } finally {
      fs.writeFileSync(swPath, original)
    }
  })
})
