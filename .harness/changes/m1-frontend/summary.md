# m1-frontend 变更记录

> 目录：`.harness/changes/m1-frontend/`，与 git 分支 `feature/m1-frontend` 同名。
> 三件套：本文件 + `db-migrations.sql`（无变更声明）+ `rollback.sql`（无变更声明）——**T10 零迁移**（纯前端契约适配）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | m1-frontend（T10 前端联调切片，批 C 第一片） |
| 分支 | `feature/m1-frontend`（基于 main @ 55b4d52） |
| 需求来源 | `docs/prd/m1-frontend-requirements.md`（2026-10-06 用户确认）+ 需求分析先行规范 |
| 类型 | feat |
| 涉及范围 | 前端 auth/teas/records 三域 API 切 Spring Boot `/api/v1` + vite dev proxy 8080 + api-contract 补登 v1 auth + 契约回归测试 |

## 二、需求与方案

### 需求描述

前端三域从旧 FastAPI（`/api` → 8000）切到 Spring Boot 新后端（`/api/v1` → 8080）：认证、茶叶目录、品鉴记录；AI/culture 走自动降级（承重墙零改动）；评分透传不重算。

### 验收标准（Given-When-Then，见需求文档 F10-1~5）

- **F10-1** auth：`/v1/auth/register|login` + 解包 `ApiResponse.data`（TokenVo.token→access_token、user.displayName→display_name 还原）；401 登录失败不触发全局跳转（http.ts `/auth/` 豁免兼容）
- **F10-2** teas：`/v1/teas?category=&page=&size=100` + 分页解包 + TeaVo 全字段映射（真实汤色/干茶色替换硬编码）
- **F10-3** records：`/v1/records`（list 分页解包、create client_id 必填幂等、delete 解包）
- **F10-4** vite proxy `/api` → 8080；AI/culture 404 → 规则引擎/RAG 空降级（不断链）
- **F10-5** api-contract.md 补登 `/api/v1/auth` 段

### 技术方案

- auth：`authApi` 层解包（D10-1，store/http 零改动）；请求体 `displayName`（camelCase，RegisterRequest 源码核实）；响应 `user.displayName`（后端无 snake_case 策略）→ 前端 `display_name` 还原
- teas：`URLSearchParams` 构造查询（中文编码）；`toLocalTea` 扩展映射（altitude 转字符串、historicalPeriod/waterRequirement、真实色值）；size=100 保"一次全量"语义（D10-4 详情仍本地数据）
- records：list/create/delete 解包 `data`；`toRecordDto` client_id 必填 + 兜底生成（V1 NOT NULL）；create/delete 不设 mock（失败抛错保离线同步语义）
- 承重墙（D10-2）：teaAI.ts `callLLM`/`fetchRAGContext` 的 `!res.ok → null/''` 已兼容 404，零改动

## 三、影响分析

| 维度 | 影响 |
|---|---|
| 数据模型 | **零迁移**（纯前端 + 文档） |
| 承重墙 | AI 降级链零改动（teaAI.ts）；离线同步语义保留（create 失败抛错）；评分透传零触碰；http.ts/authStorage 零改动 |
| API | 前端三域切 `/api/v1`；api-contract.md 补登 v1 auth 段（含 camelCase displayName 命名注意） |
| 前端 | auth.ts/teas.ts/records.ts + vite proxy；新增契约回归测试 7 例（154 全绿） |
| 旧栈 | auth/teas/records 旧端点前端不再调用；`/api/ai`、`/api/culture` 仍被 teaAI 请求（404 降级），旧后端退役等待 AI 切片 |
| 回滚 | git 回退前端分支；vite proxy 恢复 8000 即回旧栈 |

## 四、质量门禁（自检）

- [x] type-check 0 error（vue-tsc --build）
- [x] lint 0 issue（biome check 155 files）
- [x] 测试全绿 154/154（原 147 + api.spec 7：三域解包/字段映射/client_id 必填）
- [x] 生产构建通过（npm run build，PWA 生成）
- [x] 联调冒烟全链路（compose db+backend + vite dev proxy 8080）：teas 分页 200 / register+login TokenVo（displayName camelCase 实测）/ records 创建+幂等重提同 id / list 分页
- [x] expert-reviewer 评审通过：🔴 0 / 🟡 0（见 review.md）
- [x] api-contract.md 同步完成；需求文档差异矩阵已按源码定案更新

## 五、部署与观测

- [ ] 部署记录（随 M1 整体部署）
- [ ] 30 分钟观测期（随 M1 部署后执行）
