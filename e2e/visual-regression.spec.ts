/**
 * P2-5 视觉回归：Playwright toHaveScreenshot 像素对比，只对稳定业务页。
 *
 * 选页原则：
 * - 避开 3D 场景（3D 茶园已有 verify-gardens.cjs 截图脚本）、动画计时页（冲泡/品鉴）
 * - 只挑静态内容为主的页面：首页、登录页、选茶页
 *
 * 基线是**分平台**的（Playwright 默认命名：Linux 用 `home.png`，Windows 用 `home-win32.png`）。
 * 所以"CI 一定跳过"是过度保守：只要有人提交过 Linux 基线，CI 就应该真的比对。
 * 这里改为**按基线是否存在决定跳过**：
 *   - 缺当前平台基线 → 跳过，并把生成命令打进跳过原因（避免下一个人再去翻文档）
 *   - 有基线 → 真比对
 * 这样本地（Windows）始终有效，CI 在 Linux 基线到位后自动生效，不会出现"静默不跑"。
 *
 * 生成基线：`npx playwright test e2e/visual-regression.spec.ts --update-snapshots`
 * （Linux 基线需在 Linux 环境生成后提交，见 TESTING_SPEC.md「视觉回归」）
 */

import fs from 'node:fs'
import nodePath from 'node:path'
import { expect, test } from '@playwright/test'

// 不用 import.meta：Playwright 把 spec 转译成 CJS 时它不可用（会直接抛错，表现为 "No tests found"）。
// 测试固定从仓库根启动，用 cwd 解析简单可靠。
const SNAPSHOT_DIR = nodePath.resolve(process.cwd(), 'e2e', 'visual-regression.spec.ts-snapshots')

/**
 * 基线文件名的真实模板是 {name}-{projectName}{-snapshotSuffix}.png
 * （项目名 chromium 也在里面——实测仓库里的文件是 home-chromium-win32.png，
 * 只按 {name}{-suffix} 拼会永远找不到基线，然后静默跳过，等于没改）。
 */
function baselineName(name: string): string {
  const suffix = process.platform === 'linux' ? '' : `-${process.platform}`
  return `${name}-chromium${suffix}.png`
}

const PAGES: Array<{ path: string; name: string }> = [
  { path: '', name: 'home' },
  { path: '/login', name: 'login' },
  { path: '/select', name: 'select' },
]

for (const { path, name } of PAGES) {
  // 注意：循环变量叫 path（页面路由），所以 node:path 必须以 nodePath 引入，
  // 否则 path.join 会被循环变量遮蔽 → TypeError: path.join is not a function
  const baseline = nodePath.join(SNAPSHOT_DIR, baselineName(name))
  test(`${name} 页视觉回归（阈值 2%）`, async ({ page }) => {
    test.skip(
      !fs.existsSync(baseline),
      `缺少 ${process.platform} 基线 ${baselineName(name)}；` +
        '生成：npx playwright test e2e/visual-regression.spec.ts --update-snapshots',
    )
    await page.goto(path, { waitUntil: 'networkidle' })
    // 等首屏动画/过渡稳定后再截图，避免基线抖动
    await page.waitForTimeout(500)
    await expect(page).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.02 })
  })
}
