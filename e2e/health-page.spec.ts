/**
 * 健康检查页 E2E：用 page.route 确定性 mock 两个状态（ok / 不可达），
 * 不依赖本机或 CI 是否真实运行后端——避免「本机后端已起导致不可达用例误挂」的环境差异。
 *
 * 端点说明（2026-10-18 变更）：页面改用 Spring Actuator 的 /actuator/health。
 * 旧的 /api/health 在后端根本没有映射，且不在 SecurityConfig 白名单内，线上固定 401，
 * 导致本页永久显示「后端不可达」。mock 路径必须与页面实际请求一致，否则测的是空气。
 */
import { expect, test } from '@playwright/test'

test('健康检查页：后端不可达时显示不可达态', async ({ page }) => {
  // 拦截 /actuator/health（dev 下经 Vite 代理到后端），模拟网络失败
  await page.route('**/actuator/health', (route) => route.abort())
  await page.goto('health')
  await expect(page.getByRole('heading', { name: '服务健康检查' })).toBeVisible()
  await expect(page.getByText('后端不可达', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '回到首页' })).toBeVisible()
})

test('健康检查页：后端正常时显示服务正常与数据库状态', async ({ page }) => {
  // 匿名访问的 actuator 响应形状：show-details=when_authorized → 只有 status，没有 components
  await page.route('**/actuator/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'UP' }),
    }),
  )
  await page.goto('health')
  await expect(page.getByText('服务正常', { exact: true })).toBeVisible()
  await expect(page.getByText('数据库', { exact: true })).toBeVisible()
  // 匿名拿不到组件明细，页面必须如实说明而不是假装「正常」
  await expect(page.getByText('正常（匿名不返回明细）', { exact: true })).toBeVisible()
  await expect(page.getByText('响应耗时', { exact: true })).toBeVisible()
  await expect(page.getByText('后端不可达', { exact: true })).toHaveCount(0)
})

test('健康检查页：后端降级（DOWN）时不显示服务正常', async ({ page }) => {
  await page.route('**/actuator/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'DOWN' }),
    }),
  )
  await page.goto('health')
  await expect(page.getByText('后端不可达', { exact: true })).toBeVisible()
  await expect(page.getByText('服务正常', { exact: true })).toHaveCount(0)
})
