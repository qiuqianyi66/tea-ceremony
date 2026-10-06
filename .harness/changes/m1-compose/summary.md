# m1-compose 变更记录

> 目录：`.harness/changes/m1-compose/`，与 git 分支 `feature/m1-compose` 同名。
> 三件套：本文件 + `db-migrations.sql`（无）+ `rollback.sql`（无）——**T9 零数据库迁移**（纯部署编排改造）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | m1-compose（T9 部署编排改造 + CI 接线，批 B 第四片） |
| 分支 | `feature/m1-compose`（基于 feature/m1-record） |
| 需求来源 | `docs/prd/m1-compose-requirements.md`（2026-10-06）+ 决策点 D9-1~4（按推荐） |
| 类型 | feat |
| 涉及范围 | compose / backend Dockerfile / 前端容器化 / nginx 反代 / CI / 部署文档 |

## 二、需求与方案

### 需求描述

把保留的旧 FastAPI 栈 Docker 编排改造成 Spring Boot 3.5 新栈（db/backend/frontend 三服务），并把新后端测试接入 CI，达成 M1 部署闭环。

### 验收标准（Given-When-Then，来自需求文档 F9-1~5）

- **F9-1** Given compose 文件 + 必填变量，When `docker compose config`，Then 校验通过；Given 本机 Docker，When `up -d --build`，Then 三服务 healthy + 冒烟（health UP / teas 200 / records 401 / 前端 80）
- **F9-2** Given backend/Dockerfile，When build，Then 可执行 jar + 非 root + EXPOSE 8080 + /actuator/health
- **F9-3** Given nginx/Dockerfile，When build，Then vite 产物 + brotli nginx + /api/ → backend:8080
- **F9-4** Given CI，Then backend-springboot job（mvn -q test 含 Testcontainers）全绿 + compose-validate 过
- **F9-5** Given DEPLOY.md/.env.example，Then 新栈章节与变量已同步

### 技术方案（决策点）

- D9-1 **移除 redis 服务**：pom 无 Redis 依赖，PRD 已裁（限流未纳入 M1）
- D9-2 **移除 database/init.sql 挂载**：旧建表脚本与 Flyway V1/V2 冲突（V1 用 CREATE TABLE 非 IF NOT EXISTS，预建表会报 already exists）；schema 唯一归 Flyway
- D9-3 **前端多阶段容器化**：node:22-alpine（npm ci + build-only，CI 同款）→ nginx:alpine + brotli，产物自包含；compose build context=`.` + 根 `.dockerignore`
- D9-4 **backend 镜像**：maven:3.9-eclipse-temurin-21（builder，go-offline 缓存）→ eclipse-temurin:21-jre-alpine（runtime 非 root）；健康检查 busybox wget `/actuator/health`（start_period 30s 容 Flyway 迁移）
- **db 不映射宿主端口**（本机 5432 被原生 PG 占用 + 生产不暴露更安全）
- CI：`backend-springboot` job（setup-java 21 + mvn -q test，Testcontainers 用 runner Docker）；`compose-validate` 注入 POSTGRES_PASSWORD/DB_PASSWORD/JWT_SECRET（`:?` 必填变量）

## 三、影响分析

| 维度 | 影响 |
|---|---|
| 部署 | compose 从 FastAPI 栈切 Spring Boot（DEPLOY.md 声明更新：新栈 Compose 推荐，旧原生脚本保留参考）；数据 schema 归 Flyway |
| 数据 | init.sql 移除挂载；pgdata 卷持久化；新栈首启 Flyway 自动迁移 V1+V2（157 种子） |
| CI | 新增 backend-springboot job（Maven + Testcontainers）；compose-validate 修必填变量 |
| 前端 | 构建迁移到容器（build-only）；本地 dev 流程不变（npm run dev + vite proxy） |
| 回滚 | git 回退编排文件 + docker compose down + 旧分支重建 |

## 四、质量门禁（自检）

- [x] 编码规范红线零违反（容器安全/密钥注入/最小改动）
- [x] `docker compose config` 校验通过（含必填变量）
- [x] 环境变量键名与 application.yml 逐一核对（DB_URL/DB_USER/DB_PASSWORD/JWT_SECRET → ${...}）
- [x] expert-reviewer 评审通过：🔴 0 / 🟡 0（见 review.md）
- [x] **本地 `docker compose up -d --build` 完整验证通过（2026-10-06，网络修复后）**：三服务全部 healthy；冒烟五项全绿（/actuator/health UP、GET /api/v1/teas 经 nginx 200 + V2 种子 total=66、POST /api/v1/records 无 token 401 统一格式、前端 80 → 200 text/html）；Flyway V1+V2 容器首启自动迁移 ✓
- [x] 验证期修复 2 项（见 review.md 🟡→🟢 处理）：nginx brotli 版本锁定、健康检查 -Y off 禁代理
- [x] DEPLOY.md / .env.example 同步完成

## 五、部署与观测

- [x] 完整编排冒烟通过（2026-10-06）
- [ ] 30 分钟观测期（随 M1 整体部署后执行）
