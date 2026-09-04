/**
 * 品鉴卡分享页 E2E：
 * - 有效编码参数 → 只读渲染品鉴卡
 * - 无效 / 缺失参数 → 错误态 + 回首页
 */
import { test, expect } from '@playwright/test'

/** 用 Node 构造 base64url（与 src/services/share.ts 的编码兼容）。 */
function encodeShare(record: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(record)).toString('base64url')
}

const SAMPLE = {
  teaName: '西湖龙井',
  date: '2026-09-03',
  brewTemp: 80,
  brewTime: 45,
  infusions: 1,
  dimensions: { bitterness: 2, sweetness: 4, aftertaste: 5, body: 3, aroma: 5, rhyme: 4, shape: 3, mind: 5 },
  overallScore: 8.6,
  processFactor: 0.92,
  aromaType: '花香',
  weather: '晴',
  mood: '安静',
  notes: '豆香清雅，回甘悠长。',
}

test('分享页：有效链接渲染品鉴卡（只读）', async ({ page }) => {
  const encoded = encodeShare(SAMPLE)
  await page.goto(`share?r=${encoded}`)

  await expect(page.getByText('他人分享的一席茶')).toBeVisible()
  await expect(page.getByText('西湖龙井', { exact: true })).toBeVisible()
  await expect(page.getByText('8.6', { exact: true })).toBeVisible()
  // 只读模式：不显示操作按钮
  await expect(page.getByRole('button', { name: '分享链接' })).toHaveCount(0)
  // 提供返回入口
  await expect(page.getByRole('button', { name: /打开「一盏茶」/ })).toBeVisible()
})

test('分享页：无效参数显示错误态并可回首页', async ({ page }) => {
  await page.goto('share?r=this-is-not-valid-base64url!!!')
  await expect(page.getByText('这份品鉴分享无效或已损坏')).toBeVisible()

  await page.getByRole('button', { name: '回到首页' }).click()
  await expect(page.getByRole('button', { name: /入\s*席/ })).toBeVisible()
})

test('分享页：缺失参数显示错误态', async ({ page }) => {
  await page.goto('share')
  await expect(page.getByText('这份品鉴分享无效或已损坏')).toBeVisible()
})
