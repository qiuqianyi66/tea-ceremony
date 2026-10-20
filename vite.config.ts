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
      // M1 前端联调切片：/api 切到 Spring Boot 新后端（旧 FastAPI 8000 退役，仅 AI 切片前 teaAI 404 自动降级）
      '/api': 'http://localhost:8080',
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
        // 排除项各自的理由：
        //   **/3d/**      3D 贴图与 HDR 共 ~18MB，离线价值低、体积代价大（已实测：排除生效，清单里 0 条）
        //   **/*.map      sourcemap 只在调试时需要
        //   **/og-*.png   仅给社交爬虫读 og:image 用（index.html meta），用户页面从不渲染它，
        //                 却被预缓存 515KB —— 纯浪费，实测占总体积 7%
        //   china-map-*   中国地图 GeoJSON 981KB（src/data/china-map.json，阿里 DataV.GeoAtlas）。
        //                 MapView 以 ?url 按需引入，全站仅 /map 一处使用；预缓存它等于让每个
        //                 访问者在首页就后台下载 1MB 地图数据。改走 runtimeCaching（见下）。
        globIgnores: [
          '**/3d/**',
          '**/*.map',
          '**/og-*.png',
          '**/china-map-*.json',
        ],
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
          {
            // 中国地图 GeoJSON：981KB、仅 /map 使用，不该由全站访问者预下载。
            // 首次进入 /map 时才缓存，之后离线重访 /map 仍可用。
            urlPattern: /china-map-[A-Za-z0-9_-]+\.json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-data',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
