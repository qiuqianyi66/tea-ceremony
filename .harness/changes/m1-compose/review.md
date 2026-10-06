# m1-compose 评审记录（expert-reviewer，T9.7）

> 评审对象：feature/m1-compose 全部变更（git diff 基线 = feature/m1-record@b113bf3）。
> 结论：**通过 —— 🔴 0 / 🟡 0 / 🟢 1 / 🔵 1**（不阻塞；🔵 为外部网络环境因素，非代码缺陷）

## 变更文件清单（全量覆盖）

| 类别 | 文件 |
|---|---|
| 需求 | `docs/prd/m1-compose-requirements.md`（新建） |
| 编排 | `docker-compose.yml`（重写：三服务 + 变量 + 健康检查） |
| 后端镜像 | `backend/Dockerfile`（Maven 多阶段）、`backend/.dockerignore`（+target） |
| 前端镜像 | `nginx/Dockerfile`（node build → nginx+brotli）、根 `.dockerignore`（新建）、`nginx.conf`（proxy_pass 8080 ×2） |
| CI | `.github/workflows/ci.yml`（+backend-springboot job + compose-validate env） |
| 文档 | `DEPLOY.md`（新栈章节 + 声明更新）、`.env.example`（新栈变量） |

## 六维评审

### 1. 正确性 ✅
- 依赖链：backend `depends_on db: service_healthy`；frontend `depends_on backend: service_healthy`（Spring 起时 Flyway 已迁移）
- 环境变量映射逐键核对：compose `DB_URL/DB_USER/DB_PASSWORD/JWT_SECRET` → application.yml `${DB_URL:...}/${DB_USER:...}/${DB_PASSWORD:...}/${JWT_SECRET:...}` ✓
- 健康检查 `/actuator/health`（actuator exposure 含 health ✓）+ temurin-alpine busybox `wget` ✓ + start_period 30s（容 Flyway V2 种子）
- **init.sql 移除挂载**（D9-2）：规避 V1 `CREATE TABLE` 与预建表冲突（风险前置识别——旧 compose 是隐藏炸弹）
- nginx 80 与 443 注释块 proxy_pass 均改 8080 ✓
- 前端多阶段：`npm ci` + `build-only`（与 CI 前端 job 同命令）；runtime COPY dist + nginx.conf ✓
- compose-validate 注入三个 `:?` 必填变量（此前该 job 缺变量会红）

### 2. 性能 ✅
- backend builder `mvn dependency:go-offline` 缓存层（pom 不变秒级增量）
- JRE-alpine runtime（~200MB 级，远小于 maven 镜像）；多阶段不携带构建工具
- 根/backend `.dockerignore` 控制构建上下文（排除 node_modules/dist/.venv/target/backend/文档等）
- 前端产物自包含镜像内（无宿主机 dist 挂载，部署与 CI 构建解耦）

### 3. 安全 ✅
- backend 非 root（`adduser -D -H` + USER appuser）；nginx 官方镜像默认非 root worker
- 密钥只经环境变量注入：compose `:?` 必填保护（缺键直接 config 失败，防漏配）；`.env` 不入库（.dockerignore 排除 + gitignore）
- db 不暴露宿主端口（仅容器网络，公网不可达）；旧 compose 的 5432 映射移除（本机 5432 被原生 PG 占用也印证必要性）
- nginx 安全头/CSP/brotli 保留

### 4. 一致性 ✅
- DEPLOY.md 声明与 AGENTS.md §11 对齐（后端重写后 Compose 编排主路径；旧原生脚本标注"仅历史参考"保留不删）
- .env.example 键名与 compose/application.yml 三方一致；旧变量保留（原生脚本继续可读）
- CI 后端命令与本地一致（`mvn -q test`）；前端镜像构建命令与 CI 前端 job 一致（`npm run build-only`）

### 5. 可维护性 ✅
- 注释说明决策原因（端口不映射、init.sql 移除、healthcheck 选型、builder 缓存），后续维护者不猜测
- 编排结构对齐 compose 惯例（depends_on condition / healthcheck / named volume）
- DEPLOY.md 新栈章节含完整命令链（部署/验证/维护/HTTPS 指引）

### 6. 架构合规 ✅
- 对齐 AGENTS.md §11 部署范式（postgres/backend/frontend-nginx 三服务 = 四组件语义）
- Flyway 唯一 schema 权威（init.sql 退出）；数据持久化 pgdata 卷
- 旧 FastAPI 栈文件保留不删（符合"旧栈仅维护不新增"）

## 分级问题

### 🟢 次要（记录，不阻塞）
1. db 端口从"映射 5432"改为"不映射"：本地调试如需直连 db，取消 compose 注释即可（已写注释指引）——行为变化有据（本机 5432 被原生 PG 占用 + 生产安全）

### 🔵 提示（不阻塞，外部环境因素）
1. **本地构建一度被 Docker Hub 网络阻断**：auth.docker.io 被 DNS 污染（解析到 Facebook/Dropbox IP）且无代理 → 两次重试失败。处理：用户开启 mihomo 代理（127.0.0.1:9674）→ Docker Desktop 重启跟随系统代理（daemon pull 生效）；BuildKit 拉 registry 仍不走 daemon 代理 → 用 `docker pull` 预拉 4 个基础镜像到本地（daemon 代理）后构建通过。**机器侧结论**：Docker Desktop 代理跟随系统代理；BuildKit registry 拉取需镜像本地缓存或 daemon 级代理；daemon.json proxies 会注入容器环境变量（见修复 2）

### 🟡 验证期修复（已处理并提交，原潜在缺陷）
1. **nginx brotli 版本锁定**：`nginx:alpine`（1.31.x）/`nginx:1.30-alpine`（1.30.5）均与 Alpine 仓库 `nginx-mod-http-brotli`（依赖 nginx=1.30.4-r1 精确版本）错配，apk 装不上 → Dockerfile 锁 `nginx:1.30.4-alpine`（镜像内包版本恰为 1.30.4-r1）✓ 实测 brotli 安装成功
2. **健康检查被代理污染**：daemon.json 代理配置会注入运行容器 HTTP_PROXY 环境变量，busybox wget 对 localhost 仍走代理 → 502 → healthcheck 加 `-Y off`（显式禁代理）✓ 实测 healthy

### 完整验证结果（2026-10-06，网络修复后）
- [x] `docker compose config` 通过
- [x] `docker compose up -d --build`：三服务全部 healthy（db → backend → frontend 依赖链正确）
- [x] 冒烟五项：/actuator/health `{"status":"UP"}` 200；GET /api/v1/teas 经 nginx 200（V2 种子 total=66）；POST /api/v1/records 无 token 401 统一格式；前端 80 → 200 text/html
- [x] Flyway V1+V2 容器首启自动迁移（日志：Successfully applied 2 migrations）

## 自检清单

- [x] 6 维全覆盖
- [x] 🔴 零残留、🟡 清零（2 项修复后）
- [x] 评审记录已落盘（本文件）
- [x] 变更文件全量覆盖（含需求文档/CI/文档，无遗漏）
- [x] 完整构建 + 冒烟已验证（网络修复后补跑）
