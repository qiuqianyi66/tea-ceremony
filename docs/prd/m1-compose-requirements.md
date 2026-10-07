---
last_updated: 2026-10-06
status: active
owner: yanha
---

# m1-compose 部署编排 — 需求分析（PRD 级）

> 阶段 1 产出（开发流程规范：需求分析先行）。批 B 第四片（T9）：部署编排改造 + CI 接线。
> 事实来源：`docker-compose.yml` / `backend/Dockerfile` / `nginx/Dockerfile` / `nginx.conf`（现状均读原文）、`DEPLOY.md`、`.github/workflows/ci.yml`、`application.yml`、`backend/pom.xml`、`database/init.sql`、`package.json`。日期：2026-10-06。状态：**待用户确认**（用户已"继续吧"授权，决策点按推荐执行）。

## 1. 背景与目标

旧 FastAPI 栈的 Docker 编排（compose + Python Dockerfile + nginx）已"弃用"（DEPLOY.md 声明），但文件保留。后端重写为 Spring Boot 后，AGENTS.md §11 声明"部署：Docker Compose 编排（backend/frontend/postgres/nginx），后端重写后启用"——**T9 把保留的旧编排改造为 Spring Boot 新栈，并把新后端测试接入 CI**，达成 M1 部署闭环。

## 2. 范围与边界

| 方向 | 内容 |
|---|---|
| 做（F9-1~5） | compose 编排改造（db/backend/frontend 三服务）；backend Dockerfile 重写（Maven 多阶段）；前端容器化构建；nginx 反代端口更新；CI 加 Spring Boot 后端 job；DEPLOY.md/.env.example 同步 |
| 不做 | 实际部署到生产服务器（编排验证在本机 Docker 完成）；改前端代码；动旧 FastAPI 部署脚本（保留参考）；Redis（新栈无依赖，PRD 已裁） |

## 3. 现状事实（已核实）

| 项 | 现状 | T9 处置 |
|---|---|---|
| docker-compose.yml | db(postgres:16-alpine, 5432) + redis + backend(FastAPI 8000) + frontend(nginx 80, 挂载宿主机 dist + nginx.conf) | 移除 redis；db 移除 init.sql 挂载；backend 改 Spring Boot 8080；frontend 改容器化构建 |
| database/init.sql | 旧文化库建表脚本（CREATE TABLE IF NOT EXISTS，181 行） | **必须移除挂载**：预建表与 Flyway V1/V2 冲突（V1 用 CREATE TABLE 非 IF NOT EXISTS，会报 already exists） |
| backend/Dockerfile | Python 3.12 slim（gunicorn 4 worker） | 重写：Maven 多阶段（maven:3.9-eclipse-temurin-21 → eclipse-temurin:21-jre-alpine），EXPOSE 8080，非 root |
| nginx/Dockerfile | nginx:alpine + brotli 模块层（挂载宿主机 dist） | 改为多阶段：node:22 build（npm ci + build-only）→ nginx:alpine + brotli，自包含 |
| nginx.conf | `proxy_pass http://backend:8000` | 改 `backend:8080`；安全头/brotli/SPA 保留 |
| application.yml | port ${PORT:8080}；datasource ${DB_URL:/DB_USER:/DB_PASSWORD:}；Flyway classpath；actuator /actuator/health | 环境变量由 compose 注入（DB_URL=jdbc:postgresql://db:5432/tea 等） |
| pom.xml | **无 Redis 依赖**（只有 data-jpa） | redis 服务移除依据 |
| ci.yml | 11 job：前端×4 + 旧后端 pytest/ruff/bandit + migration-test(Alembic) + compose-validate | **加 Spring Boot job**（JDK21 + mvn -q test，Testcontainers 需 Docker——ubuntu runner 自带）；compose-validate 需设置 POSTGRES_PASSWORD env（`:?` 必填变量） |

## 4. 功能需求（Given-When-Then）

### F9-1 compose 编排（Spring Boot 新栈）

- Given compose 文件，When `docker compose config`，Then 校验通过（三服务：db/backend/frontend）
- Given 本机 Docker，When `docker compose up -d --build`，Then 三服务全部 healthy（db 就绪 → backend 就绪 → frontend 依赖 backend）
- Given 编排运行，Then `/actuator/health` UP、`GET /api/v1/teas` 匿名 200（V2 种子入库）、`POST /api/v1/records` 无 token 401、前端 80 返回 index.html

### F9-2 backend 镜像（Maven 多阶段）

- Given backend/Dockerfile，When `docker build`，Then 镜像含可运行 jar，非 root 用户，EXPOSE 8080，健康检查 /actuator/health
- Given 无本地 Maven 缓存，When 构建，Then 依赖在 builder 层缓存（增量构建快）

### F9-3 frontend 镜像 + nginx

- Given nginx/Dockerfile，When `docker build`，Then 产物 = vite build 静态文件 + brotli 模块 nginx，`/api/` 反代 `backend:8080`
- Given SPA 路由，When 访问 `/任意前端路由`，Then try_files 回退 index.html

### F9-4 CI 接线

- Given push/PR 到 main，When CI 运行，Then 新增 backend-springboot job：JDK21 + `mvn -q test`（含 Testcontainers 集成测试）全绿
- Given compose-validate job，Then `docker compose config --quiet` 通过（POSTGRES_PASSWORD 已注入）

### F9-5 文档同步

- Given DEPLOY.md，Then 新增"Spring Boot 新栈 Docker Compose 部署"章节，更新"已弃用 Docker"声明（新栈启用，旧原生脚本保留参考）
- Given .env.example，Then 同步新栈环境变量（DB_URL/DB_USER/DB_PASSWORD/JWT_SECRET/PORT）

## 5. 非功能约束

| 维度 | 约束 |
|---|---|
| 安全 | 容器非 root（backend/frontend）；密钥经环境变量注入（.env 不入库）；db 数据卷 pgdata 持久化 |
| 可恢复 | Flyway 迁移自动执行（V1+V2）；数据在 pgdata 卷；compose down 不丢数据 |
| 一致性 | 后端测试 = 本地全量（49→74 全绿）；CI 与本地同一命令 `mvn -q test` |
| 性能 | JRE-alpine 小镜像；builder 层缓存依赖；nginx brotli/gzip |

## 6. 影响分析

| 维度 | 影响 |
|---|---|
| 部署 | compose 从 FastAPI 栈切 Spring Boot（DEPLOY.md 声明更新）；旧原生脚本保留不删 |
| 数据 | schema 归 Flyway（init.sql 移除）；pgdata 卷兼容（表由 Flyway 建，旧库需重建） |
| CI | 新增 backend-springboot job（含 Testcontainers，需 runner Docker）；compose-validate 修 env |
| 前端 | 构建迁移到容器（npm run build-only，CI 同款）；本地 dev 流程不变 |
| 回滚 | git 回退编排文件；容器 docker compose down + 旧分支重建 |

## 7. 决策点（按推荐执行）

| # | 决策 | 推荐 | 备选 |
|---|---|---|---|
| D9-1 | redis 服务 | **移除**（pom 无依赖，PRD 已裁；限流未纳入 M1） | 保留空转（资源浪费 + 无消费者） |
| D9-2 | database/init.sql | **移除挂载**（与 Flyway 冲突，schema 唯一归 Flyway） | 保留（容器首启预建表 → V1 报 already exists） |
| D9-3 | 前端构建方式 | **多阶段容器化**（node build → nginx，compose 自包含） | 挂载宿主机 dist（依赖 CI 产物，部署与构建耦合） |
| D9-4 | backend 镜像/健康检查 | **temurin-21-jre-alpine**（小 + busybox wget）+ `/actuator/health` | temurin full jre（大，多 ~100MB） |

## 8. 验收清单（阶段 1 自检）

- [x] 功能 F9-1~5 有编号 + Given-When-Then
- [x] 影响分析完整（部署/数据/CI/前端/回滚）
- [x] 决策点 D9-1~4 有推荐
- [x] 冲突事实已核实（init.sql vs Flyway、pom 无 Redis、端口 8080）
- [x] 不做项明确（不部署生产、不改前端代码）
