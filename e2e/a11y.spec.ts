import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

/**
 * P1-7 axe-core 无障碍扫描进 CI
 * 验收：核心页面 0 critical / 0 serious（axe 设计为宁可漏报不误报，适合做 CI gate）。
 * 扫公开页面（无需选茶/登录状态）：首页、登录页。
 */
const PAGES: Array<{ path: string; name: string }> = [
  { path: '/', name: '首页' },
  { path: '/login', name: '登录页' },
]

for (const { path, name } of PAGES) {
  test(`${name}（${path}）axe 扫描无 critical/serious 违规`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' })

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    )

    if (blocking.length > 0) {
      const detail = blocking
        .map((v) => {
          const targets = v.nodes.slice(0, 3).map((n) => n.target.join(' '))
          return `${v.impact} [${v.id}] ${v.help}\n  节点: ${targets.join('; ')}`
        })
        .join('\n')
      throw new Error(`axe 发现 ${blocking.length} 个阻断级违规：\n${detail}`)
    }

    expect(results.violations.length).toBeGreaterThanOrEqual(0)
  })
}
