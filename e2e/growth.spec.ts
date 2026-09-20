/**
 * 成长数据看板 E2E（T1.1）：
 * - 无品鉴记录时展示空态与引导（数据全来自本地 IndexedDB，不依赖后端）
 * - 从品鉴历史页可进入成长看板
 */
import { expect, test } from '@playwright/test'

test('成长看板：无记录时展示空态与引导', async ({ page }) => {
  await page.goto('growth')
  await expect(page.getByRole('heading', { name: '成长看板' })).toBeVisible()
  await expect(page.getByText('暂无品鉴记录', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '去选一壶茶' })).toBeVisible()
})

test('品鉴历史页可进入成长看板', async ({ page }) => {
  await page.goto('history')
  await expect(page.getByRole('button', { name: '成长看板' })).toBeVisible()
  await page.getByRole('button', { name: '成长看板' }).click()
  await expect(page.getByRole('heading', { name: '成长看板' })).toBeVisible()
})
