import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import tresCompilerOptions from '@tresjs/core/template-compiler-options'

export default defineConfig({
  // GitHub Pages 使用项目子路径，本地和 Docker 部署保持根路径。
  base: process.env.GITHUB_ACTIONS === 'true' ? '/tea-ceremony/' : '/',
  build: {
    // Three.js/TresJS 库 chunk 约 0.8MB，单一依赖不可再拆且已路由懒加载，提高阈值消除误报。
    // 业务 chunk（MapView 等）已通过地图数据外置 + echarts 按需控制在 500kB 内。
    chunkSizeWarningLimit: 1000,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  plugins: [
    vue(tresCompilerOptions),
    tailwindcss(),
    VitePWA({
      // prompt 模式：新版本就绪后由用户确认才更新，禁止 autoUpdate 强刷丢表单数据（vite-pwa 官方警告）
      registerType: 'prompt',
      // 自行注册（PwaUpdateToast）以接收 needRefresh 回调
      injectRegister: null,
      includeAssets: ['favicon.ico', 'pwa-icon.svg'],
      manifest: {
        name: '一盏茶 — 沉浸式在线茶道体验',
        short_name: '一盏茶',
        description: '沉浸式在线茶道体验 — 选茶、煮水、冲泡、品鉴，感受工夫茶之道',
        lang: 'zh-CN',
        theme_color: '#5D4E37',
        background_color: '#FAF6F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        screenshots: [],
        categories: ['lifestyle', 'education', 'entertainment'],
        shortcuts: [
          {
            name: '开始冲泡',
            short_name: '冲泡',
            description: '进入冲泡页面开始泡茶',
            url: '/brew',
            icons: [{ src: 'pwa-icon.svg', sizes: '192x192' }],
          },
          {
            name: '品鉴记录',
            short_name: '记录',
            description: '查看历史品鉴笔记',
            url: '/history',
            icons: [{ src: 'pwa-icon.svg', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,webm,mp3,woff2,jpg,png,json}'],
        globIgnores: ['**/3d/**', '**/*.map'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:webm|mp3|ogg)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // 3D 纹理大图（单张 2-6MB）不走预缓存，首次加载后 CacheFirst
            urlPattern: /\/3d\/.*\.(?:jpg|png)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: '3d-textures',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        // prompt 模式：不自动 skipWaiting/clientsClaim，新 SW 等用户确认后由 updateSW(true) 激活
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
