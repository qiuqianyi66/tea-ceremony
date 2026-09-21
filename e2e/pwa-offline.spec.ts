import { expect, test } from '@playwright/test'

/**
 * P1-8 PWA 离线深链（navigateFallback）
 *
 * 背景：未配 navigateFallback 时，离线后直接打开 /brew、/share 等深链（书签/分享卡入口）
 * SW 无导航回退 → 浏览器网络错误页/白屏，伤害「分享卡可分享、离线优先」核心承诺。
 *
 * 环境要点（与 pwa-update.spec 实测一致）：
 * - prompt 模式未开 clientsClaim，首次注册 SW 的页面不被控制；SW activated 后**新开的
 *   文档**才会被控制，故离线深链用 context.newPage() 验证。
 * - 懒加载路由 chunk 在 SW 预缓存清单内（workbox globPatterns 覆盖全部 js 产物）。
 */
test.describe('PWA 离线深链（navigateFallback）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
      undefined,
      { timeout: 30000 },
    )
    // 等待预缓存清单写入完成（index.html / 懒加载 chunk）
    await page.waitForTimeout(2000)
  })

  const deepLinks = ['/brew', '/share?token=offline-deep-link-fixture']

  for (const deepLink of deepLinks) {
    test(`断网后直接访问 ${deepLink} 回退 index.html，不白屏`, async ({ context }) => {
      await context.setOffline(true)
      try {
        const offlinePage = await context.newPage()
        const response = await offlinePage.goto(deepLink, { timeout: 15000 })

        // SW navigateFallback 命中：导航请求拿到 index.html 200，而非浏览器网络错误
        expect(response, '离线深链必须由 SW 回退响应，不应导航失败').not.toBeNull()
        expect(response?.status()).toBe(200)
        // 地址栏保持深链（回退不重写 URL，前端路由接管）
        expect(offlinePage.url()).toContain(deepLink.split('?')[0])
        // Vue 已挂载：#app 有内容，不是浏览器离线错误页
        await expect(offlinePage.locator('#app')).not.toBeEmpty({ timeout: 10000 })

        await offlinePage.close()
      } finally {
        await context.setOffline(false)
      }
    })
  }
})
