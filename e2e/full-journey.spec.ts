/**
 * E2E 完整流程测试：首页 → 入席 → 选茶 → 选茶器 → 冲泡 → 品鉴 → 保存记录
 *
 * 冲泡为真实计时（不伪造时钟），完整流程约 40~60 秒。
 */

import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // 拦截第三方 AI 请求，让茶记生成快速走本地规则降级，保证测试稳定且不依赖外网。
  await page.route('**/*pollinations*', route => route.abort())
  // 渲染崩溃时打印错误栈，便于 CI 排障
  page.on('pageerror', err => console.log('[PAGEERROR]', err.stack || err.message))
})

/** 走完冲泡流程（西湖龙井 3 泡），到达「开始品鉴」并跳转品鉴页。 */
async function completeBrewing(page: Page) {
  // IDLE：开始煮水
  await page.getByRole('button', { name: '开始煮水' }).click()

  // HEATING 自动升温到目标温度（约 5s）→ 自动进入 WARMING
  await page.getByRole('button', { name: /温杯/ }).click()

  // WARMING → 0.8s 后 RINSING（醒茶 5s 倒计时）→ 自动 READY
  await page.getByRole('button', { name: /开始冲泡/ }).click()

  // 循环 3 泡：STEEPING 主按钮出汤 → 出汤完成推进下一泡
  for (let infusion = 1; infusion <= 3; infusion++) {
    await page.getByRole('button', { name: /出汤 \(/ }).click()
    if (infusion < 3) {
      await page.getByRole('button', { name: '出汤完成 · 下一泡' }).click()
    }
  }

  // 最后一泡结束 → 出汤完成进入品鉴
  await page.getByRole('button', { name: '出汤完成 · 开始品鉴' }).click()
  await page.waitForURL('**/taste')
}

test('完整品鉴流程：首页→入席→选茶→选器→冲泡→品鉴→保存', async ({ page }) => {
  // ============ 1. 首页 ============
  // 相对 baseURL（GitHub Pages base 为 /tea-ceremony/，本地为 /），避免前导斜杠绕过前缀
  await page.goto('')
  await expect(page.getByRole('button', { name: /入\s*席/ })).toBeVisible()
  await page.getByRole('button', { name: /入\s*席/ }).click()
  await page.waitForURL('**/tearoom')

  // ============ 2. 入席 ============
  // 迎宾弹窗 5 秒后自动关闭：若仍可见则点击关闭，否则跳过。
  await page.getByRole('button', { name: '进入茶席' }).click({ timeout: 5000 }).catch(() => {})
  // 快速入口直达选茶
  await page.getByRole('button', { name: /直接选茶/ }).click()
  await page.waitForURL('**/select')

  // ============ 3. 选茶 ============
  await expect(page.getByRole('heading', { name: '选茶' })).toBeVisible()
  await page.getByText('西湖龙井', { exact: true }).first().click()
  await page.getByRole('button', { name: '选择 西湖龙井' }).click()
  await page.waitForURL('**/tools')

  // ============ 4. 选茶器 ============
  await expect(page.getByRole('heading', { name: '备器 · 择水' })).toBeVisible()
  await page.getByRole('button', { name: /白瓷盖碗/ }).click()
  await page.getByRole('button', { name: /山泉|泉水|纯净|山涧|雨水|井水/ }).first().click()
  await page.getByRole('button', { name: '开始冲泡 →' }).click()
  await page.waitForURL('**/brew')

  // ============ 5. 冲泡 ============
  await expect(page.getByRole('heading', { name: '冲泡' })).toBeVisible()
  await expect(page.getByText('西湖龙井', { exact: true })).toBeVisible()
  await completeBrewing(page)

  // ============ 6. 品鉴 ============
  await expect(page.getByRole('heading', { name: '品鉴' })).toBeVisible()
  // ① 观色
  await page.getByRole('button', { name: '观色完成，继续闻香' }).click()
  // ② 闻香
  await page.getByRole('button', { name: '花香' }).click()
  await page.getByRole('button', { name: '闻香完成，开始品味' }).click()
  // ③ 品味：调整两个维度评分、选天气心情、写笔记
  await page.locator('input[type="range"]').nth(0).fill('5')
  await page.locator('input[type="range"]').nth(1).fill('4')
  await page.getByRole('button', { name: '晴' }).click()
  await page.getByRole('button', { name: '安静' }).click()
  await page.getByPlaceholder('记录你的品茶感受...').fill('西湖龙井，豆香清雅，回甘悠长。')
  await page.getByRole('button', { name: '完成品鉴' }).click()

  // ============ 7. 结果与保存 ============
  await expect(page.getByText('品鉴结果')).toBeVisible()
  // 品鉴卡片渲染茶名与评分
  await expect(page.getByText('西湖龙井').first()).toBeVisible()

  // ============ 8. 历史记录可查 ============
  await page.goto('history')
  await expect(page.getByText('西湖龙井').first()).toBeVisible()
})
