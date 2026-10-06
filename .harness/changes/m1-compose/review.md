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
1. **本地 `docker compose up --build` 完整验证被网络阻断**：`auth.docker.io:443` TCP 不可达（2 次重试 + Test-NetConnection 确认）、无系统代理、本地无 maven/node/nginx 镜像缓存 → 构建无法拉基础镜像。非代码缺陷；`docker compose config` 静态校验已过；CI（GitHub runner 网络正常）覆盖 mvn test + compose config；完整冒烟待网络恢复补跑（命令已写入 DEPLOY.md 〇.2）

## 自检清单

- [x] 6 维全覆盖
- [x] 🔴 零残留、🟡 清零
- [x] 评审记录已落盘（本文件）
- [x] 变更文件全量覆盖（含需求文档/CI/文档，无遗漏）
- [x] 未验证项如实声明（本地构建冒烟，含原因与替代验证路径）
