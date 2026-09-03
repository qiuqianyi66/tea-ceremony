import { defineConfig, devices } from '@playwright/test'

// GitHub Actions 中 Vite base 为 /tea-ceremony/（与 Pages 一致），本地为 /
const port = 4173
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'
const basePath = isGitHubActions ? '/tea-ceremony/' : '/'

export default defineConfig({
  testDir: './e2e',
  // 完整冲泡为真实计时（加热约 5s、醒茶 5s、3 泡），预留充足超时。
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${port}${basePath}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // headless 下静音，避免音频设备相关告警
      args: ['--mute-audio'],
    },
  },
  webServer: {
    command: `npm run build-only && npm run preview -- --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    // 必须用完整 Chromium 的 new-headless 模式：chromium-headless-shell 会拒绝
    // IndexedDB API（"access to the Indexed Database API is denied"），导致 Dexie 初始化失败白屏。
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chromium' } },
  ],
})
