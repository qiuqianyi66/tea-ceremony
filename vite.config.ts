import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { VitePWA } from 'vite-plugin-pwa'
import tresCompilerOptions from '@tresjs/core/template-compiler-options'

// GitHub Pages 使用项目子路径，本地和 Docker 部署保持根路径。
const base = process.env.GITHUB_ACTIONS === 'true' ? '/tea-ceremony/' : '/'

export default defineConfig({
  base,
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
    // P2-4：包体积诊断，仅 VISUALIZE=1 时生成 stats.html（不常驻构建/CI）
    ...(process.env.VISUALIZE === '1'
      ? [visualizer({ filename: 'stats.html', gzipSize: true, brotliSize: true })]
      : []),
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
            // 3D 纹理大图（jpg 单张 2-6MB；P2-8 起优先 KTX2 ~0.9MB/张）不走预缓存，
            // 首次加载后 CacheFirst；basis transcoder（wasm/js）同目录一并缓存
            urlPattern: /\/3d\/.*\.(?:jpg|png|ktx2|wasm|js)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: '3d-textures',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        // P1-8：SPA 离线深链回退——离线后从 /share/<token>、/brew 等深链进入不白屏 404，
        // 由 index.html 承接导航请求后交给前端路由。API/探针请求不回退（离线应直接失败走降级）。
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api/, /^\/live/, /^\/ready/, /^\/metrics/, /^\/health/],
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
