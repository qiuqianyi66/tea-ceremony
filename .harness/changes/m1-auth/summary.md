# m1-auth 变更记录

> 目录：`.harness/changes/m1-auth/`，与 git 分支 `feature/m1-auth` 同名。
> 本变更**无数据库迁移**（认证使用 V1 `users` 表，V1 为 13 表全量初始迁移），按模板可省略 db-migrations.sql / rollback.sql。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | m1-auth（T6 认证切片，批 B 第一片） |
| 分支 | `feature/m1-auth`（基于 feature/m1-backend-skeleton） |
| 需求来源 | PRD §7.2 认证 / M1 批 B 方案（T6-T9） |
| 类型 | feat |
| 预计工作量 | 已完成（前日实现 + 今日集成验证） |
| 涉及范围 | 后端（auth 域）+ pom（jjwt 0.12.6 / testcontainers 1.21.4） |

## 二、需求与方案

### 需求描述

注册/登录 + 无状态 JWT 认证：BCrypt 哈希、`/api/v1/auth/register|login`、受保护接口校验 Bearer token、未认证统一 401 ApiResponse。

### 验收标准（Given-When-Then）

- **Given** 新用户提交合法注册信息
- **When** POST /api/v1/auth/register
- **Then** 200 + TokenVo（token/expiresInSeconds/user），users 表持久化（JSONB preferredAroma 默认 '[]'）

- **Given** 已注册用户
- **When** POST /api/v1/auth/login（密码正确 / 错误）
- **Then** 200 + TokenVo / 401 UNAUTHORIZED（统一文案，防枚举）

- **Given** 未携带或携带无效 token
- **When** 访问受保护路径
- **Then** 401 UNAUTHORIZED 统一 ApiResponse（AuthenticationEntryPoint）

### 技术方案

- 实现：`auth/` 四件套（entity/repository/service/controller）+ security/（JwtService/JwtAuthenticationFilter/SecurityConfig/AuthenticatedUser）+ dto/vo
- JWT：jjwt 0.12.6（HS384，Clock 注入保证可测）
- 密码：BCryptPasswordEncoder
- 安全：无状态会话、/api/v1/auth/** 与 /actuator/health 放行、其余需认证；401 由 AuthenticationEntryPoint 输出统一格式
- 集成验证：@SpringBootTest + Testcontainers postgres:16（Flyway V1 + JPA validate 真实库）+ RANDOM_PORT 真实 HTTP
- 兼容性修复：Testcontainers 1.21.4（Docker Engine v29 最低 API 1.44，1.21.2 的 docker-java 被 npipe 400 拒绝）

## 三、影响分析

| 维度 | 影响 |
|---|---|
| 数据模型 | 无库变更（复用 V1 users） |
| API | 新增 POST /api/v1/auth/register、POST /api/v1/auth/login（同步 .harness/wiki/api-contract.md） |
| 前端 | 无（后续切片接入） |
| 承重墙 | 幂等/评分模型不受影响；JWT 无状态设计（无 jti/账号禁用，需求出现再引入） |
| 回滚 | 代码回退：git checkout 前一 commit；无迁移回滚 |

## 四、质量门禁（自检）

- [x] 编码规范红线 15 条零违反（分层单向 / 统一 ApiResponse / BCrypt / 事务注解）
- [x] 编译 0 error（`mvn -q compile`）
- [x] 单元+集成测试：31/31 全绿（单测 25 + AuthIntegrationTest 6）
- [x] 迁移往返：无本切片迁移（V1 往返由批 A T3 实测通过）
- [x] expert-reviewer 评审：🔴 零、🟡 清零（见 review.md 2026-10-06 复核）
- [x] 自检清单逐项完成

## 五、部署与观测

- [x] staging 冒烟通过（T5：health 200 / register+login / 404 / 401 / 403）
- [ ] 部署记录（随 M1 整体部署，未单独发版）
- [ ] 30 分钟观测期（随 M1 部署后执行）
