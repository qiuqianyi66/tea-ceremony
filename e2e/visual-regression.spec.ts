/**
 * P2-5 视觉回归：Playwright toHaveScreenshot 像素对比，只对稳定业务页。
 *
 * 选页原则：
 * - 避开 3D 场景（3D 茶园已有 verify-gardens.cjs 截图脚本）、动画计时页（冲泡/品鉴）
 * - 只挑静态内容为主的页面：首页、登录页、选茶页
 *
 * CI 策略：基线在本地（Windows）生成，GitHub Actions（Ubuntu）字体渲染不同会导致
 * 像素级误报。故 CI 跳过，本地 `npx playwright test e2e/visual-regression.spec.ts` 手动维护。
 * 基线更新：`npx playwright test e2e/visual-regression.spec.ts --update-snapshots`
 */

import { expect, test } from '@playwright/test'

test.skip(!!process.env.CI, '视觉回归基线为本地生成，CI（Linux 字体）会像素误报')

const PAGES: Array<{ path: string; name: string }> = [
  { path: '', name: 'home' },
  { path: '/login', name: 'login' },
  { path: '/select', name: 'select' },
]

for (const { path, name } of PAGES) {
  test(`${name} 页视觉回归（阈值 2%）`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' })
    // 等首屏动画/过渡稳定后再截图，避免基线抖动
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.02 })
  })
}
