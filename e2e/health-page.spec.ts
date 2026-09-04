/**
 * 健康检查页 E2E：无后端（静态 preview / Pages）时应显示不可达态，不报错。
 */
import { test, expect } from '@playwright/test'

test('健康检查页：无后端时显示不可达态', async ({ page }) => {
  await page.goto('health')
  await expect(page.getByRole('heading', { name: '服务健康检查' })).toBeVisible()
  // 静态环境没有后端，应进入 error 态（异步渲染后出现）
  await expect(page.getByText('后端不可达', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '回到首页' })).toBeVisible()
})
