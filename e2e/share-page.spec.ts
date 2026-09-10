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

const TEA_SAMPLE = {
  teaId: 'longjing',
  teaName: '西湖龙井',
  teaType: '绿茶',
  origin: '浙江杭州',
  flavor: ['豆香', '栗香', '鲜爽'],
  description: '中国十大名茶之首。',
}

test('分享页：茶知识链接渲染名茶卡（只读）', async ({ page }) => {
  const encoded = encodeShare(TEA_SAMPLE)
  await page.goto(`share?t=${encoded}`)

  await expect(page.getByText('一杯好茶，值得分享')).toBeVisible()
  await expect(page.getByText('西湖龙井', { exact: true })).toBeVisible()
  await expect(page.getByText('绿茶 · 浙江杭州')).toBeVisible()
  // 只读模式：不显示操作按钮
  await expect(page.getByRole('button', { name: '分享链接' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /探索更多名茶/ })).toBeVisible()
})

// ============ P1-4 边界补强：非法输入变体与参数优先级 ============

test('分享页：合法 base64 但内容非 JSON 显示错误态', async ({ page }) => {
  const notJson = Buffer.from('plain text not json').toString('base64url')
  await page.goto(`share?r=${notJson}`)
  await expect(page.getByText('这份品鉴分享无效或已损坏')).toBeVisible()
})

test('分享页：JSON 缺必需字段显示错误态', async ({ page }) => {
  const partial = Buffer.from(JSON.stringify({ teaName: '西湖龙井' })).toString('base64url')
  await page.goto(`share?r=${partial}`)
  await expect(page.getByText('这份品鉴分享无效或已损坏')).toBeVisible()
})

test('分享页：dimensions 缺维度显示错误态', async ({ page }) => {
  const badDims = { ...SAMPLE, dimensions: { bitterness: 2, sweetness: 4 } }
  await page.goto(`share?r=${encodeShare(badDims)}`)
  await expect(page.getByText('这份品鉴分享无效或已损坏')).toBeVisible()
})

test('分享页：r 与 t 并存时 r 优先渲染品鉴卡', async ({ page }) => {
  const r = encodeShare(SAMPLE)
  const tBroken = Buffer.from('broken').toString('base64url')
  await page.goto(`share?r=${r}&t=${tBroken}`)
  await expect(page.getByText('他人分享的一席茶')).toBeVisible()
  await expect(page.getByText('西湖龙井', { exact: true })).toBeVisible()
})

test('分享页：r 无效但 t 有效时渲染茶知识卡', async ({ page }) => {
  await page.goto(`share?r=broken-input&t=${encodeShare(TEA_SAMPLE)}`)
  await expect(page.getByText('一杯好茶，值得分享')).toBeVisible()
})
