/**
 * 一键茶歇（/break）E2E：
 * - 进入即开始计时（05:00）+ 呼吸引导 + 操作按钮
 * - 暂停停表（计时文字不变）/ 继续走表（计时减少）
 * - 结束茶歇 → 结束态（种树 + 诗句）→ 回到首页
 * 注意：5 分钟真实计时不等待，用暂停/继续验证计时状态机。
 */
import { test, expect } from '@playwright/test'

test('茶歇：进入即开始计时并显示呼吸引导', async ({ page }) => {
  await page.goto('/break')

  await expect(page.locator('.break-timer')).toHaveText('05:00')
  // 呼吸引导文字（吸气/呼气二选一）
  await expect(page.locator('.breath-text')).toContainText(/吸气|呼气/)
  await expect(page.getByRole('button', { name: '暂停' })).toBeVisible()
  await expect(page.getByRole('button', { name: '结束茶歇' })).toBeVisible()
})

test('茶歇：暂停停表，计时文字保持不变', async ({ page }) => {
  await page.goto('/break')

  // 先等计时走起来（05:00 → 04:5x）
  await page.waitForFunction(() => {
    const el = document.querySelector('.break-timer')
    return el?.textContent !== '05:00'
  }, null, { timeout: 5_000 })

  await page.getByRole('button', { name: '暂停' }).click()
  await expect(page.getByRole('button', { name: '继续' })).toBeVisible()

  const frozen = await page.locator('.break-timer').textContent()
  await page.waitForTimeout(2500)
  await expect(page.locator('.break-timer')).toHaveText(frozen ?? '')
})

test('茶歇：继续后计时继续走', async ({ page }) => {
  await page.goto('/break')

  await page.waitForFunction(() => {
    const el = document.querySelector('.break-timer')
    return el?.textContent !== '05:00'
  }, null, { timeout: 5_000 })

  await page.getByRole('button', { name: '暂停' }).click()
  const pausedAt = await page.locator('.break-timer').textContent()
  await page.getByRole('button', { name: '继续' }).click()

  await page.waitForFunction((frozen) => {
    const el = document.querySelector('.break-timer')
    return el?.textContent !== frozen
  }, pausedAt, { timeout: 5_000 })
})

test('茶歇：结束茶歇进入结束态并可回首页', async ({ page }) => {
  await page.goto('/break')

  await page.getByRole('button', { name: '结束茶歇' }).click()

  await expect(page.getByText(/种出了这棵茶/)).toBeVisible()
  await expect(page.locator('.finish-poem')).toBeVisible()
  await expect(page.locator('.finish-poet')).toBeVisible()

  await page.getByRole('button', { name: '回到首页' }).click()
  await expect(page).toHaveURL('/')
})
