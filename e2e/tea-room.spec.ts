/**
 * 茶室主题切换 E2E（T1.2 主题环境音接线）：
 * - 茶室页可进入并可切换茶室（宋式/明式/山林茶舍）
 * - 切到山林茶舍后标题更新，页面无运行错误（环境音合成层随主题切换）
 */
import { test, expect } from '@playwright/test'

test('茶室页：默认明式，可切换到山林茶舍且无页面错误', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))

  await page.goto('tearoom')
  await expect(page.getByText('茶道十二境')).toBeVisible()

  // 打开茶室选择器
  await page.getByRole('button', { name: '选择茶室' }).click()
  await page.getByRole('button', { name: '山林茶舍' }).click()

  // 顶栏茶室名更新为山林茶舍（按钮 accessible name 为 aria-label「选择茶室」，用文本断言）
  await expect(page.getByRole('button', { name: '选择茶室' })).toContainText('山林茶舍')

  // 页面无未捕获错误（环境音合成层随主题切换不应抛异常）
  expect(pageErrors).toEqual([])
})

test('茶室页：迎宾引导点"进入茶席"入席（明式默认敲磬），无页面错误', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(err.message))

  await page.goto('tearoom')

  // 迎宾引导出现，点击入席（默认明式茶室，磬声在此触发）
  await page.getByRole('button', { name: '进入茶席' }).click()
  await expect(page.getByRole('button', { name: '进入茶席' })).not.toBeVisible()

  expect(pageErrors).toEqual([])
})
