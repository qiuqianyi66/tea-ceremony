/**
 * E2E 茶园「读路径」同步验证（补 2026-11-04 评审登记的覆盖缺口）：
 * 拦截 gardenApi.list + energyApi.summary → 断言读路径请求确实被发出 → 页面正常渲染。
 *
 * 覆盖的是「读路径连通」，不是 WebGL 渲染结果（那由 scripts/verify-gardens.cjs 覆盖）。
 * 登录态：本探针只验「读后端数据 → 渲染」的链路，认证由 src/services/api/requestOrMock
 * 统一处理（token 缺失自动降级 mock），因此不依赖真实后端登录。
 */
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/ai/*', (route) => route.abort())
  page.on('pageerror', (err) => console.log('[PAGEERROR]', err.stack || err.message))
})

test('茶园读路径：gardenApi.list 发出请求且页面正常渲染', async ({ page }) => {
  const requested: string[] = []

  // 拦截 gardenApi.list（GET /v1/garden-plants），记录请求后返回 mock 数据
  await page.route('**/v1/garden-plants*', (route) => {
    requested.push(route.request().url())
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'OK',
        message: 'ok',
        data: [
          {
            client_id: 'test-1',
            region_id: 'hangzhou',
            tea_id: 'longjing',
            status: 'growing',
            planted_at: new Date().toISOString(),
          },
          {
            client_id: 'test-2',
            region_id: 'hangzhou',
            tea_id: 'biluochun',
            status: 'growing',
            planted_at: new Date().toISOString(),
          },
        ],
      }),
    })
  })

  // 拦截 energyApi.summary（GET /v1/garden-energy/summary）
  await page.route('**/v1/garden-energy*', (route) => {
    requested.push(route.request().url())
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'OK',
        message: 'ok',
        data: {
          pending_amount: 12,
          collected_amount: 5,
          total_energy: 17,
          phase: 'growing',
          phase_thresholds: { planted: 0, growing: 100, blooming: 300, harvested: 600 },
        },
      }),
    })
  })

  // 进入茶园（Hangzhou 地区）——先造登录态，否则 loadGarden 因 isLoggedIn=false 提前 return
  await page.addInitScript(() => {
    localStorage.setItem(
      'tea-auth',
      JSON.stringify({
        token: 'e2e-test-token',
        user: { id: 1, username: 'e2e_reader', display_name: '读路径测试' },
      }),
    )
  })
  await page.goto('/garden/hangzhou')
  // Y3 修复：真实等待（不依赖固定时长）
  await page.waitForResponse((resp) => resp.url().includes('/v1/garden-plants'), {
    timeout: 10_000,
  })

  // 读路径断言：两个请求都必须发出
  expect(
    requested.length,
    'gardenApi.list 与 energyApi.summary 至少各发出 1 次',
  ).toBeGreaterThanOrEqual(2)
  expect(
    requested.some((u) => u.includes('/v1/garden-plants')),
    'gardenApi.list 请求路径正确',
  ).toBe(true)
  expect(
    requested.some((u) => u.includes('/v1/garden-energy')),
    'energyApi.summary 请求路径正确',
  ).toBe(true)

  // 渲染断言：页面正常渲染（不崩、有茶园标题）
  await expect(page.getByRole('heading', { name: /茶园/ })).toBeVisible()
})
