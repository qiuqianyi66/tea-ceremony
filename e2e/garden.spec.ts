/**
 * E2E 茶园纯观赏流程测试（T4.1 养成降级后）：
 * 地区选择 → 进入 3D 茶园 → 无养成按钮 → 天气切换 → 茶亭叙事 → 返回
 *
 * 断言只落在 UI 层（顶栏/茶亭/按钮），不依赖 WebGL 渲染结果；
 * 3D 场景本身由 scripts/verify-gardens.cjs 截图验证。
 */

import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // 与全流程测试一致：拦截 AI 代理请求，避免依赖后端
  await page.route('**/api/ai/*', route => route.abort())
  page.on('pageerror', err => console.log('[PAGEERROR]', err.stack || err.message))
})

test('茶园：地区选择 → 进入 3D 茶园 → 无养成入口 → 天气切换 → 返回', async ({ page }) => {
  // ============ 1. 地区选择页 ============
  await page.goto('garden')
  await expect(page.getByRole('heading', { name: '我的茶园' })).toBeVisible()
  // 四座茶山卡片齐全（名称含在卡片内）
  await expect(page.getByText('杭州·西湖龙井茶园', { exact: true })).toBeVisible()
  await expect(page.getByText('武夷山·岩茶茶园', { exact: true })).toBeVisible()
  await expect(page.getByText('云南·勐海古茶园', { exact: true })).toBeVisible()
  await expect(page.getByText('福建·福鼎白茶园', { exact: true })).toBeVisible()

  // ============ 2. 进入杭州茶园（3D 场景 + 顶栏） ============
  await page.getByText('杭州·西湖龙井茶园', { exact: true }).click()
  await page.waitForURL('**/garden/hangzhou')
  // 3D canvas 已挂载（WebGL 渲染结果不断言，只看容器存在）
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })

  // ============ 3. 养成入口已移除（降级纯观赏） ============
  await expect(page.getByRole('button', { name: /种茶/ })).toHaveCount(0)
  await expect(page.locator('.plant-card')).toHaveCount(0)

  // ============ 4. 天气切换（晴天 ↔ 雨天） ============
  const rainBtn = page.locator('.ambient-btn-3d[title="切换到雨天"]')
  await expect(rainBtn).toBeVisible()
  await rainBtn.click()
  await expect(page.locator('.ambient-btn-3d[title="切换到晴天"]')).toBeVisible()

  // ============ 5. 返回地区选择 ============
  await page.getByRole('button', { name: /茶园/ }).click()
  await page.waitForURL('**/garden')
  await expect(page.getByRole('heading', { name: '我的茶园' })).toBeVisible()
})

test('茶园：点击 3D 茶亭弹出该园古籍引文（叙事锚点）', async ({ page }) => {
  await page.goto('garden/hangzhou')
  // 等待 3D 场景挂载
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 })
  // 点击屏幕中部的茶亭（茶亭位于世界坐标 (12, 8)，默认相机下投影在屏幕中部偏右）
  const box = await page.locator('.tea-garden-3d canvas').boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box.x + box.width * 0.56, box.y + box.height * 0.5)
  // 引文面板出现，且为杭州园的《茶经》原文
  await expect(page.locator('.pavilion-panel')).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.pavilion-quote')).toContainText('上者生烂石')
  await expect(page.locator('.pavilion-source')).toContainText('茶经')
})
