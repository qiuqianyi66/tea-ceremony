/**
 * 健康检查页 E2E：用 page.route 确定性 mock 两个状态（ok / 不可达），
 * 不依赖本机或 CI 是否真实运行后端——避免「本机后端已起导致不可达用例误挂」的环境差异。
 */
import { expect, test } from '@playwright/test'

test('健康检查页：后端不可达时显示不可达态', async ({ page }) => {
  // 拦截 /api/health（dev 下 VITE_API_URL=/api，经 Vite 代理到后端），模拟网络失败
  await page.route('**/api/health', (route) => route.abort())
  await page.goto('health')
  await expect(page.getByRole('heading', { name: '服务健康检查' })).toBeVisible()
  await expect(page.getByText('后端不可达', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '回到首页' })).toBeVisible()
})

test('健康检查页：后端正常时显示服务正常与数据库状态', async ({ page }) => {
  // 确定性 mock 健康检查成功响应（与后端 /api/health 返回结构一致）
  await page.route('**/api/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', database: 'ok', dev_mode: true }),
    }),
  )
  await page.goto('health')
  await expect(page.getByText('服务正常', { exact: true })).toBeVisible()
  await expect(page.getByText('数据库', { exact: true })).toBeVisible()
  await expect(page.getByText('正常', { exact: true })).toBeVisible()
  await expect(page.getByText('开发模式', { exact: true })).toBeVisible()
  await expect(page.getByText('后端不可达', { exact: true })).toHaveCount(0)
})
