# 前端企业级差距调研（research-frontend）

> 调研时间：2026-09-18
> 范围：「一盏茶」前端距离企业级基线的差距与可执行优化建议。
> 方法：联网核查官方文档（vite-pwa / Sentry / Vue / TypeScript / Playwright / npm / OWASP / web.dev）+ 对照本项目实际配置。
> 标注约定：【官方】= 官方文档明确建议；【一方称】= 第三方博客/文章经验，需自行验证。
> 只读调研：未改任何代码、配置、.env。

---

## 0. 已确认的本项目现状事实（实测，非推断）

| 项 | 现状 | 证据 |
|---|---|---|
| 包管理 | `package-lock.json` 已入库，CI 用 `npm ci` | `.github/workflows/ci.yml` L25/47/63 |
| 代码检查 | **无 ESLint / Biome / Prettier 配置**，只有 `vue-tsc` 类型检查 | 根目录无 eslint.config/biome.json/.prettierrc |
| TS 严格度 | 已开 `noUncheckedIndexedAccess: true`；**未开** `exactOptionalPropertyTypes` / `noPropertyAccessFromIndexSignature` / `verbatimModuleSyntax` | `tsconfig.app.json` |
| 构建分包 | 无 `manualChunks`；`chunkSizeWarningLimit: 1000`（抬高阈值掩盖警告，而非分析） | `vite.config.ts` L15 |
| Sourcemap | 生产构建未配置 sourcemap | `vite.config.ts` 无 `build.sourcemap` |
| PWA | `registerType: 'autoUpdate'` + `skipWaiting: true` + `clientsClaim: true`；无更新提示 UI | `vite.config.ts` L26/105-106 |
| PWA 离线回退 | 未显式配 `navigateFallback`（SPA 深链离线可能 404，需验证） | `vite.config.ts` workbox 段 |
| 安全头 | nginx 已配 CSP / X-Frame-Options / nosniff / Referrer-Policy / Permissions-Policy；**缺** `object-src` / `base-uri` / `frame-ancestors` / `worker-src` / `manifest-src` | `nginx.conf` L11 |
| CSP 遗留 | `connect-src` 含 `https://text.pollinations.ai`（与「AI 必须走后端代理」约束冲突，疑似死配置）；含 `http://backend:8000`（浏览器不可达，仅容器内） | `nginx.conf` L11 |
| XSS 面 | `src/` 全仓 **0 处 `v-html`/`innerHTML`** | Grep 实测 |
| E2E 产物 | CI 失败时上传 `test-results/`，**未配 Playwright trace**，无 `trace: on-first-retry` | `ci.yml` L68-74 |
| 可观测性 | 无前端错误监控 SDK；本地埋点 `tracking.ts` 纯 IndexedDB、无网络外发 | AGENTS.md / 现状说明 |
| 性能基线 | 首屏 load 114ms（本地）、传输 878KB、JS 2.29MB 按需 chunk、3D 纹理 34MB 按需 | `docs/PERF_BASELINE.md` |

---

## 1. Vite 8 生产构建优化

### 1.1 引入 bundle 分析（rollup-plugin-visualizer）
- **为什么**：【官方】Vite 构建文档建议用 `build.rollupOptions.output.manualChunks` 控制分包，并强调先分析再拆；当前项目把 `chunkSizeWarningLimit` 抬到 1000 属于「把警报关了」而非「把包拆了」。引入 visualizer 是看清 2.29MB JS 到底花在哪的第一步。
  - 来源：https://v7.vite.dev/guide/build
  - 【一方称】visualizer 用法（treemap/sunburst、gzipSize/brotliSize）：https://ndlab.blog/posts/part7-5-vite-build-optimization
- **适配度**：✅ 无冲突。devDependency，仅构建时生成 HTML 报告，不进运行时。注意 Vite 8 已迁移 Rolldown/Oxc，需确认 visualizer 对 Rolldown 输出的兼容性。
- **工作量**：0.5 人日（装包 + 接 plugin + 跑一次出图 + 写进 PERF_BASELINE 流程）。
- **风险**：低。仅新增分析产物，不改线上行为。
- **验收标准**：`npm run build` 后产出 `stats.html`；在 PERF_BASELINE.md 附一张 treemap 截图；明确 tres(0.8MB)/echarts(0.46MB)/业务 chunk 各自占比。

### 1.2 vendor 分包（manualChunks）
- **为什么**：【官方】Vite/Rollup 支持 `manualChunks` 把第三方依赖拆出，利用浏览器长缓存——业务代码改 hash 变化时 vendor 不变。当前所有依赖混在路由 chunk 里，发版时用户几乎全量重下。
  - 来源：https://v7.vite.dev/guide/build ；【一方称】vendor 拆分实践：https://webperfclinic.com/fr/article/optimisation-bundle-javascript-vite-2026-code-splitting-tree-shaking
- **适配度**：✅ 无冲突。建议只拆 `vendor-vue`(vue/pinia/vue-router)、`vendor-three`(three/@tresjs/*)、`vendor-charts`(echarts/chart.js)，业务 chunk 不动。
- **工作量**：0.5–1 人日。
- **风险**：中。拆错会引入循环 chunk/重复加载；需跑 build + smoke + 3D 截图验证（`scripts/verify-gardens.cjs`）。
- **验收标准**：`dist/assets/` 下出现独立 vendor-*.js；`/assets/ 1y immutable` 缓存命中下，二次访问 vendor 304/from cache；全量测试不挂。

### 1.3 sourcemap 策略
- **为什么**：【官方/实践】生产环境不应把 sourcemap 发给浏览器（泄露源码 + 体积），但错误监控需要它——标准做法是「构建生成 sourcemap，不上静态服务器，上传到 Sentry」。当前完全没有 sourcemap。
  - 来源：https://docs.sentry.io/platforms/javascript/guides/vue/sourcemaps/uploading/vite/
- **适配度**：✅ 与 1.4 Sentry 联动；若不做 Sentry 则维持不开也可接受（免费自托管、无线上报错排查手段时，sourcemap 收益有限）。
- **工作量**：0.5 人日（配合 Sentry）。
- **风险**：低。务必确认 `dist/*.map` 不被 nginx/PWA precache 吞掉（当前 workbox `globIgnores` 已含 `**/*.map` ✓）。
- **验收标准**：构建产出 `.map` 但 nginx 404 访问 `.map`；Sentry 错误堆栈能映射回源文件行列。

### 1.4 brotli 压缩（远期）
- **为什么**：【一方称】gzip 之外 brotli 对 JS 压缩率通常再高 15–20%。当前 nginx 只开 gzip。
  - 来源：性能优化通用实践（无单一官方强制）。
- **适配度**：⚠️ 需 nginx 加载 brotli 模块（自托管 Docker 镜像需换带模块的 nginx）。
- **工作量**：1 人日（改 Dockerfile/nginx 镜像）。
- **验收标准**：`curl -H 'Accept-Encoding: br'` 返回 `Content-Encoding: br`；传输体积对照 PERF_BASELINE 下降 ≥10%。
- **结论**：P2，免费自托管下收益边际。

---

## 2. PWA / vite-plugin-pwa 企业实践

### 2.1 更新策略：autoUpdate → prompt（**重点，P0**）
- **为什么**：【官方】vite-pwa 文档明确警告：`autoUpdate`（自动 `skipWaiting`）的缺点是「用户正在多个窗口/标签页里填表时可能丢数据」；「如果应用有表单，建议改用默认 `prompt`，让用户决定何时更新」。本项目有品鉴记录表单（用户正在打分/写笔记时被强刷 = 数据丢失）。
  - 来源：https://vite-pwa-org.netlify.app/guide/auto-update.html ；Vue 侧 `useRegisterSW` 返回 `needRefresh`/`updateServiceWorker`：https://vite-pwa-org.netlify.app/frameworks/vue
- **适配度**：✅ 无冲突。`registerType: 'prompt'` + 一个轻量「有新版本，点击刷新」toast（走 `virtual:pwa-register/vue`）。与「浏览器表面定制」「一个编排时刻」设计规范兼容。
- **工作量**：0.5–1 人日（配 prompt + 一个更新提示组件 + 品鉴表单未提交时不弹/或提示保存）。
- **风险**：中。改 `skipWaiting` 行为后，需验证：首次安装、旧版升级、多标签共存三种场景。
- **验收标准**：
  - 品鉴页有未提交评分时，新版本不自动强刷；
  - 出现更新 toast，点「刷新」后 `updateServiceWorker()` 生效；
  - 写一个 e2e：模拟 SW update 事件，断言 toast 出现且表单数据不丢。

### 2.2 SPA 离线深链回退（navigateFallback）
- **为什么**：【官方/实践】PWA 离线后，用户从分享品鉴卡 `/share/xxx` 或书签深链进入，若未配 `navigateFallback: '/index.html'`，Workbox 会对 GET HTML 返回 404。当前未显式配置。
  - 来源：vite-pwa/Workbox 通用实践；离线深链问题参考 https://aitoolsguidebook.com/en/articles/service-worker-serves-stale-after-deploy/
- **适配度**：✅ 无冲突，且直接服务于「品鉴卡可分享、离线优先」核心承诺。
- **工作量**：0.25 人日。
- **风险**：低。需确认不误吞 `/api/`（Workbox 应只对导航请求回退）。
- **验收标准**：断网状态下直接访问 `/brew`、`/share/<token>` 不白屏 404。

### 2.3 PWA 图标完善（远期）
- **为什么**：当前 manifest 只有一张 `pwa-icon.svg`（sizes "any"）。【一方称】主流商店/添加到主屏仍期望 192/512 PNG。
- **适配度**：✅ 无冲突。
- **工作量**：0.5 人日。
- **验收标准**：manifest 含 192/512 PNG icon + maskable 版本。

---

## 3. 性能预算与 Core Web Vitals（RUM）

### 3.1 接入 web-vitals RUM（**P1**）
- **为什么**：【官方】web.dev 把 LCP≤2.5s / INP≤200ms / CLS≤0.1 定为「良好」线；`web-vitals` 库是官方推荐的真实用户度量方式，基于 PerformanceObserver。当前项目只有本地 preview 的实验室数据（PERF_BASELINE.md），没有任何真实用户场数据。
  - 来源：https://web.dev/vitals ；https://www.npmjs.com/package/web-vitals ；INP/LCP 已 Baseline：https://web.developers.google.cn/blog/lcp-and-inp-are-now-baseline-newly-available
- **适配度**：⚠️ 关键取舍——项目原则是「埋点无网络外发」。两个选项：
  - (a) web-vitals 结果写进本地 IndexedDB（与 `tracking.ts` 同模式），仅开发期/手动导出看；
  - (b) 上报到后端 `/api/metrics`（新增后端接口，与「无外发」原则冲突，需用户拍板）。
  - 建议先做 (a)，零网络外发。
- **工作量**：0.5 人日。
- **风险**：低。web-vitals gzipped ~1.5KB。
- **验收标准**：本地/开发环境能打出 LCP/INP/CLS；在 3D 茶室页（重交互）实测 INP；PERF_BASELINE 新增 RUM 章节。

### 3.2 3D + 视频场景的 LCP/INP 注意点
- **为什么**：【官方】3D canvas 不参与 LCP（LCP 看文本/图片），但 three.js 首帧可能卡主线程拉高 INP；Hero 视频三级降级已是好实践。
- **适配度**：✅ 维持现有降级；补一条「3D 初始化移出关键路径 / 用 `requestIdleCallback` 或路由懒加载」即可。
- **工作量**：随 3.1 一起，0 额外。

---

## 4. 前端安全

### 4.1 收紧 CSP（**P0**）
- **为什么**：【官方/OWASP】企业级 CSP 应显式锁定：`object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`（防点击劫持，与现有 X-Frame-Options 双保险）、`worker-src 'self' blob:`（Service Worker 必需）、`manifest-src 'self'`。
  - 来源：https://www.w3.org/TR/2026/WD-CSP3-20260306/ ；https://csp-guide.com/posts/content-security-policy-complete-guide/ ；https://community.owasp.org/controls/SubresourceIntegrity
- **同时清理**：
  - 删除 `connect-src` 里的 `https://text.pollinations.ai`——它与「AI 必须走后端代理、禁止浏览器直连第三方 AI」直接冲突（AGENTS.md 硬约束），若代码已不用就是死配置；若代码还在用 = 违规，必须改走 `/api/ai/*`。**动手前先 Grep 确认是否真有人 fetch pollinations.ai**。
  - `http://backend:8000` 浏览器不可达，无意义，删掉（浏览器侧 API 走同源 `/api` 反代）。
- **适配度**：✅ 无冲突。`script-src 'self'` 已是好基线；`style-src 'unsafe-inline'` 是 Tailwind/Vue scoped 的已知代价，短期保留，远期可改 nonce（成本高，P2）。
- **工作量**：0.5 人日。
- **风险**：中。CSP 收紧后可能误伤（尤其 SW `blob:`、3D 纹理 `img-src`）。**建议先以 `Content-Security-Policy-Report-Only` 上线观察**，确认无 violation 再切 enforce。
- **验收标准**：
  - `curl -I` 响应头含 `object-src 'none'; base-uri 'self'; frame-ancestors 'none'; worker-src 'self'`；
  - 全 e2e + 3D 截图通过；
  - 浏览器控制台 0 条 CSP violation。

### 4.2 SRI（按需，P2）
- **为什么**：【OWASP】SRI 给外部 CDN 脚本/样式钉哈希。但本项目 `script-src 'self'`、字体已自托管、无任何第三方 CDN 脚本——**SRI 在本项目当前架构下无适用对象**。
- **结论**：✅ 已通过「不引外部脚本 + script-src 'self'」达到等价效果，**不需要做 SRI**（属于伪需求）。若未来引入外部 CDN 再补。

### 4.3 供应链安全：CI 加 `npm audit` + Dependabot（**P1**）
- **为什么**：【官方】`npm audit` 向 registry 上报依赖树并出漏洞报告，无漏洞退出 0。【一方称】2025–2026 多起 npm 投毒/同名包攻击，标准护栏是：提交 lockfile（✅ 已有）、CI 用 `npm ci`（✅ 已有）、PR 里跑 audit、Dependabot 自动升补丁版本。
  - 来源：https://docs.npmjs.com/cli/v11/commands/npm-audit/ ；供应链实践：https://jakeinsight.com/tech-economy/2026-03-31-npm-supply-chain-attack-axios-malicious-package-de/
- **适配度**：✅ 无冲突。`socket.dev` 行为扫描（查 install 脚本/外发网络）更强但需第三方账号，**本项目原则下不推荐**；先做免费的 `npm audit --audit-level=high` + GitHub Dependabot 即可。
- **工作量**：0.5 人日（CI 加一个 job + 开 Dependabot）。
- **风险**：低。注意 audit 可能有误报/传递依赖无法修，CI 先设 `continue-on-error` 或只 warn，不立刻挡合并。
- **验收标准**：CI 出现 audit 步骤并输出报告；Dependabot 能自动提 PR 升 patch。

### 4.4 XSS：维持现状（无需动作）
- **为什么**：【官方】Vue 默认 `{{ }}` 自动转义；唯一例外是 `v-html`。本项目实测 0 处 `v-html`/`innerHTML`。
  - 来源：https://vuejs.org/guide/best-practices/security
- **结论**：✅ 无缺口。只需在 code review 规范里加一条「禁止 v-html 渲染不可信数据」即可，零代码。

---

## 5. 前端可观测性（Sentry）

### 5.1 @sentry/vue 轻量集成（**P2，需用户拍板**）
- **为什么**：【官方】`@sentry/vue` + `browserTracingIntegration` 可捕获未捕获异常/路由面包屑；`@sentry/vite-plugin` 在 CI 上传 sourcemap（与 1.3 联动）。后端已有 `SENTRY_DSN` 环境变量，前端接同一个 DSN 是自然延伸。
  - 来源：https://docs.sentry.io/platforms/javascript/guides/vue/ ；https://docs.sentry.io/platforms/javascript/guides/vue/sourcemaps/uploading/vite/
- **适配度**：⚠️ **核心冲突**——项目硬原则「本地埋点无网络外发、免费自托管、不做用户追踪」。Sentry 是云端 SaaS，错误事件会外发。取舍：
  - (a) 接 Sentry 但 `tracesSampleRate: 0.1`、**关闭 Session Replay**（隐私/体积）、DSN 配空时整个 SDK 静默降级（与 AI 茶灵降级模式一致）；
  - (b) 坚持纯本地：写一个 `window.onerror` + `unhandledrejection` 把错误落 IndexedDB，离线排查。
  - **建议 (b) 优先**（0 外部依赖、不违背原则）；(a) 列为 P2 等有线上真实流量再做。
- **工作量**：(b) 0.5 人日；(a) 1–1.5 人日（含 sourcemap 上传）。
- **风险**：(a) 注意不把用户输入/品鉴内容带进 breadcrumb（隐私）。
- **验收标准**：(b) 人为抛错能在 IndexedDB 查到一条结构化错误；(a) Sentry 后台能收到一条测试事件且堆栈可读。

---

## 6. TypeScript 严格度 + Lint

### 6.1 补齐进阶严格标志（**P1**）
- **为什么**：【官方】TypeScript 官方 tsconfig 参考列出的「beyond strict」高推荐项：`noUncheckedIndexedAccess`（✅ 已开）、`exactOptionalPropertyTypes`、`noPropertyAccessFromIndexSignature`、`verbatimModuleSyntax`。
  - 来源：https://www.typescriptlang.org/tsconfig/ ；https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1 ；【一方称】严格 tsconfig 实践：https://gist.github.com/gitaroktato/a29048ac74dec49736cd3e17b47a4288
- **适配度**：⚠️ `exactOptionalPropertyTypes` 一开大概率爆出一批「`?:` 与显式传 `undefined`」的报错，需逐个修；`verbatimModuleSyntax` 要求 type-only import 标 `import type`，与 Vite/vue-tsc 兼容良好。
- **工作量**：1–2 人日（开 `verbatimModuleSyntax` 较快；`exactOptionalPropertyTypes` 视报错量）。
- **风险**：中。属类型层收紧，不改运行时，但可能牵出一批真实小 bug（好事）。
- **验收标准**：`vue-tsc --build` 0 error；不引入 `any`（AGENTS.md 禁令）。

### 6.2 引入 Biome（**P1，企业级明显缺口**）
- **为什么**：项目目前**完全没有 linter**（只有类型检查）。企业级基线至少要有一个 lint gate，拦 `console.log`、未使用变量、`==`、可访问性规则等。Biome 单文件配置、零运行时、比 ESLint 快一个量级，对 Vue+TS 项目是性价比最高选择（ESLint + typescript-eslint + 一堆插件也行，但配置重）。
  - 来源：【一方称，需自行选型验证】Biome/ESLint 对比属社区共识，非单一官方文件。
- **适配度**：✅ 无冲突。devDependency，CI 加 `biome ci` 一步。
- **工作量**：0.5–1 人日（配 + 修首批自动可修问题 + CI）。
- **风险**：低。先 `biome migrate`/`--write` 自动修一遍，剩余手动。
- **验收标准**：`npm run lint` 通过；CI 增加 lint job；`any`/`console`/TODO 可配为 error。

---

## 7. E2E / 单测企业实践

### 7.1 开启 Playwright trace（**P1，低成本高价值**）
- **为什么**：【官方】Playwright 最佳实践明确：CI 失败时用 trace viewer（而非视频/截图），它是可分享的 PWA，含时间线、每步 DOM 快照、网络、控制台；推荐 `trace: 'on-first-retry'` 只在首次重试时开，保持 CI 快。当前项目只上传 `test-results/`，未开 trace。
  - 来源：https://playwright.dev/docs/best-practices ；https://playwright.io/playwright/nodejs/traces-screenshots
- **适配度**：✅ 无冲突。
- **工作量**：0.25 人日（改 `playwright.config.ts` + CI 上传 `trace.zip` artifact）。
- **风险**：低。
- **验收标准**：故意让一个 e2e 失败，CI artifact 里能下到 trace.zip，拖进 trace.playwright.dev 能回放。

### 7.2 视觉回归（部分已有，P2）
- **为什么**：【官方/一方称】Playwright `toHaveScreenshot` 可做组件级视觉回归，建议测组件/区块而非整页、mask 动态区、固定视口、设阈值。项目已有 `verify-gardens/verify-pavilion/verify-icons` 自定义截图脚本——方向一致，但没接断言阈值。
  - 来源：https://stevekinney.com/courses/self-testing-ai-agents/visual-regression-as-a-feedback-loop ；https://qapractices.com/documentation/playwright-visual-regression-testing/
- **适配度**：✅ 无冲突。3D 页面截图受渲染差异影响大，建议只对稳定业务页（茶详情、品鉴卡）做像素阈值，3D 维持现有人工/脚本对比。
- **工作量**：1 人日。
- **验收标准**：2–3 个核心页接 `toHaveScreenshot`（`maxDiffPixelRatio: 0.01`）。

---

## 8. 浏览器表面与 a11y 企业基线

### 8.1 axe-core 进 CI（**P1**）
- **为什么**：【官方/实践】axe-core 是最广泛用的 a11y 引擎，设计上「宁可漏报不误报」，适合做 CI gate；最佳组合是「单测层用 vitest-axe 测组件 + E2E 层用 @axe-core/playwright 测真实页面」。
  - 来源：https://testguild.com/accessibility-testing-tools-automation/ ；https://sujeet.pro/articles/web-foundations/accessibility-standards/accessibility-testing-tooling
- **适配度**：✅ 无冲突，且 AGENTS.md「设计审计 9 条」已把对比度/触控目标列为人工项，axe 把其中可自动化的部分固化。
- **工作量**：0.5–1 人日（接 vitest-axe 对 3–5 个核心组件 + CI gate 拦 critical/serious）。
- **风险**：低。axe 的 `incomplete` 项不挡 CI。
- **验收标准**：核心页面 axe 扫描 0 critical / 0 serious；CI 失败时报告列出违规。

### 8.2 焦点管理 + ARIA live（P1/P2）
- **为什么**：【官方/WCAG 实践】路由切换后焦点应回到主内容（`#main` 或标题）；动态状态（冲泡进度、AI 茶灵回复、保存成功）用 `aria-live="polite"`/`role="status"` 让屏幕阅读器播报。
  - 来源：https://www.uxpin.com/studio/blog/debugging-screen-reader-issues-guide/
- **适配度**：✅ 无冲突。冲泡页是自动流程（零点击闭环），尤其需要 live region 播报状态变化。
- **工作量**：1 人日。
- **验收标准**：Tab 导航不丢焦点；冲泡进度变化时屏幕阅读器能读到（axe + 手动键盘走查）。

---

## 9. 优先级总表（建议落地顺序）

| 优先级 | 优化项 | 工作量 | 一句话理由 |
|---|---|---|---|
| **P0** | 2.1 PWA autoUpdate→prompt（防品鉴表单丢数据） | 0.5–1d | 【官方】直接命中数据丢失风险 |
| **P0** | 4.1 收紧 CSP + 清理 pollinations.ai 死配置 | 0.5d | 与「AI 走后端代理」硬约束对齐 |
| **P1** | 7.1 Playwright trace on-first-retry | 0.25d | 官方推荐、最低成本最高排障收益 |
| **P1** | 6.2 引入 Biome lint gate | 0.5–1d | 目前完全无 lint，企业级明显缺口 |
| **P1** | 8.1 axe-core 进 CI | 0.5–1d | 把设计审计里的 a11y 项自动化 |
| **P1** | 4.3 npm audit + Dependabot | 0.5d | 供应链护栏，免费 |
| **P1** | 1.1 rollup-plugin-visualizer | 0.5d | 拆包前先看清 |
| **P1** | 2.2 navigateFallback 离线深链 | 0.25d | 服务于「分享品鉴卡+离线优先」核心承诺 |
| **P1** | 6.1 补 verbatimModuleSyntax / exactOptionalPropertyTypes | 1–2d | 类型层再收紧 |
| **P1** | 3.1 web-vitals 落本地（不发外网） | 0.5d | 补 RUM，但坚守无外发原则 |
| **P2** | 1.2 manualChunks vendor 拆分 | 0.5–1d | 长缓存收益，需跑 3D 验证 |
| **P2** | 5.1 Sentry/本地错误缓冲（择一） | 0.5–1.5d | 与「无外发」原则冲突，需拍板 |
| **P2** | 8.2 焦点管理 + ARIA live | 1d | 冲泡页自动流程受益最大 |
| **P2** | 7.2 toHaveScreenshot 视觉回归 | 1d | 已有脚本基础上接阈值 |
| **P2** | 1.3 sourcemap（随 Sentry） | 0.5d | 不做 Sentry 则跳过 |
| **P2** | 2.3 PWA PNG 图标 / 1.4 brotli | 各 0.5–1d | 边际收益 |
| **❌ 伪需求** | 4.2 SRI | 0 | 无外部 CDN 脚本，script-src 'self' 已等价 |

---

## 10. 与项目硬约束的冲突登记

| 建议 | 冲突约束 | 取舍 |
|---|---|---|
| web-vitals 上报 (b) 发 `/api/metrics` | 「埋点无网络外发」 | 改成本地 IndexedDB (a)，不做后端上报 |
| Sentry SaaS | 「免费自托管 / 无外发 / 不追踪用户」 | 优先本地错误缓冲；Sentry 列 P2 且关 Replay、DSN 空时降级 |
| brotli 模块 | 「自托管 Docker」 | 需换 nginx 镜像，P2 边际收益 |
| CSP `style-src` 去 `unsafe-inline` | Tailwind/Vue scoped 现状 | 改 nonce 成本高，短期保留，标注已知技术债 |
| 任何「新增页面」 | 「不新增页面」 | 本报告所有项均不加路由/页面，只在现有组件上加 toast/region |

---

## 11. 来源清单

**官方文档**
- Vite 生产构建（manualChunks）：https://v7.vite.dev/guide/build
- vite-pwa autoUpdate 风险与 prompt：https://vite-pwa-org.netlify.app/guide/auto-update.html
- vite-pwa Vue useRegisterSW：https://vite-pwa-org.netlify.app/frameworks/vue
- Web Vitals 标准：https://web.dev/vitals
- web-vitals npm：https://www.npmjs.com/package/web-vitals
- INP/LCP Baseline：https://web.developers.google.cn/blog/lcp-and-inp-are-now-baseline-newly-available
- Sentry Vue：https://docs.sentry.io/platforms/javascript/guides/vue/
- Sentry Vite sourcemap 上传：https://docs.sentry.io/platforms/javascript/guides/vue/sourcemaps/uploading/vite/
- Vue 安全（自动转义/v-html）：https://vuejs.org/guide/best-practices/security
- TypeScript tsconfig 参考：https://www.typescriptlang.org/tsconfig/
- npm audit：https://docs.npmjs.com/cli/v11/commands/npm-audit/
- Playwright 最佳实践/trace：https://playwright.dev/docs/best-practices
- CSP Level 3（W3C）：https://www.w3.org/TR/2026/WD-CSP3-20260306/
- OWASP SRI：https://community.owasp.org/controls/SubresourceIntegrity

**一方经验（需自行验证）**
- bundle 分析 manualChunks：https://ndlab.blog/posts/part7-5-vite-build-optimization
- 2026 Vite code splitting：https://webperfclinic.com/fr/article/optimisation-bundle-javascript-vite-2026-code-splitting-tree-shaking
- SW 旧缓存/深链问题：https://aitoolsguidebook.com/en/articles/service-worker-serves-stale-after-deploy/
- CSP 实用清单：https://csp-guide.com/posts/content-security-policy-complete-guide/
- npm 供应链攻击防护：https://jakeinsight.com/tech-economy/2026-03-31-npm-supply-chain-attack-axios-malicious-package-de/
- 严格 tsconfig 实践：https://gist.github.com/gitaroktato/a29048ac74dec49736cd3e17b47a4288
- axe a11y 分层：https://testguild.com/accessibility-testing-tools-automation/
- Playwright 视觉回归：https://stevekinney.com/courses/self-testing-ai-agents/visual-regression-as-a-feedback-loop
- ARIA live / 焦点：https://www.uxpin.com/studio/blog/debugging-screen-reader-issues-guide/
