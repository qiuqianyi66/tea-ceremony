# 「一盏茶」企业级优化方案（OPTIMIZATION_PLAN）

> 决策版方案：由 `docs/ENTERPRISE_GAP.md`（三路调研：前端/后端/GitHub 横纵）整合而来。
> 2026-09-18。规模假设：单用户/小团队免费自托管，非多租户 SaaS。
> 判据：投入/价值 × 是否破坏硬约束（离线优先 / 免费自托管 / 埋点无网络外发 / 不动 3D 状态机 / 不新增页面）。
> 推荐档位：✅ 必做（低成本高价值或 bug 级）｜🔸 推荐（中等投入，排期做）｜🚫 不做（伪需求/过度工程）。

---

## 一、分领域方案

### A. 安全（最高优先，先堵"现在就会出事"的洞）

| 推荐档 | 项 | 内容 | 为什么 | 工作量 |
|---|---|---|---|---|
| ✅ P0-1 | uvicorn 接 proxy-headers | `--proxy-headers --forwarded-allow-ips=172.16.0.0/12` | **bug 级**：Nginx 传了 XFF 但 uvicorn 不解析，全用户共享一个限流 key，一人刷爆全员 429；日志无真实 IP | 0.5h |
| ✅ P0-6 | 登录/注册 + /api/ai/* 专项限流 | 登录 10 次/5min/IP；AI 10 次/min/IP | OWASP API2：登录防爆破；AI 是付费出口，全局 300/60s 太松 | 0.5h |
| ✅ P0-4 | CSP 清理补全 | 删死域名（pollinations.ai/Google Fonts 已实核零引用）+ 补 object-src/base-uri/frame-ancestors/worker-src | 死配置与「AI 走后端代理」冲突；补全防点击劫持等 | 0.5d |
| ✅ P0-5 | Docker 多阶段 + non-root | builder/runtime 分离 + USER app + .dockerignore | 当前单阶段 root 跑、镜像 ~1.2GB；容器逃逸即 root | 1h |
| ✅ P0-8 | SECRET_KEY 强度校验 | 启动校验 ≥32 字符 | 弱 key 可被爆破伪造 JWT | 0.2h |
| ✅ P0-9 | TrustedHostMiddleware | allowed_hosts 走 ALLOWED_HOSTS 环境变量 | 防 Host 头缓存投毒/重置链接投毒 | 0.5h |
| 🔸 P1-3 | Dependabot + npm/pip audit | 三套 weekly + CI audit job | 依赖漏洞是最低垂果实 | 0.5d |
| 🔸 P1-4 | ruff + bandit | 后端 lint + 安全扫描 | 当前 CI 只跑测试不扫质量 | 1d |
| 🚫 | Argon2id 迁移 | — | 与「bcrypt 锁定 ==4.0.1」硬冲突；OWASP 认可 bcrypt cost≥10，当前 12 达标 | — |
| 🚫 | IndexedDB 端到端加密 | — | 品鉴记录不是密码管理器，伪需求 | — |
| 🚫 | SRI | — | script-src 'self' + 无外部 CDN 已等价 | — |
| 🚫 | K8s / 服务网格 / 多租户 RBAC | — | 单用户规模过度工程 | — |

### B. 稳定性（防事故、防雪崩）

| 推荐档 | 项 | 内容 | 为什么 | 工作量 |
|---|---|---|---|---|
| ✅ P0-2 | 连接池显式配置 | pool_size=5/max_overflow=10/pool_recycle=300/pool_pre_ping | 默认 recycle=-1，Postgres 空闲断连后拿死连接 | 0.5h |
| ✅ P0-7 | AI 代理异步化 + 5xx 重试 | async def + AsyncClient + 1 次指数退避（4xx 不重试） | 同步占线程；DeepSeek 偶发 5xx 直接 502 | 1h |
| 🔸 P1-11 | gunicorn 多 worker | gunicorn + UvicornWorker ×4 | FastAPI 官方推荐；需确认 Redis 限流（已支持）共享 | 0.5h |
| 🔸 P1-12 | liveness/readiness 分离 | /live 纯 200，/ready 查 DB+Redis | 当前 /health 查 DB，DB 抖动会把 backend 重启 | 0.5h |
| 🔸 P1-13 | AI 代理熔断 | pybreaker，连续 5 次失败后 30s 直接降级 | 防 DeepSeek 故障时请求全等 30s 超时雪崩 | 0.5d |
| 🚫 | Celery / RQ 队列 | — | 无后台任务（无邮件/报表/定时作业），pg_dump 用 cron 够 | — |
| 🚫 | 读写分离 / 主从复制 | — | 单实例写入 QPS 个位数 | — |
| 🚫 | Redis Cluster / 哨兵 | — | 单实例绑 127.0.0.1，挂了自动降级内存限流 | — |

### C. PWA 与前端数据安全（用户数据不丢）

| 推荐档 | 项 | 内容 | 为什么 | 工作量 |
|---|---|---|---|---|
| ✅ P0-3 | PWA 更新改 prompt | autoUpdate → useSW needRefresh toast | **bug 级**：vite-pwa 官方明确警告 autoUpdate 强刷会丢表单数据——品鉴打分/笔记被强刷 = 真实事故 | 0.5–1d |
| 🔸 P1-8 | SPA 离线深链 navigateFallback | navigateFallback: '/index.html' | 当前离线后 /share/<token>、/brew 深链 404，伤「分享卡可分享」核心承诺 | 0.25d |
| 🔸 P1-9 | web-vitals 落本地 | 官方 RUM 库，结果只写 IndexedDB | 补真实用户场数据；**不破 ADR-006 无外发** | 0.5d |
| 🚫 | Sentry 前端（现在就上） | — | 与无外发原则冲突；先做本地错误缓冲（0.5d），Sentry 等有真实流量且关 Replay | — |

### D. 可观测性（出问题能查）

| 推荐档 | 项 | 内容 | 为什么 | 工作量 |
|---|---|---|---|---|
| 🔸 P1-1 | request_id + JSON 日志 | asgi-correlation-id + python-json-logger | 无 request_id 无法串起单请求链路；12-factor XI | 1.5d |
| 🔸 P1-2 | Prometheus /metrics | prometheus-fastapi-instrumentator 一行接入 | 免费自托管；补 SRE 四信号（延迟/流量/错误/饱和） | 1d |
| 🔸 P2-9 | 前端本地错误缓冲 | window.onerror 落 IndexedDB | 比 Sentry 便宜且不破原则 | 0.5d |
| 🚫 | OTel 全链路 tracing | — | 单进程调用链短，request_id 解决 80% | — |
| 🚫 | 付费 APM（Datadog/New Relic） | — | 与免费自托管冲突 | — |

### E. 工程质量（防烂尾）

| 推荐档 | 项 | 内容 | 为什么 | 工作量 |
|---|---|---|---|---|
| 🔸 P1-5 | Biome 前端 lint | 单文件配置、比 ESLint 快一个量级 | **全仓当前无任何 linter**（只有 vue-tsc），明显缺口 | 0.5–1d |
| 🔸 P1-6 | Playwright trace | trace: 'on-first-retry' | CI 失败可回放定位（含时间线/DOM/网络/控制台） | 0.25d |
| 🔸 P1-7 | axe-core 进 CI | vitest-axe + @axe-core/playwright | 把设计审计 9 条可自动化部分固化 | 0.5–1d |
| 🔸 P2-3 | 严格 tsconfig | exactOptionalPropertyTypes / verbatimModuleSyntax | 类型层再收紧（会爆一批报错，排期） | 1–2d |
| 🔸 P2-5 | toHaveScreenshot 视觉回归 | 像素阈值，只对稳定业务页 | 补视觉回归（3D 维持脚本对比） | 1d |
| 🔸 P2-6 | 焦点管理 + ARIA live | 冲泡页零点击闭环配 live region 播报 | 无障碍短板 | 1d |

### F. 性能（当前已达标，按需再动）

| 推荐档 | 项 | 内容 | 为什么 | 工作量 |
|---|---|---|---|---|
| 🔸 P2-4 | rollup-plugin-visualizer | 先看清 2.29MB JS 花在哪 | 拆包前先诊断 | 0.5d |
| 🔸 P2-2 | manualChunks vendor 拆分 | vendor-vue/vendor-three/vendor-charts | 利用长缓存；跑 3D 验证 | 0.5–1d |
| 🔸 P2-7 | 2D 图转 WebP/AVIF | 改 compress-assets.cjs | 再省 30-50% | 1d |
| 🔸 P2-8 | 3D 纹理 KTX2 | 34MB → ~8MB | **走 expand-contract 新旧并存**，不动 three/ 状态机 | 1d |
| 🚫 | 过度分包/微优化 | — | 首屏 114ms/878KB 已接近基线 | — |

### G. 部署与运维（数据不丢、上线不裸奔）

| 推荐档 | 项 | 内容 | 为什么 | 工作量 |
|---|---|---|---|---|
| 🔸 P1-10 | PostgreSQL 每日备份 | pg_dump|gzip，保留 14 天，每月恢复演练 | 当前只有 pgdata 卷，磁盘坏=数据全丢 | 0.5d |
| 🔸 P2-10 | brotli / HTTP2 / HTTPS | 上线公网前必须 HTTPS；brotli 换 nginx 镜像 | 边际收益但安全必做 | 各 0.5d |
| 🚫 | Traefik 全家桶 | — | nginx + certbot 三行配置替代 | — |
| 🚫 | WAL 归档 + PITR | — | 单用户 pg_dump 每日 RPO=24h 够用 | — |

### H. 数据（用户体验）

| 推荐档 | 项 | 内容 | 为什么 | 工作量 |
|---|---|---|---|---|
| 🔸 P2-12 | IndexedDB 一键导出 JSON | 设置页加导出按钮 | 数据自主权；不做端到端加密 | 0.5d |
| 🚫 | 邮件找回/React Email | — | 单用户改库就行 | — |

---

## 二、推荐总表（按执行批次）

| 批次 | 内容 | 项目 | 工作量 | 完成后验收 |
|---|---|---|---|---|
| 第一批（后端 bug+安全） | P0-1 proxy-headers + P0-2 连接池 + P0-6 限流 + P0-7 AI 异步重试 + P0-8 SECRET_KEY + P0-9 TrustedHost | 6 项 | ~1 人天 | pytest 全绿；mock XFF 限流 key 含真实 IP；重启 PG 不报死连接；连打 11 次登录第 11 个 429；short key 启动即报错；evil.com Host 返回 400 |
| 第二批（前端+部署） | P0-3 PWA prompt + P0-4 CSP 清理 + P0-5 Dockerfile 多阶段 | 3 项 | ~1 人天 | e2e 模拟 SW 更新表单不丢；curl -I 头含补全指令且 0 violation；镜像 <400MB 且非 root 运行 |
| 第三批（可观测性） | P1-1 request_id + P1-2 /metrics + P1-10 备份 + P1-11 gunicorn + P1-12 健康分离 + P1-13 熔断 | 6 项 | ~4 人日 | 响应头含 X-Request-ID；日志可 jq 解析；/metrics 文本格式；备份可恢复；4 worker；停 DB 时 /ready 503 而 /live 200；连续 5 次 500 后第 6 次 <100ms |
| 第四批（工程质量门） | P1-3 Dependabot + P1-4 ruff/bandit + P1-5 Biome + P1-6 trace + P1-7 axe + P1-8 navigateFallback + P1-9 web-vitals | 7 项 | ~4 人日 | CI 新增 4+ job 全绿；离线深链不 404；axe 0 critical；web-vitals 落 IndexedDB |
| 第五批（P2 按需触发） | P2-1 refresh token（给朋友试用时）／P2-2/4/7 性能（有告警时）／P2-8 KTX2（走 expand-contract）／P2-11 仓库专业度 + P2-12 导出 JSON（免费顺手做） | 按需 | 逐项 0.3–1.5d | 每项自带验收 |

> 全部 P0+P1 ≈ 10 人天。做完后「一盏茶」在**可观测性、供应链安全、容器安全、PWA 数据安全、前端质量门**五个维度达到个人开源项目的企业级水位。

---

## 三、不推荐清单（一张表说完）

| 候选 | 一句话理由 | 替代 |
|---|---|---|
| K8s / Helm | 单用户自托管无意义 | Docker Compose 已够 |
| OpenTelemetry 全链路 | 单进程调用链短 | request_id（P1-1） |
| Traefik 全家桶 | 三行配置替代 | nginx + certbot |
| Celery / RQ 队列 | 无后台任务 | pg_dump cron |
| 读写分离 / 主从复制 | QPS 个位数 | 单实例 |
| Redis Cluster / 哨兵 | 挂了自动降级内存限流 | 单实例绑 127.0.0.1 |
| 服务网格（Istio/Linkerd） | 单机 Compose 无意义 | — |
| 多租户 RBAC/ABAC | 单用户 | — |
| GraphQL / gRPC | REST 已够、PWA 友好 | REST |
| 付费 APM | 与免费自托管冲突 | Prometheus + 本地错误缓冲 |
| WAL 归档 + PITR | RPO=24h 够用 | pg_dump 每日备份 |
| 邮件找回 | 单用户改库就行 | — |
| IndexedDB 端到端加密 | 品鉴记录非机密 | 导出 JSON（P2-12） |
| Argon2id 迁移 | 与 bcrypt 锁死冲突 | bcrypt cost=12 达标 |
| SRI | script-src 'self' 已等价 | — |
| 社交/3D 养成/云同步主线 | 四维甄别已判伪需求 | 文档登记 |

---

## 四、与现有约束的冲突登记（已对齐）

| 建议 | 冲突 | 取舍 |
|---|---|---|
| P1-9 web-vitals | ADR-006 无网络外发 | 只写 IndexedDB，不做 /api/metrics |
| P2-9 Sentry | ADR-006 + 免费自托管 | 先本地错误缓冲；Sentry 列 P2 且关 Replay |
| P0-4 CSP 删域名 | 需确认字体/域名真自托管 | 已 Grep 实核零引用，可删 |
| P1-11 多 worker | Redis 限流耦合 | Redis 已支持并绑 127.0.0.1，可接受 |
| P2-1 refresh token | 登录/云同步暂缓方向 | 只是 JWT 生命周期改造；refresh 表走 alembic |
| P2-8 KTX2 | 不动 three/ 风险区 | expand-contract 新旧并存，失败回退 |
| 全部 | 不新增页面/重型依赖 | P0/P1 全是轻量库，不加路由/页面 |

---

*本方案为决策版，落地时每项按 AGENTS.md 门禁链 + 功能/性能/安全三面验证执行。来源见 docs/ENTERPRISE_GAP.md 第六节。*
