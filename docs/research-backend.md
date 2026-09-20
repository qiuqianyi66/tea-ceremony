# 后端企业级优化差距调研（research-backend）

> 调研日期：2026-09-18
> 调研对象：「一盏茶」后端（FastAPI 0.115 + SQLAlchemy 2.0 异步 + PostgreSQL 16 + Redis 7 + Docker Compose + Nginx）
> 规模假设：单用户 / 小团队自托管，非多租户 SaaS。所有"企业级"建议按此规模裁剪，不堆微服务 / K8s / 服务网格。
> 调研方式：只读代码 + 官方文档 / 权威博客实查。每条结论标注来源与可信度。
> 可信度标注：【官方】= 官方文档 / 项目主页明确建议；【社区】= 一方博客 / 教程称，未在官方文档直接背书。

---

## 0. 现状快照（已读代码确认）

| 维度 | 现状 | 评价 |
| --- | --- | --- |
| ASGI 服务器 | `uvicorn main:app --host 0.0.0.0 --port 8000`，单进程单 worker | 【差距】未用 `--workers`，未上 gunicorn |
| 反向代理 | Nginx 已传 `X-Real-IP` / `X-Forwarded-For` / `X-Forwarded-Proto` | 【差距】uvicorn 未开 `--proxy-headers`，FastAPI 未加 `ProxyHeadersMiddleware`，`request.client.host` 实际是 Docker 网关 IP |
| 限流 | 自研滑动窗口（Redis ZSET + 内存兜底），300 req/60s，按 `IP+path` 分桶 | 【差距】IP 取错（见上），登录/注册无专项限流 |
| 认证 | JWT HS256，`ACCESS_TOKEN_EXPIRE_DAYS = 30`，无 refresh token，无 token 版本号 / 吊销 | 【差距】30 天过长；无吊销机制 |
| 密码哈希 | `passlib[bcrypt]==1.7.4` + `bcrypt==4.0.1` 锁定，未显式设 cost factor（passlib 默认 12） | 【基本达标】OWASP 要求 ≥10，新系统推荐 12 |
| 越权（BOLA） | `records.py` 所有端点都带 `user.id` 过滤，`record_service.get_record(db, user.id, record_id)` | 【达标】OWASP API1:2023 已覆盖 |
| 错误处理 | 全局 handler 统一 `{detail, code, status}`，未捕获异常不泄露堆栈，Sentry 手动 `capture_exception` | 【达标】 |
| 配置校验 | 启动时 `SECRET_KEY` / `DATABASE_URL` 非空校验，fail-fast | 【基本达标】未校验 SECRET_KEY 长度 / 熵 |
| 数据库连接 | `create_async_engine(ASYNC_DATABASE_URL)`，未显式设 `pool_size` / `pool_recycle` / `pool_pre_ping` | 【差距】默认 pool_size=5，无回收，无 ping |
| 日志 | `logging.basicConfig` 纯文本，无 request_id 贯穿，无 JSON 结构化 | 【差距】 |
| 可观测性 | 仅 Sentry（可选），无 `/metrics`，无 Prometheus，无 OTel | 【差距】 |
| 健康检查 | `/health` + `/api/health` 别名，查 `SELECT 1` | 【基本达标】未分离 liveness / readiness |
| AI 代理 | 同步 `httpx.Client(timeout=30)`，无重试、无熔断、无退避；失败统一 502 | 【差距】DeepSeek 偶发 5xx 直接 502 |
| Dockerfile | 单阶段 `python:3.12-slim`，root 运行，无 `.dockerignore`，无多阶段 | 【差距】 |
| CI 质量门 | GitHub Actions 7 job（type-check/build/smoke/Vitest/E2E/后端语法/pytest/迁移测试） | 【差距】无 ruff / bandit / pip-audit / mypy |
| 数据库备份 | 仅 `pgdata` 卷，无 `pg_dump` 定时任务，无 PITR | 【差距】 |
| 迁移 | Alembic 已用，有 upgrade/downgrade 往返测试 | 【基本达标】 |
| CORS | 生产 `CORS_ORIGINS` 默认空（同源），开发放行 5173/3000；`allow_credentials=True` + `allow_methods=["*"]` + `allow_headers=["*"]` | 【基本达标】组合不严谨但生产空 origins 时无实际风险 |
| 安全头 | Nginx 已配 `X-Content-Type-Options` / `X-Frame-Options` / CSP / Referrer-Policy / Permissions-Policy | 【达标】缺 HSTS（HTTP 阶段不需要） |

---

## 1. P0：低成本高价值，建议立即做

### P0-1 修复真实客户端 IP 识别（限流按 Docker 网关 IP 算的 bug）

- **优化点**：uvicorn 启动加 `--proxy-headers --forwarded-allow-ips=172.16.0.0/12`（Docker 网桥），或在 `main.py` 加 `TrustedHostMiddleware` + 用 `request.headers.get("x-forwarded-for")` 解析真实 IP。
- **为什么**：当前 Nginx 已正确传 `X-Forwarded-For`，但 uvicorn 默认不解析，`request.client.host` 永远是 Docker 网关 IP（如 `172.x.x.x`）。后果：所有用户共享同一个限流 key `rate:172.x.x.x:/api/...`，一人刷爆全员 429；同时日志里看不到真实 IP，排障失明。
- **来源**：
  - 【官方】FastAPI 官方文档 "Behind a Proxy"：https://fastapi.tiangolo.com/advanced/behind-a-proxy/ 明确 `--forwarded-allow-ips` 用于信任代理头。
  - 【社区】markaicode：https://markaicode.com/integrate/fastapi-with-nginx/ 指出不加 proxy-headers 时 `request.client.host` 返回 Nginx 容器 IP。
- **对本项目适配度**：高。单机 Docker Compose，Nginx 是唯一前置代理，信任 Docker 网桥 CIDR 即可。
- **工作量**：0.5 人时（改 CMD 一行 + 加测试）。
- **风险**：低。需注意 `--forwarded-allow-ips` 不能设 `*`（否则外网可伪造 X-Forwarded-For 绕过限流）。
- **验收标准**：
  - `curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:8000/api/...` 后，access log 里出现 `1.2.3.4` 而非 `172.x.x.x`。
  - 新增 pytest：mock 一个请求带 `X-Forwarded-For: 9.9.9.9`，断言限流 key 含 `9.9.9.9`。

### P0-2 显式配置数据库连接池

- **优化点**：`create_async_engine` 加 `pool_size=5, max_overflow=10, pool_recycle=300, pool_pre_ping=True`。
- **为什么**：
  - `pool_recycle=-1`（默认）意味着连接永不到期回收，Postgres / 云 LB 空闲 5 分钟后会主动断开，应用拿到死连接报错。
  - `pool_pre_ping=True` 在取连接前做轻量 ping，避免拿到死连接。
  - 【官方】SQLAlchemy 2.0 官方 pooling 文档：https://docs.sqlalchemy.org/en/20/core/pooling.html 说明 `recycle` 与 `pre_ping` 语义。
  - 【社区】多篇生产实践（thecodeforge.io、learnwithparam.com）推荐 `pool_recycle=300` + `pool_pre_ping=True`。
- **对本项目适配度**：高。单 worker 时 pool_size=5 足够；上 gunicorn 多 worker 后按 `pool_size * workers` 估算，单用户量级完全够。
- **工作量**：0.5 人时。
- **风险**：低。`pool_pre_ping` 有 ~1ms 开销，可接受。
- **验收标准**：
  - 重启 PostgreSQL 后，下一个请求不抛 `AsyncpgConnectionError`，自动重连。
  - pytest 里 `engine.pool.size()` 可观测。

### P0-3 安全化 Dockerfile（多阶段 + non-root + .dockerignore）

- **优化点**：
  1. 多阶段构建：builder 阶段装依赖，runtime 阶段只拷贝 `/usr/local/lib/python3.12/site-packages` + 应用代码。
  2. 创建非 root 用户 `app`，`USER app`。
  3. 加 `.dockerignore` 排除 `.venv/`、`__pycache__/`、`.env`、`tests/`。
- **为什么**：
  - 【官方】Docker 官方 Python 指南 https://docs.docker.com/guides/python/develop/ 明确推荐 runtime 阶段跑 nonroot。
  - 【官方】FastAPI 官方 Docker 部署文档 https://fastapi.tiangolo.com/deployment/docker/ 用多阶段 `requirements-stage` 模式。
  - 单阶段 root 运行：容器逃逸时直接拿 root，镜像里带编译工具链增大攻击面。
- **对本项目适配度**：高。无额外依赖，纯改 Dockerfile。
- **工作量**：1 人时。
- **风险**：低。需验证非 root 用户能读应用代码、能写日志（日志走 stdout 即可）。
- **验收标准**：
  - `docker run --rm <image> id` 输出非 root（uid ≠ 0）。
  - 镜像大小从当前 ~1.2GB 降到 ~200-300MB（builder 不进 runtime）。
  - `docker compose up` 后 `/health` 仍 200。

### P0-4 加 TrustedHostMiddleware（防 Host 头攻击）

- **优化点**：`main.py` 加 `app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "tea.example.com"])`。
- **为什么**：FastAPI 默认信任任何 Host 头。Host 头可被用于缓存投毒、密码重置链接投毒、SSRF 绕过。OWASP API4:2023 未直接点名但属基础硬化。
- **来源**：【官方】Starlette 内置 `TrustedHostMiddleware`（FastAPI 继承）。
- **对本项目适配度**：中。需要把生产域名写进环境变量 `ALLOWED_HOSTS`。
- **工作量**：0.5 人时。
- **风险**：低。漏配域名会导致 400，需在 `.env.example` 写清。
- **验收标准**：`curl -H "Host: evil.com" http://localhost:8000/health` 返回 400。

### P0-5 SECRET_KEY 启动时校验强度

- **优化点**：现有启动校验只查非空，加最小长度（≥32 字符）与熵提示。
- **为什么**：弱 SECRET_KEY 可被爆破伪造 JWT。当前错误提示已给 `secrets.token_hex(32)` 命令，但没强制。
- **来源**：【官方】FastAPI 安全文档 https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/ 用 `secrets.token_urlsafe(32)` 示例。
- **对本项目适配度**：高。
- **工作量**：0.2 人时。
- **风险**：低。现有部署如果 SECRET_KEY 已够长无影响。
- **验收标准**：把 SECRET_KEY 改成 `short` 后启动直接 RuntimeError。

### P0-6 登录 / 注册接口专项限流

- **优化点**：`/api/auth/login` 与 `/api/auth/register` 单独限流（如 10 次 / 5 分钟 / IP），不要被全局 300/60s 覆盖。
- **为什么**：
  - 【官方】OWASP API2:2023 Broken Authentication https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/ 明确要求登录接口"restrictive rate limiting: only three requests per minute"。
  - 当前全局 300/60s 对密码爆破太宽。
- **对本项目适配度**：高。在现有 RateLimitMiddleware 里加路径白名单特例即可。
- **工作量**：0.5 人时。
- **风险**：低。
- **验收标准**：`for i in {1..15}; do curl -X POST .../api/auth/login ...; done` 第 11 个返回 429。

### P0-7 AI 代理改异步 + 加轻量重试

- **优化点**：
  1. `ai.py` 路由从 `def` 改 `async def`，`httpx.Client` 改 `httpx.AsyncClient`（事件循环友好）。
  2. 对 5xx / 超时做 1 次指数退避重试（不要对 4xx 重试）。
- **为什么**：
  - 当前 `def` 路由 FastAPI 会扔线程池执行，30s 超时会占线程。单用户量级暂时不是问题，但"企业级"方向应异步。
  - 【社区】python.dev.br 重试指南 https://python.dev.br/blog/httpx-timeouts-retries-python/ 指出：GET / 幂等 POST 超时可重试，4xx 不重试。
  - DeepSeek 偶发 5xx 不罕见，一次重试能显著降低前端降级触发率。
- **对本项目适配度**：高。
- **工作量**：1 人时。
- **风险**：低。注意重试总耗时不超过 Nginx `proxy_read_timeout 30s`。
- **验收标准**：mock DeepSeek 第一次 500 第二次 200，断言最终返回 200；连续 4xx 不重试。

---

## 2. P1：中等投入，建议排入下个迭代

### P1-1 结构化日志 + request_id 贯穿

- **优化点**：
  1. 引入 `asgi-correlation-id` 中间件（或自研 20 行），每个请求生成 `X-Request-ID`，响应头回写。
  2. 日志改 JSON 输出（用 `python-json-logger` 或 `structlog`），字段含 `request_id` / `method` / `path` / `status` / `duration_ms` / `user_id`。
- **为什么**：
  - 【官方】structlog 官方文档 https://www.structlog.org/ 是 Python 生态事实标准。
  - 【社区】Apitally FastAPI 日志指南 https://apitally.io/blog/fastapi-logging-guide 推荐 `asgi-correlation-id` + contextvars。
  - 没有 request_id，出问题只能 grep 时间戳，多请求交错时无法定位单请求链路。
- **对本项目适配度**：高。单实例日志到 stdout，docker logging driver 收集即可，不需要 ELK 全家桶。
- **工作量**：1.5 人日。
- **风险**：低。注意不要把密码 / token 打进日志（项目已做 `max_request_body_size="never"`）。
- **验收标准**：
  - 任意请求响应头含 `X-Request-ID: <uuid>`。
  - access log 是合法 JSON，`jq` 可解析。
  - 一次失败请求，日志里能用同一个 `request_id` 串起 access / error / ai 三层日志。

### P1-2 接入 Prometheus /metrics（免费自托管）

- **优化点**：
  1. `pip install prometheus-fastapi-instrumentator`。
  2. `Instrumentator().instrument(app).expose(app)` 暴露 `/metrics`。
  3. docker-compose 加一个 `prometheus` 服务（官方镜像，挂载 `prometheus.yml` 抓取 backend），可选 `grafana` 服务。
- **为什么**：
  - 【官方】prometheus-fastapi-instrumentator PyPI https://pypi.org/project/prometheus-fastapi-instrumentator/ 一行接入，暴露 `http_request_duration_seconds` 直方图。
  - 【官方】Prometheus 官方入门 https://prometheus.io/docs/tutorials/getting_started/ 单机自托管完全免费。
  - 没有 metrics，Sentry 只能告诉你"挂了"，不能告诉你"慢了""QPS 涨了""5xx 率涨了"。
- **对本项目适配度**：高。单机 Compose 加两个容器，资源占用 ~200MB 内存。
- **工作量**：1 人日（含 grafana dashboard 导入官方 FastAPI 面板）。
- **风险**：低。`/metrics` 不要暴露到公网（Nginx 不配 `/metrics/` location 即可）。
- **验收标准**：
  - `curl http://backend:8000/metrics` 返回 Prometheus 文本格式。
  - Prometheus target 状态 UP。
  - Grafana 面板能看到 P50/P95 延迟与 QPS。

### P1-3 Gunicorn + UvicornWorker 多 worker

- **优化点**：Dockerfile CMD 改 `gunicorn main:app -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8000`。
- **为什么**：
  - 【官方】FastAPI 官方 "Server Workers" https://fastapi.tiangolo.com/deployment/server-workers/ 推荐 CPU 密集 / 多核场景用多 worker。
  - 单进程单 worker：一个慢请求（如 AI 调用 30s）期间事件循环仍能处理其他请求（FastAPI async 天生支持），但 Python GIL + CPU 密集任务会阻塞。单用户自托管优先级不高。
- **对本项目适配度**：中。单用户 / 小团队流量极低，单 worker 够用；但"企业级"方向 + 未来多用户时需要。
- **工作量**：0.5 人时。
- **风险**：
  - 多 worker 后内存限流（`MemoryRateStore`）不再共享，必须走 Redis（项目已支持，确认 REDIS_URL 必配）。
  - 连接池总数 = `workers * pool_size`，要和 Postgres `max_connections`（默认 100）对齐。
- **验收标准**：
  - `docker compose up` 后 `docker exec backend ps aux` 看到 4 个 worker。
  - 并发 10 个请求响应时间不退化。
  - Redis 限流在多 worker 间共享（用两个不同端口打同一限流 key 验证）。

### P1-4 JWT 短期 access token + refresh token

- **优化点**：
  1. `ACCESS_TOKEN_EXPIRE_MINUTES = 30`（当前 30 天）。
  2. 新增 `/api/auth/refresh` 端点，签发 refresh token（7 天），前端 HttpOnly cookie 存储。
  3. token payload 加 `type: access | refresh` 声明，防误用。
- **为什么**：
  - 【官方】FastAPI OAuth2-JWT 教程 https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/ 示例用 `ACCESS_TOKEN_EXPIRE_MINUTES = 30`。
  - 【社区】多篇实践（techoral.com、coddykit.com）强调长生命周期 JWT 泄露即永久失陷，短 access + refresh 是标准做法。
  - 当前 30 天 JWT 无法吊销，SECRET_KEY 泄露即全员失陷一个月。
- **对本项目适配度**：中。单用户自己用，30 天便利 > 安全收益；但若项目要给朋友试用，建议改。
- **工作量**：1.5 人日（含前端 token 刷新逻辑、refresh token 表或 jti 黑名单）。
- **风险**：中。refresh token 要落库才能吊销，引入表结构变更。
- **验收标准**：
  - access token 30 分钟后 401。
  - 用 refresh token 调 `/refresh` 拿到新 access。
  - 登出接口能吊销 refresh token。

### P1-5 CI 加 ruff + bandit + pip-audit

- **优化点**：
  1. `pip install ruff bandit pip-audit` 加到 `requirements-dev.txt`。
  2. `.github/workflows/` 新增 job：`ruff check app/`、`bandit -r app/`、`pip-audit`。
  3. 可选 `pre-commit` 本地钩子。
- **为什么**：
  - 【官方】ruff 官方 https://beta.ruff.rs 可替代 flake8 / black / isort / pyupgrade，FastAPI 自身在用。
  - 【社区】ruff 内置 S 规则集即 bandit 子集（tutorials.technology 2026 综述）。
  - pip-audit 基于 PyPI Advisory DB 扫依赖 CVE。
  - 当前 CI 7 job 只跑测试，不扫代码质量与依赖漏洞。
- **对本项目适配度**：高。
- **工作量**：1 人日（含首次全量扫描修复）。
- **风险**：低。ruff 初始可能报一堆风格问题，先 `--fix` 自动修。
- **验收标准**：
  - CI 新增 job 全绿。
  - 故意写一句 `eval(user_input)` 触发 bandit 报警，PR 被 block。

### P1-6 PostgreSQL 定时备份（pg_dump + 保留策略）

- **优化点**：
  1. 新增 `scripts/backup.sh`：`docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > /backups/tea_$(date +%F).sql.gz`。
  2. crontab 每天凌晨 2 点跑，保留最近 14 天。
  3. 每月做一次恢复演练（`pg_restore` 到临时库验证）。
- **为什么**：
  - 【官方】PostgreSQL 17 文档 https://www.postgresql.org/docs/17/continuous-archiving.html PITR 章节。
  - 【社区】tutorials.technology 2026 综述："Test restores monthly — backup processes that have never been tested are not backups."
  - 当前只有 `pgdata` 卷，磁盘坏 = 数据全丢。
- **对本项目适配度**：高。单用户数据量小（MB 级），pg_dump 秒级完成。
- **工作量**：0.5 人日。
- **风险**：低。
- **验收标准**：
  - `/backups/` 目录每天出现一个 `.sql.gz`。
  - 从备份恢复到临时库，`SELECT count(*) FROM users` 与生产一致。

### P1-7 liveness / readiness 分离

- **优化点**：
  - `/live`：只返回 200（进程活着），不查 DB。
  - `/ready`：查 DB + Redis 连通性，失败返回 503（摘流量但不重启）。
  - `/health` 保留为 readiness 别名（兼容现有 Docker healthcheck）。
- **为什么**：
  - 【官方】Kubernetes 官方文档 https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/ 明确：readiness 失败摘流量不重启，liveness 失败重启。
  - 当前 `/health` 查 DB，DB 抖动会导致 Docker 把 backend 容器重启，其实 DB 恢复后自己就好了。
- **对本项目适配度**：中。Docker Compose 没有 K8s 那么精细，但 Nginx `proxy_next_upstream` 与容器 healthcheck 仍能受益。
- **工作量**：0.5 人时。
- **风险**：低。
- **验收标准**：
  - 停掉 DB，`/ready` 返回 503，`/live` 仍 200。
  - 恢复 DB 后 `/ready` 自动回 200。

### P1-8 AI 代理加熔断（pybreaker）

- **优化点**：用 `pybreaker` 包装 `_proxy`，fail_max=5、reset_timeout=30s，熔断期间直接走规则引擎降级。
- **为什么**：
  - 【官方】pybreaker PyPI https://pypi.org/project/pybreaker/ 是 Nygard《Release It!》熔断模式的 Python 实现。
  - DeepSeek 抖动连续失败时，每个请求都等 30s 超时 = 雪崩。熔断后 30s 内直接 503，前端立即走规则兜底。
- **对本项目适配度**：高。项目已有"未配 key 走规则"的降级逻辑，熔断只是把"配了 key 但服务挂"也接到同一条路上。
- **工作量**：0.5 人日。
- **风险**：低。注意熔断状态在多 worker 间不共享（可接受，单用户场景）。
- **验收标准**：mock DeepSeek 连续 5 次 500，第 6 次立即返回 503 且耗时 < 100ms。

---

## 3. P2：远期 / 按需

### P2-1 OpenTelemetry 分布式追踪

- **优化点**：`opentelemetry-sdk` + `opentelemetry-instrumentation-fastapi`，导出到本机 Jaeger / Tempo。
- **为什么**：Sentry 已有错误追踪，OTel 补性能追踪。
- **对本项目适配度**：低。单进程 + 单外部依赖（DeepSeek），调用链短，request_id 已能解决 80% 问题。
- **工作量**：2 人日。
- **建议**：P1-1 结构化日志上线后评估，不够再上。

### P2-2 WAL 归档 + PITR

- **优化点**：`postgresql.conf` 开 `wal_level=replica` + `archive_mode=on` + `archive_command='cp %p /archive/%f'`。
- **为什么**：RPO 从"1 小时"降到"接近 0"。
- **对本项目适配度**：低。单用户自托管，pg_dump 每日备份 RPO=24h 已够用；PITR 配置复杂，恢复演练成本高。
- **建议**：数据量涨到 GB 级或多人协作再做。

### P2-3 mypy 严格类型 + trivy 镜像扫描

- **优化点**：mypy 跑 `app/`；CI 加 `trivy image <image>` 扫镜像漏洞。
- **为什么**：【官方】mypy 是 Python 事实标准类型检查器；trivy 是 Aqua 开源镜像扫描器。
- **对本项目适配度**：中。后端代码量小，mypy 一次性补类型 annotation 成本 ~1 人日；trivy 在 CI 跑很轻。
- **建议**：P1-5 ruff 落地后再加。

### P2-4 HSTS + HTTPS 终端

- **优化点**：Nginx 加 `Strict-Transport-Security` 头；上 Caddy / Traefik 自动签 Let's Encrypt。
- **为什么**：HTTP 阶段加 HSTS 会把浏览器锁死，必须 HTTPS 后再上。
- **对本项目适配度**：取决于是否暴露公网。仅本地 / 内网时不需要。

### P2-5 慢查询日志 + 索引审计

- **优化点**：Postgres 开 `log_min_duration_statement=1000`；定期 `pg_stat_statements` 看 Top N 慢查询。
- **为什么**：【官方】PostgreSQL 文档。
- **对本项目适配度**：低。单用户数据量小，N+1 还没成为问题；当前 `record_service.list_records` 应确认没有 N+1。
- **建议**：数据量涨到 1 万条记录后再查。

---

## 4. 与项目现有约束的冲突与取舍

| 建议 | 与现有约束冲突？ | 取舍说明 |
| --- | --- | --- |
| P1-3 多 worker | 与"Redis 限流降级"耦合 | 现有 MemoryRateStore 单进程兜底，多 worker 后必须强依赖 Redis。项目 Redis 已绑 127.0.0.1 安全，可接受。 |
| P1-4 refresh token | 与"登录/云同步暂缓"方向相关 | 不涉及云同步，只是 JWT 生命周期改造。但引入 refresh 表 = 新迁移，按 AGENTS.md 必须走 alembic 流程。 |
| P1-2 Prometheus + Grafana | 与"免费自托管"一致 | 都是开源免费，单机 Compose 即可。 |
| P2-1 OTel / Jaeger | 与"不引入重型依赖"有摩擦 | 暂不上，等结构化日志不够用再说。 |
| P2-2 PITR | 与"单机自托管"规模不匹配 | 不做。 |
| Argon2id 迁移 | 与"bcrypt 必须锁定 ==4.0.1"硬冲突 | **不做**。OWASP 明确 legacy bcrypt work factor ≥10 可接受，当前 passlib 默认 12 达标。迁移 Argon2id 要改 passlib 版本，触发 AGENTS.md 禁止的依赖升级。 |
| 微服务 / 消息队列 / K8s | 与"单用户自托管"规模严重不匹配 | **不做**。四维甄别：高投入零价值伪需求。 |

---

## 5. 不建议做的事（伪需求甄别）

按 AGENTS.md「四维甄别」与「不引入重型依赖」原则，以下"企业级标配"在本项目规模下是伪需求：

1. **Celery / RQ 异步任务队列**：项目无后台任务（无邮件、无报表、无定时作业），pg_dump 用 cron 够了。
2. **数据库读写分离 / 主从复制**：单实例写入 QPS 个位数，过度设计。
3. **Redis Cluster / 哨兵**：单实例 Redis 已绑 127.0.0.1，挂了自动降级内存限流。
4. **服务网格（Istio / Linkerd）**：单机 Compose 无意义。
5. **多租户 RBAC / ABAC**：单用户 / 小团队，`is_admin` 布尔字段都嫌多余。
6. **GraphQL / gRPC**：REST 已够，前端 PWA 对 REST 友好。
7. **外部 APM（Datadog / New Relic 付费版）**：与"免费自托管"冲突，Sentry 免费层 + Prometheus 自托管已覆盖。

---

## 6. 优先级汇总

| 优先级 | 编号 | 优化点 | 工作量 | 风险 |
| --- | --- | --- | --- | --- |
| **P0** | P0-1 | 修复 X-Forwarded-For 真实 IP（限流 bug） | 0.5h | 低 |
| **P0** | P0-2 | 连接池显式配置（recycle/pre_ping） | 0.5h | 低 |
| **P0** | P0-3 | Dockerfile 多阶段 + non-root + .dockerignore | 1h | 低 |
| **P0** | P0-4 | TrustedHostMiddleware | 0.5h | 低 |
| **P0** | P0-5 | SECRET_KEY 强度启动校验 | 0.2h | 低 |
| **P0** | P0-6 | 登录/注册专项限流 | 0.5h | 低 |
| **P0** | P0-7 | AI 代理异步化 + 轻量重试 | 1h | 低 |
| **P1** | P1-1 | 结构化日志 + request_id | 1.5d | 低 |
| **P1** | P1-2 | Prometheus /metrics + 单机 Grafana | 1d | 低 |
| **P1** | P1-3 | Gunicorn 多 worker | 0.5h | 中（Redis 强依赖） |
| **P1** | P1-4 | JWT 短期 access + refresh | 1.5d | 中（新表 + 前端改造） |
| **P1** | P1-5 | CI 加 ruff + bandit + pip-audit | 1d | 低 |
| **P1** | P1-6 | pg_dump 定时备份 + 恢复演练 | 0.5d | 低 |
| **P1** | P1-7 | liveness / readiness 分离 | 0.5h | 低 |
| **P1** | P1-8 | AI 代理熔断（pybreaker） | 0.5d | 低 |
| **P2** | P2-1 | OpenTelemetry 追踪 | 2d | 低 |
| **P2** | P2-2 | WAL 归档 + PITR | 1d | 中 |
| **P2** | P2-3 | mypy 严格 + trivy | 1.5d | 低 |
| **P2** | P2-4 | HSTS + 自动 HTTPS | 0.5d | 低 |
| **P2** | P2-5 | 慢查询日志 + 索引审计 | 0.5d | 低 |

**P0 合计约 4 人时，建议本周内一次性做完。**
**P1 合计约 8 人日，建议分两个迭代。**
**P2 按需触发，不排期。**

---

## 7. 来源清单

**官方文档**
- FastAPI 部署 workers：https://fastapi.tiangolo.com/deployment/server-workers/
- FastAPI Behind a Proxy：https://fastapi.tiangolo.com/advanced/behind-a-proxy/
- FastAPI Docker 部署：https://fastapi.tiangolo.com/deployment/docker/
- FastAPI OAuth2-JWT 教程：https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/
- SQLAlchemy 2.0 Connection Pooling：https://docs.sqlalchemy.org/en/20/core/pooling.html
- Alembic Autogenerate：https://alembic.sqlalchemy.org/en/latest/autogenerate.html
- PostgreSQL 17 Continuous Archiving / PITR：https://www.postgresql.org/docs/17/continuous-archiving.html
- Kubernetes Liveness/Readiness Probes：https://kubernetes.io/docs/concepts/configuration/liveness-readiness-startup-probes/
- OWASP API Security Top 10 2023 - API2 Broken Authentication：https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/
- OWASP Password Storage Cheat Sheet：https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet
- Prometheus Getting Started：https://prometheus.io/docs/tutorials/getting_started/
- Docker Python 官方指南：https://docs.docker.com/guides/python/develop/
- structlog 官方文档：https://www.structlog.org/
- pybreaker PyPI：https://pypi.org/project/pybreaker/
- prometheus-fastapi-instrumentator PyPI：https://pypi.org/project/prometheus-fastapi-instrumentator/
- ruff 官方：https://beta.ruff.rs

**社区 / 一方博客（已标注）**
- Apitally FastAPI 日志指南：https://apitally.io/blog/fastapi-logging-guide
- markaicode FastAPI + Nginx：https://markaicode.com/integrate/fastapi-with-nginx/
- thecodeforge.io SQLAlchemy 生产配置：https://thecodeforge.io/python/fastapi-sqlalchemy-database/
- tutorials.technology PostgreSQL 备份 2026：https://tutorials.technology/tutorials/postgresql-backup-restore-2026.html
- timderzhavets.com Alembic 零停机迁移：https://timderzhavets.com/blog/zero-downtime-schema-changes-with-alembic-a-production/
- techoral.com Python JWT refresh flow：https://techoral.com/python/python-jwt-authentication.html
