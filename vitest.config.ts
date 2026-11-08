import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // vite-plugin-pwa 的 virtual 模块仅在 Vite 构建时存在；vitest 无该插件，指向 stub 保证可解析
      'virtual:pwa-register': fileURLToPath(
        new URL('./src/test/mocks/virtual-pwa-register.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.ts'],
    // 机器负载下 IndexedDB 类用例（写入 2000+ 条）会超过 vitest 默认 5s；
    // 超时后用例被中断但后台写入仍在跑，会污染后续用例（实测表现为计数对不上），因此统一放宽。
    testTimeout: 15_000,
    // 覆盖率只采集、不设阈值（2026-11-08 拍板）：先积累两周基线数字，再决定门槛，
    // 避免拍脑袋卡线造成假红。报告产物落 coverage/（已在 .gitignore）。
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.{ts,vue}'],
      // 静态数据与测试设施不算被测逻辑；main.ts 只做装配
      exclude: ['src/**/*.spec.ts', 'src/test/**', 'src/data/**', 'src/main.ts'],
    },
  },
})
