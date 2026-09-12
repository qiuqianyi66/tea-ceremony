/**
 * 茶灵 AI 对话页（/ai）E2E：
 * - 空输入禁用发送
 * - 建议问题直接发送并收到规则回复
 * - 单轮提问 → 规则降级回复（preview 无后端，fetch 404 → ruleBasedReply）
 * - 防"绿茶茶"文本回归（9c2cdc5）：茶名回复中 type 不重复
 * 注意：teaAI 有 15s 限流，每个 test 至多发一次真实提问。
 */
import { test, expect } from '@playwright/test'

test('AIAsk：空输入时发送按钮禁用', async ({ page }) => {
  await page.goto('ai')

  await expect(page.getByText('有什么关于茶的问题想问？')).toBeVisible()
  const sendBtn = page.getByRole('button', { name: '发送' })
  await expect(sendBtn).toBeDisabled()
})

test('AIAsk：建议问题点击直接发送并收到回复', async ({ page }) => {
  await page.goto('ai')

  await page.getByRole('button', { name: '绿茶用什么茶器最好？' }).click()
  // 点建议直接发送：用户气泡 + AI 规则回复（绿茶类基准参数）
  await expect(page.locator('.ai-user-bubble', { hasText: '绿茶用什么茶器最好？' })).toBeVisible()
  await expect(page.locator('.ai-ai-bubble').last()).toContainText(/80-85℃/, { timeout: 15_000 })
})

test('AIAsk：提问收到规则降级回复（茶类参数）', async ({ page }) => {
  await page.goto('ai')

  await page.getByPlaceholder('问茶灵一个问题...').fill('绿茶怎么泡')
  await page.getByRole('button', { name: '发送' }).click()

  // 用户气泡 + AI 回复（降级：绿茶类基准参数）
  await expect(page.locator('.ai-user-bubble', { hasText: '绿茶怎么泡' })).toBeVisible()
  await expect(page.locator('.ai-ai-bubble').last()).toContainText(/80-85℃/, { timeout: 15_000 })
  // loading 已消失
  await expect(page.locator('.ai-thinking')).toHaveCount(0)
})

test('AIAsk：茶名提问回复含冲泡参数且无"绿茶茶"回归', async ({ page }) => {
  await page.goto('ai')

  await page.getByPlaceholder('问茶灵一个问题...').fill('西湖龙井怎么泡')
  await page.getByRole('button', { name: '发送' }).click()

  // 规则回复格式：西湖龙井：绿茶，宜 80℃ 水温…（type 不重复为"绿茶茶"）
  const reply = page.locator('.ai-ai-bubble').last()
  await expect(reply).toContainText('西湖龙井', { timeout: 15_000 })
  await expect(reply).toContainText('宜 80℃ 水温')
  await expect(reply).not.toContainText('绿茶茶')
})

test('AIAsk：关闭按钮返回首页', async ({ page }) => {
  await page.goto('ai')
  await page.getByRole('button', { name: '关闭茶灵' }).click()
  await expect(page).toHaveURL(/\/$/)
})
