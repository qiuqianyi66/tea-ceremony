/**
 * P2-6 无障碍 E2E：冲泡页 live region 播报 + 键盘注水可达
 * - 阶段自动流转对读屏用户不可见 → role=status 视觉隐藏播报区存在且随阶段更新
 * - 拖拽壶嘴对键盘用户不可用 → 主按钮点击注水已覆盖；壶嘴自身 Enter 也等价注水
 * 走完备器进入冲泡（真实计时，约 10s 到 READY）。
 *
 * 注意：/brew 是懒加载路由，URL 切换早于 DOM 切换（旧页 ToolSelect 按钮「开始冲泡 →」
 * 会短暂残留）。等 READY 主按钮必须用「第N泡 · 开始冲泡」精确匹配，不能匹配「开始冲泡」。
 */

import { expect, type Page, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/ai/*', (route) => route.abort())
  page.on('pageerror', (err) => console.log('[PAGEERROR]', err.stack || err.message))
})

/** 首页 → 选西湖龙井 → 白瓷盖碗 → 开始冲泡，抵达 /brew。 */
async function enterBrewing(page: Page) {
  await page.goto('')
  await page.getByRole('button', { name: /入\s*席/ }).click()
  await page.waitForURL('**/select')
  await page.getByText('西湖龙井', { exact: true }).first().click()
  await page.getByRole('button', { name: '选择 西湖龙井' }).click()
  await page.waitForURL('**/tools')
  await page.getByRole('button', { name: /白瓷盖碗/ }).click()
  await page
    .getByRole('button', { name: /山泉|泉水|纯净|山涧|雨水|井水/ })
    .first()
    .click()
  await page.getByRole('button', { name: '开始冲泡 →' }).click()
  await page.waitForURL('**/brew')
}

test('冲泡页有 role=status 读屏播报区，且阶段流转会更新播报', async ({ page }) => {
  await enterBrewing(page)

  // 视觉隐藏的播报区（sr-only + role=status），与全局 toast 的 status 区分开
  const status = page.locator('.sr-only[role="status"]')
  await expect(status).toBeVisible()

  // 煮水阶段（HEATING）播报区含阶段描述
  await expect(status).toContainText(/电陶炉加热中/)

  // 零点击自动流转：醒茶倒计时末 3 秒播报（不伪造时钟，真实等待 ~10s）
  await expect(status).toContainText(/醒茶中，还剩/, { timeout: 20000 })

  // READY：播报区更新为"水已沸"
  await expect(status).toContainText(/水已沸/, { timeout: 10000 })
})

test('壶嘴拖拽对键盘用户开放：聚焦壶嘴按回车等价注水，进入浸泡', async ({ page }) => {
  await enterBrewing(page)

  // 等 READY 主按钮（「第1泡 · 开始冲泡」）；不匹配懒加载残留的「开始冲泡 →」
  await page.getByRole('button', { name: /第\d+泡 · 开始冲泡/ }).waitFor({ timeout: 30000 })

  // 键盘路径：聚焦壶嘴（role=button，aria-label 含"回车键注水"），Enter 触发注水
  const kettle = page.getByRole('button', { name: /回车键注水/ })
  await expect(kettle).toBeVisible()
  await kettle.focus()
  await page.keyboard.press('Enter')

  // 进入浸泡：主按钮变「出汤 (Ns)」
  await expect(page.getByRole('button', { name: /出汤 \(/ })).toBeVisible({ timeout: 10000 })
})
