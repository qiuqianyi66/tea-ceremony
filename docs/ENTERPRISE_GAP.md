# 「一盏茶」企业级优化差距报告（ENTERPRISE_GAP）

> 生成时间：2026-09-18
> 调研方式：只读联网调研 + 项目代码实核，未改任何代码/配置/.env，未消耗 DeepSeek key。
> 三路调研底稿：
> - `docs/research-frontend.md`（前端企业级差距，含官方文档 URL）
> - `docs/research-backend.md`（后端企业级差距，含官方文档 URL）
> - `docs/research-github.md`（GitHub 同类项目横纵分析）
> 可信度标注：【官方】= 官方文档明确建议；【社区】= 一方博客/教程称，需自行验证；【实见】= 在本仓库文件里实际读到。
> 规模假设：单用户/小团队自托管，非多租户 SaaS。所有"企业级"建议按此规模裁剪，不堆微服务/K8s/服务网格。

---

## 一、现状能力对照企业级基线

### 1.1 对照 12-Factor App

| Factor | 要求 | 本项目现状【实见】 | 差距 |
|---|---|---|---|
| I 基准代码 | 一份代码多部署 | ✅ 同一份代码 dev/prod 用不同 .env | 无 |
| II 依赖显式声明 | 显式锁定 | ✅ package-lock + requirements；bcrypt==4.0.1 锁死 | 无 |
| III 配置存在环境 | 配置与代码分离 | ✅ backend/app/config.py 全走 os.environ + 启动 fail-fast | 未校验 SECRET_KEY 长度/熵 |
| IV 后端服务外置 | 附加资源 | ✅ PostgreSQL/Redis 独立容器 | 无 |
| V 构建发布运行分离 | 一次性构建 | ⚠️ Dockerfile 单阶段、root 运行 | 镜像 ~1.2GB，可减半 |
| VI 无状态进程 | 进程无状态 | ✅ JWT 无状态；Redis 仅限流计数 | 无 |
| VII 端口绑定 | 端口导出 | ✅ uvicorn 0.0.0.0:8000 | 无 |
| VIII 并发 | 进程模型 | ⚠️ 单 uvicorn worker，未上 gunicorn | 单用户够用，P1 |
| IX 易处置 | 快速启动/优雅关闭 | ⚠️ 无 SIGTERM 优雅关闭处理 | 容器重启可能丢在途请求 |
| X 开发生产等价 | 环境一致 | ✅ Docker Compose 本地起全栈 | 无 |
| XI 日志当事件流 | 日志到 stdout | ⚠️ logging.basicConfig 纯文本非 JSON；nginx 写文件 | 无 request_id 贯穿 |
| XII 管理任务一次性 | 迁移一次性进程 | ✅ alembic upgrade 独立；CI 有 migration-test job | 无 |

### 1.2 对照 OWASP API Security Top 10 (2023)

| 风险 | 现状【实见】 | 差距 |
|---|---|---|
| API1 BOLA 失效对象级授权 | ✅ records 全端点带 user.id 过滤，用户隔离已实测 | 无 |
| API2 失效认证 | ⚠️ JWT 30 天过期无 refresh；登录/注册无专项限流（全局 300/60s 对爆破太宽） | P0 |
| API3 对象属性级授权 | ✅ Pydantic v2 schema 与 ORM 分离 | 无 |
| API4 资源消耗 | ⚠️ 全局限流 300/60s 对 /api/ai/* 花钱出口太松；无超时/重试/熔断 | P0 |
| API5 安全配置错误 | ⚠️ Docker 跑 root；CSP 残留死域名；uvicorn 未接 proxy-headers | P0 |
| API6 服务端请求伪造 | ✅ AI 代理在后端；但 connect-src 残留 pollinations.ai（死配置） | 清理 |
| API7 服务端安全配置 | ✅ Nginx 安全头全套；缺 HSTS（HTTP 阶段不需要） | 上线公网前补 |
| API8 软件与数据完整性 | ⚠️ 无 npm audit / pip-audit / Dependabot；无容器镜像扫描 | P1 |
| API9 不安全的生产配置 | ⚠️ SENTRY_DSN 已留位但未启用；无 /metrics；无 request_id | P1 |
| API10 未充分的日志监控 | ⚠️ 日志无结构化、无 request_id | P1 |

### 1.3 对照 SRE 四大黄金信号

| 信号 | 现状 | 差距 |
|---|---|---|
| 延迟 Latency | ⚠️ 无 per-route p50/p99 指标 | 无 /metrics |
| 流量 Traffic | ⚠️ 无请求计数指标 | 无 /metrics |
| 错误 Errors | ⚠️ SENTRY_DSN 留位未启用；前端无错误缓冲 | P1 |
| 饱和 Saturation | ⚠️ 无 DB 连接池/Redis 内存指标 | 单用户暂不需要 |

### 1.4 对照前端企业级基线

| 维度 | 现状【实见】 | 差距 |
|---|---|---|
| 类型严格度 | ✅ noUncheckedIndexedAccess 已开；未开 exactOptionalPropertyTypes / verbatimModuleSyntax | P1 |
| Lint | ❌ **全仓无任何 linter**（只有 vue-tsc） | P1 明显缺口 |
| 构建分包 | ⚠️ 无 manualChunks；chunkSizeWarningLimit 抬到 1000 掩盖警告 | P2 |
| PWA 更新策略 | ⚠️ autoUpdate + skipWaiting 硬刷，**官方文档明确警告有表单的应用会丢数据** | **P0 数据风险** |
| PWA 离线深链 | ⚠️ 未配 navigateFallback，离线深链可能 404 | P1 |
| 前端安全 | ✅ 0 处 v-html；script-src 'self'；锁文件 + npm ci | 缺 CSP 补全 + 供应链扫描 |
| E2E 可排障 | ⚠️ 未开 Playwright trace，只上传 test-results | P1 |
| a11y | ✅ 设计审计人工 9 条；未接 axe-core 自动化 | P1 |
| RUM | ❌ 无 web-vitals 真实用户数据（只有实验室 PERF_BASELINE） | P1 |
| 性能 | ✅ 首屏 114ms / 878KB；3D 纹理按需；图片已压缩 | 接近基线 |

---

## 二、优化建议清单

### P0：低成本高价值，建议立即做（合计约 2 人天）

#### P0-1 修复真实客户端 IP 识别 bug（限流按 Docker 网关 IP 算）

- **优化点**：uvicorn 启动加 `--proxy-headers --forwarded-allow-ips=172.16.0.0/12`（Docker 网桥）。
- **为什么**：【官方】https://fastapi.tiangolo.com/advanced/behind-a-proxy/ 明确 `--forwarded-allow-ips` 用于信任代理头。当前 Nginx 已正确传 `X-Forwarded-For`，但 uvicorn 默认不解析，`request.client.host` 永远是 Docker 网关 IP。**后果是 bug 级**：所有用户共享一个限流 key，一人刷爆全员 429；日志也看不到真实 IP。
- **工作量**：0.5 人时
- **风险**：低。`--forwarded-allow-ips` 不能设 `*`（否则外网可伪造 X-Forwarded-For 绕过限流）。
- **验收**：`curl -H "X-Forwarded-For: 1.2.3.4" .../api/...` 后 access log 出现 `1.2.3.4`；新增 pytest mock XFF 断言限流 key 含真实 IP。

#### P0-2 显式配置数据库连接池

- **优化点**：`create_async_engine` 加 `pool_size=5, max_overflow=10, pool_recycle=300, pool_pre_ping=True`。
- **为什么**：【官方】https://docs.sqlalchemy.org/en/20/core/pooling.html 说明 recycle/pre_ping 语义。当前用默认值（pool_recycle=-1），Postgres 空闲 5 分钟后主动断连，应用拿到死连接报错。
- **工作量**：0.5 人时
- **风险**：低。pool_pre_ping 有 ~1ms 开销。
- **验收**：重启 PostgreSQL 后下一个请求不抛 AsyncpgConnectionError，自动重连。

#### P0-3 PWA 自动更新改 prompt（防品鉴表单丢数据）

- **优化点**：vite.config.ts `registerType: 'autoUpdate'` 改 `'prompt'`，接 `virtual:pwa-register/vue` 的 `useSW()`，出现 `needRefresh` 时弹"有新版本，点击刷新"toast。
- **为什么**：【官方】https://vite-pwa-org.netlify.app/guide/auto-update.html 明确警告：`autoUpdate`（自动 skipWaiting）的缺点是"用户正在多个窗口/标签页里填表时可能丢数据"；有表单的应用应改用 prompt。**本项目品鉴页用户正在打分/写笔记时被强刷 = 数据丢失，这是真实事故风险。**
- **工作量**：0.5–1 人日（含品鉴表单未提交时不弹/提示保存的 e2e）
- **风险**：中。需验证首次安装、旧版升级、多标签共存三种场景。
- **验收**：品鉴页有未提交评分时新版本不自动强刷；点"刷新"后 `updateServiceWorker()` 生效；e2e 模拟 SW update 事件断言 toast 出现且表单数据不丢。

#### P0-4 收紧并清理 CSP

- **优化点**：nginx.conf 第 11 行 CSP 改为：
  - 删除 `connect-src` 里的 `https://text.pollinations.ai`（已 Grep 实核代码零引用，死配置，且与"AI 必须走后端代理"硬约束冲突）
  - 删除 `connect-src` 里的 `http://backend:8000`（浏览器不可达）
  - 从 `style-src` / `font-src` 删除 `https://fonts.googleapis.com` / `https://fonts.gstatic.com`（已 Grep index.html 实核无 Google Fonts link，字体已自托管 @font-face，与 AGENTS.md"生产禁 Google Fonts link"对齐）
  - 补 `object-src 'none'`、`base-uri 'self'`、`frame-ancestors 'none'`、`worker-src 'self' blob:`、`manifest-src 'self'`
- **为什么**：【官方/OWASP】https://www.w3.org/TR/2026/WD-CSP3-20260306/ ；【实见】nginx.conf 当前配置。
- **工作量**：0.5 人日
- **风险**：中。**先以 `Content-Security-Policy-Report-Only` 上线观察**，确认无 violation 再切 enforce。
- **验收**：`curl -I` 响应头含补全指令；全 e2e + 3D 截图通过；浏览器控制台 0 条 CSP violation。

#### P0-5 安全化 Dockerfile（多阶段 + non-root + .dockerignore）

- **优化点**：
  1. 多阶段：builder 装依赖，runtime 只拷贝 site-packages + 应用代码。
  2. 创建非 root 用户 `app`，`USER app`。
  3. 加 `.dockerignore` 排除 `.venv/`、`__pycache__/`、`.env`、`tests/`。
- **为什么**：【官方】https://docs.docker.com/guides/python/develop/ ；https://fastapi.tiangolo.com/deployment/docker/ 。当前单阶段 root 运行，镜像 ~1.2GB，容器逃逸即 root。
- **工作量**：1 人时
- **风险**：低。日志走 stdout 即可。
- **验收**：`docker run --rm <image> id` 输出非 root；镜像降到 ~200-300MB；`docker compose up` 后 /health 200。

#### P0-6 登录/注册专项限流 + /api/ai/* 加严

- **优化点**：
  - `/api/auth/login` 与 `/api/auth/register` 单独限流：10 次/5 分钟/IP。
  - `/api/ai/*` 单独限流：10 次/分钟/IP（花钱出口，当前全局 300/60s 太松）。
- **为什么**：【官方】OWASP API2:2023 https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/ 要求登录接口"only three requests per minute"。/api/ai/* 是 DeepSeek token 花钱出口。
- **工作量**：0.5 人时（两项）
- **风险**：低。
- **验收**：脚本连打 11 次登录第 11 个 429；连打 11 次 /api/ai/ask 第 11 个 429 带 Retry-After。

#### P0-7 AI 代理异步化 + 轻量重试

- **优化点**：`ai.py` 路由从 `def` 改 `async def`，`httpx.Client` 改 `httpx.AsyncClient`；对 5xx/超时做 1 次指数退避重试（4xx 不重试）。
- **为什么**：当前同步 `def` 路由占线程；DeepSeek 偶发 5xx 直接 502 触发前端降级。
- **工作量**：1 人时
- **风险**：低。重试总耗时不超 Nginx `proxy_read_timeout 30s`。
- **验收**：mock DeepSeek 第一次 500 第二次 200 断言最终 200；连续 4xx 不重试。

#### P0-8 SECRET_KEY 启动时校验强度

- **优化点**：现有启动校验只查非空，加最小长度（≥32 字符）。
- **为什么**：弱 SECRET_KEY 可被爆破伪造 JWT。【官方】https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/ 用 `secrets.token_urlsafe(32)` 示例。
- **工作量**：0.2 人时
- **验收**：SECRET_KEY 改成 `short` 后启动直接 RuntimeError。

#### P0-9 TrustedHostMiddleware（防 Host 头攻击）

- **优化点**：`main.py` 加 `app.add_middleware(TrustedHostMiddleware, allowed_hosts=[...])`，域名走环境变量 `ALLOWED_HOSTS`。
- **为什么**：FastAPI 默认信任任何 Host 头，可被用于缓存投毒/密码重置链接投毒。
- **工作量**：0.5 人时
- **验收**：`curl -H "Host: evil.com" http://localhost:8000/health` 返回 400。

---

### P1：中等投入，建议排期（合计约 8 人日）

#### P1-1 结构化日志 + request_id 贯穿

- **为什么**：没有 request_id，多请求交错时无法定位单请求链路；12-factor Factor XI 要求日志到 stdout 可聚合。【官方】structlog https://www.structlog.org/ 是 Python 事实标准。
- **做法**：`asgi-correlation-id` 中间件或自写 20 行；日志改 JSON（python-json-logger）；响应头回写 X-Request-ID。
- **工作量**：1.5 人日
- **风险**：低。注意不把密码/token 打进日志。
- **验收**：任意请求响应头含 X-Request-ID；access log 是合法 JSON 可 jq 解析；一次失败请求能用同一 request_id 串起 access/error/ai 三层日志。

#### P1-2 Prometheus /metrics 端点（免费自托管）

- **为什么**：没有 metrics，Sentry 只能告诉你"挂了"，不能告诉你"慢了/QPS 涨了"。【官方】prometheus-fastapi-instrumentator https://pypi.org/project/prometheus-fastapi-instrumentator/ 一行接入。
- **做法**：Instrumentator().instrument(app).expose(app)；docker-compose 加 prometheus 服务（可选 grafana）。
- **工作量**：1 人日
- **风险**：低。/metrics 不要暴露公网（Nginx 不配 /metrics/ location）。
- **验收**：`curl http://backend:8000/metrics` 返回 Prometheus 文本格式；Prometheus target UP；Grafana 面板看到 P50/P95 与 QPS。

#### P1-3 CI 加供应链扫描（npm audit + pip-audit + Dependabot）

- **为什么**：依赖漏洞是最低垂果实。【官方】https://docs.npmjs.com/cli/v11/commands/npm-audit/ ；https://docs.github.com/zh/code-security/concepts/supply-chain-security/about-supply-chain-security
- **做法**：
  1. `.github/dependabot.yml`（npm + pip + github-actions 三套，weekly）
  2. CI 加 job：`npm audit --audit-level=high` 与 `pip-audit --requirement requirements.txt --severity high`
- **工作量**：0.5 人日
- **风险**：低。audit 可能有误报/传递依赖无法修，CI 先 `continue-on-error` 或只 warn。
- **验收**：Dependabot 能自动提 PR 升 patch；CI 两个 audit job 输出报告。

#### P1-4 CI 加 ruff + bandit + 后端质量门

- **为什么**：当前 CI 7 job 只跑测试，不扫代码质量。【官方】ruff https://beta.ruff.rs 可替代 flake8/black/isort，FastAPI 自身在用；pip-audit 扫依赖 CVE；bandit 扫安全规则。
- **工作量**：1 人日（含首次全量扫描修复）
- **风险**：低。ruff 先 `--fix` 自动修。
- **验收**：CI 新增 job 全绿；故意写 `eval(user_input)` 触发 bandit 报警。

#### P1-5 引入 Biome 前端 lint gate

- **为什么**：【实见】项目目前完全没有 linter（只有 vue-tsc）。企业级基线至少要有一个 lint gate 拦 console.log/未使用变量/==。Biome 单文件配置、零运行时、比 ESLint 快一个量级。
- **工作量**：0.5–1 人日
- **风险**：低。先 `biome migrate --write` 自动修一遍。
- **验收**：`npm run lint` 通过；CI 增加 lint job。

#### P1-6 Playwright trace on-first-retry

- **为什么**：【官方】https://playwright.dev/docs/best-practices 推荐 CI 失败时用 trace viewer（可分享 PWA，含时间线/DOM 快照/网络/控制台），`trace: 'on-first-retry'` 只在首次重试时开保持 CI 快。
- **工作量**：0.25 人日
- **验收**：故意让一个 e2e 失败，CI artifact 能下到 trace.zip，拖进 trace.playwright.dev 能回放。

#### P1-7 axe-core 进 CI（a11y 自动化）

- **为什么**：把设计审计 9 条里的可自动化部分固化。axe-core 设计"宁可漏报不误报"，适合做 CI gate。
- **做法**：vitest-axe 测组件 + @axe-core/playwright 测真实页面。
- **工作量**：0.5–1 人日
- **验收**：核心页面 axe 扫描 0 critical / 0 serious；CI 失败时报告列出违规。

#### P1-8 SPA 离线深链回退（navigateFallback）

- **为什么**：当前未显式配 `navigateFallback: '/index.html'`，PWA 离线后从分享品鉴卡 `/share/<token>` 或书签深链进入会 404。直接服务于"品鉴卡可分享、离线优先"核心承诺。
- **工作量**：0.25 人日
- **验收**：断网状态下直接访问 `/brew`、`/share/<token>` 不白屏 404。

#### P1-9 web-vitals 落本地 IndexedDB（不外发）

- **为什么**：【官方】https://web.dev/vitals 定 LCP≤2.5s / INP≤200ms / CLS≤0.1 良好线；web-vitals 库是官方 RUM 方式。当前只有实验室数据无真实用户场数据。
- **关键取舍**：与 ADR-006「本地埋点无网络外发」一致——结果只写 IndexedDB（与 tracking.ts 同模式），**不做 /api/metrics 上报**。
- **工作量**：0.5 人日
- **验收**：本地/开发环境能打出 LCP/INP/CLS；3D 茶室页实测 INP；PERF_BASELINE 新增 RUM 章节。

#### P1-10 PostgreSQL 定时备份

- **为什么**：当前只有 pgdata 卷，磁盘坏 = 数据全丢。【官方】https://www.postgresql.org/docs/17/continuous-archiving.html ；【社区】"Test restores monthly — backup processes that have never been tested are not backups."
- **做法**：`scripts/backup.sh` pg_dump | gzip；crontab 每天 2 点跑，保留 14 天；每月恢复演练。
- **工作量**：0.5 人日
- **验收**：/backups/ 每天一个 .sql.gz；从备份恢复到临时库 count 与生产一致。

#### P1-11 Gunicorn + UvicornWorker 多 worker

- **为什么**：【官方】https://fastapi.tiangolo.com/deployment/server-workers/ 推荐多 worker。
- **工作量**：0.5 人时
- **风险**：中。多 worker 后内存限流不再共享，必须走 Redis（项目已支持）；连接池总数 = workers × pool_size 要和 Postgres max_connections 对齐。
- **验收**：docker exec 看到 4 个 worker；Redis 限流在多 worker 间共享。

#### P1-12 liveness / readiness 分离

- **为什么**：【官方】https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/ ：readiness 失败摘流量不重启，liveness 失败才重启。当前 /health 查 DB，DB 抖动会导致 Docker 把 backend 重启。
- **做法**：/live 只返回 200；/ready 查 DB+Redis，失败 503；/health 保留 readiness 别名。
- **工作量**：0.5 人时
- **验收**：停 DB 时 /ready 503 但 /live 200；恢复后自动 200。

#### P1-13 AI 代理熔断（pybreaker）

- **为什么**：DeepSeek 连续失败时每个请求都等 30s 超时 = 雪崩。熔断后 30s 内直接走规则引擎降级。【官方】https://pypi.org/project/pybreaker/
- **工作量**：0.5 人日
- **验收**：mock DeepSeek 连续 5 次 500，第 6 次立即返回 503 且 <100ms。

---

### P2：远期/按需，不排期

| 编号 | 优化点 | 工作量 | 说明 |
|---|---|---|---|
| P2-1 | JWT 短期 access (30min) + refresh token (7d) | 1.5d | 当前 30 天 JWT 泄露即失陷一个月；但引入 refresh 表 = 新迁移；单用户自己用 30 天便利 > 安全收益，给朋友试用再做 |
| P2-2 | manualChunks vendor 拆分 | 0.5–1d | vendor-vue/vendor-three/vendor-charts 拆出利用长缓存；需跑 3D 验证 |
| P2-3 | 补 verbatimModuleSyntax / exactOptionalPropertyTypes | 1–2d | 类型层再收紧；exactOptionalPropertyTypes 一开大概率爆一批报错 |
| P2-4 | rollup-plugin-visualizer | 0.5d | 拆包前先看清 2.29MB JS 花在哪 |
| P2-5 | toHaveScreenshot 视觉回归 | 1d | 已有 verify-gardens 脚本基础上接像素阈值；只对稳定业务页做，3D 维持脚本对比 |
| P2-6 | 焦点管理 + ARIA live | 1d | 冲泡页自动流程（零点击闭环）尤其需要 live region 播报 |
| P2-7 | 2D 图片转 WebP/AVIF | 1d | 再省 30-50%；改 compress-assets.cjs 加 srcset 分支 |
| P2-8 | 3D 纹理 KTX2 压缩 | 1d | 34MB → ~8MB；**走 expand-contract**（新旧并存一个版本），不动 three/ 状态机 |
| P2-9 | 前端 Sentry（需拍板） | 1–1.5d | ⚠️ 与「本地埋点无网络外发」原则冲突；建议优先本地错误缓冲（window.onerror 落 IndexedDB，0.5d），Sentry 等有真实流量再上且关 Replay |
| P2-10 | PWA PNG 图标 / brotli / HTTP2 | 各 0.5d | 边际收益；brotli 需换 nginx 镜像；HTTP2 前置 TLS |
| P2-11 | 仓库专业度补全 | 0.3d | issue/PR 模板 + SECURITY.md |
| P2-12 | IndexedDB 一键导出 JSON | 0.5d | 设置页加"导出品鉴记录为 .json"；不做端到端加密 |

---

## 三、与项目现有约束的冲突登记

| 建议 | 冲突约束 | 取舍 |
|---|---|---|
| P1-9 web-vitals 上报后端 | ADR-006「本地埋点无网络外发」 | **只写本地 IndexedDB**，不做 /api/metrics 上报 |
| P2-9 Sentry SaaS | ADR-006 + 免费自托管 + 不追踪用户 | 优先本地错误缓冲；Sentry 列 P2 且关 Replay、DSN 空时降级 |
| P0-4 删 CSP Google Fonts | 需确认字体真自托管 | **已 Grep index.html 实核零 Google Fonts link**，可直接删 |
| P0-4 删 CSP pollinations.ai | 与「AI 必须走后端代理」硬约束 | **已 Grep src/ 与 backend/ 实核零引用**，死配置直接删 |
| P1-11 多 worker | 与「Redis 限流降级」耦合 | 多 worker 后必须强依赖 Redis（已绑 127.0.0.1 安全），可接受 |
| P2-1 refresh token | 与「登录/云同步暂缓」方向相关 | 不涉及云同步，只是 JWT 生命周期改造；但引入 refresh 表 = 新迁移，走 alembic |
| P2-8 KTX2 纹理 | AGENTS.md「动 three/ 风险高，3D 茶园死代码保留」 | **走 expand-contract**：新旧格式并存一个版本，新格式失败回退 PNG |
| P0-5 Docker 非 root | docker-compose 挂载 ./dist 只读、./database/init.sql 只读 | 不冲突，只读挂载不涉及写权限 |
| 任何新增页面 | V3_ROADMAP §7.4「不新增页面」 | 本报告所有项均不加路由/页面，只在现有组件上加 toast/region |
| 重型依赖 | V3_ROADMAP §7.4「不引入重型依赖」 | P0/P1 全是轻量库（asgi-correlation-id / prometheus-fastapi-instrumentator / ruff / Biome）；不引入 OTel collector / K8s / Traefik |
| Argon2id 迁移 | AGENTS.md「bcrypt 必须锁定 ==4.0.1」硬冲突 | **不做**。OWASP 认可 bcrypt cost≥10 可接受，当前 passlib 默认 12 达标 |

---

## 四、伪需求甄别（四维方法论一致）

按 AGENTS.md「四维甄别」（自由分析/用户视角/竞品视角/伪需求甄别）：

| 候选建议 | 四维判定 | 结论 |
|---|---|---|
| K8s / Helm 编排 | 用户视角：单用户无价值；竞品视角：同类小项目没人用 | **伪需求，不做** |
| OpenTelemetry 全链路 tracing | 用户视角：单进程调用链短；投入：重 | **伪需求，不做**（request_id 解决 80% 问题） |
| Traefik 全家桶 / 多阶段 CI/CD | 用户视角：Caddy 或 nginx+certbot 三行配置替代 | **伪需求，不做**（但上线公网前必须上 HTTPS） |
| Celery / RQ 异步队列 | 项目无后台任务（无邮件/报表/定时作业） | **伪需求，不做**（pg_dump 用 cron 够了） |
| 读写分离 / 主从复制 | 单实例写入 QPS 个位数 | **伪需求，不做** |
| Redis Cluster / 哨兵 | 单实例已绑 127.0.0.1，挂了自动降级内存限流 | **伪需求，不做** |
| 服务网格（Istio/Linkerd） | 单机 Compose 无意义 | **伪需求，不做** |
| 多租户 RBAC/ABAC | 单用户/小团队 | **伪需求，不做** |
| GraphQL / gRPC | REST 已够，PWA 对 REST 友好 | **伪需求，不做** |
| 付费 APM（Datadog/New Relic） | 与「免费自托管」冲突 | **伪需求，不做**（Sentry 免费层 + Prometheus 自托管已覆盖） |
| WAL 归档 + PITR | 单用户 pg_dump 每日 RPO=24h 够用 | **伪需求，不做** |
| 邮件找回 / React Email | 单用户改库就行 | **伪需求，不做** |
| e2e 加密 IndexedDB | 品鉴记录不是密码管理器 | **伪需求，不做**（但 P2-12 明 JSON 导出做） |
| 社交/好友/点赞 | 四维甄别已判伪需求（V3_ROADMAP §7.5） | **不做** |
| 3D 茶园养成 | 四维甄别已判伪需求，已降级纯观赏 | **不做** |
| SRI 子资源完整性 | script-src 'self'、无外部 CDN 脚本 | **伪需求，不做**（已通过"不引外部脚本"等价） |
| /metrics Prometheus | 用户视角：单用户也能看到 AI 代理用量；投入：低 | **真需求，P1** |
| request_id + JSON 日志 | 用户视角：出问题能查；投入：低 | **真需求，P1** |
| Dependabot + audit | 用户视角：供应链安全；投入：极低 | **真需求，P1** |
| PWA prompt 更新 | 用户视角：防品鉴表单数据丢失；投入：低 | **真需求，P0** |
| Docker 非 root | 用户视角：容器安全；投入：低 | **真需求，P0** |

---

## 五、执行顺序建议

1. **第一批（本周，~1 人天）后端 bug 与安全小改**：P0-1 proxy-headers + P0-2 连接池 + P0-6 登录/AI 限流 + P0-7 AI 异步重试 + P0-8 SECRET_KEY 校验 + P0-9 TrustedHostMiddleware。全是后端/配置小改，风险最低，其中 P0-1 是 bug 级。
2. **第二批（本周，~1 人天）前端与部署**：P0-3 PWA prompt + P0-4 CSP 清理 + P0-5 Dockerfile 多阶段 non-root。
3. **第三批（下周，~4 人天）可观测性**：P1-1 request_id+JSON 日志 + P1-2 /metrics + P1-10 备份 + P1-11 gunicorn + P1-12 健康检查分离 + P1-13 熔断。
4. **第四批（排期，~4 人天）工程质量门**：P1-3 Dependabot+audit + P1-4 ruff/bandit + P1-5 Biome + P1-6 Playwright trace + P1-7 axe-core + P1-8 navigateFallback + P1-9 web-vitals 本地。
5. **P2 不急**：按场景触发（给朋友试用再做 refresh token；性能告警再做 visualizer/分片；动 three/ 走 expand-contract）。

> 全部 P0+P1 加起来约 10 人天，做完后「一盏茶」在**可观测性、供应链安全、容器安全、PWA 数据安全、前端质量门**五个维度上达到个人开源项目的企业级水位；再往上（K8s/OTel/Traefik/邮件/微服务）都是过度工程，单用户自托管规模不需要。

---

## 六、来源清单

**官方文档**
- FastAPI Behind a Proxy：https://fastapi.tiangolo.com/advanced/behind-a-proxy/
- FastAPI Docker 部署：https://fastapi.tiangolo.com/deployment/docker/
- FastAPI Server Workers：https://fastapi.tiangolo.com/deployment/server-workers/
- FastAPI OAuth2-JWT：https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- SQLAlchemy 2.0 Pooling：https://docs.sqlalchemy.org/en/20/core/pooling.html
- OWASP API Security Top 10 2023 - API2：https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/
- PostgreSQL 17 PITR：https://www.postgresql.org/docs/17/continuous-archiving.html
- Kubernetes Liveness/Readiness：https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
- Docker Python 指南：https://docs.docker.com/guides/python/develop/
- structlog：https://www.structlog.org/
- prometheus-fastapi-instrumentator：https://pypi.org/project/prometheus-fastapi-instrumentator/
- pybreaker：https://pypi.org/project/pybreaker/
- ruff：https://beta.ruff.rs
- vite-pwa autoUpdate 风险：https://vite-pwa-org.netlify.app/guide/auto-update.html
- vite-pwa Vue useRegisterSW：https://vite-pwa-org.netlify.app/frameworks/vue
- Vite 生产构建：https://v7.vite.dev/guide/build
- Web Vitals：https://web.dev/vitals
- web-vitals npm：https://www.npmjs.com/package/web-vitals
- Vue 安全：https://vuejs.org/guide/best-practices/security
- TypeScript tsconfig 参考：https://www.typescriptlang.org/tsconfig/
- npm audit：https://docs.npmjs.com/cli/v11/commands/npm-audit/
- Dependabot 官方：https://docs.github.com/zh/code-security/concepts/supply-chain-security/about-supply-chain-security
- Playwright 最佳实践/trace：https://playwright.dev/docs/best-practices
- CSP Level 3 (W3C)：https://www.w3.org/TR/2026/WD-CSP3-20260306/
- Sentry Vue：https://docs.sentry.io/platforms/javascript/guides/vue/

**GitHub 同类项目（横纵分析详见 research-github.md）**
- full-stack-fastapi-template：https://github.com/fastapi/full-stack-fastapi-template
- vite-plugin-pwa：https://vite-pwa-org.netlify.app/
- benlau6/fastapi-fullstack：https://github.com/benlau6/fastapi-fullstack

**一方经验（需自行验证，已在正文标注）**
- Apitally FastAPI 日志指南：https://apitally.io/blog/fastapi-logging-guide
- markaicode FastAPI+Nginx：https://markaicode.com/integrate/fastapi-with-nginx/
- CSP 实用清单：https://csp-guide.com/posts/content-security-policy-complete-guide/
- npm 供应链攻击防护：https://jakeinsight.com/tech-economy/2026-03-31-npm-supply-chain-attack-axios-malicious-package-de/
- 严格 tsconfig 实践：https://gist.github.com/gitaroktato/a29048ac74dec49736cd3e17b47a4288
- axe a11y 分层：https://testguild.com/accessibility-testing-tools-automation/
- ARIA live / 焦点：https://www.uxpin.com/studio/blog/debugging-screen-reader-issues-guide/
- tutorials.technology PostgreSQL 备份：https://tutorials.technology/tutorials/postgresql-backup-restore-2026.html
