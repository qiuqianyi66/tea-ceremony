---
last_updated: 2026-10-09
status: active
owner: yanha
---

# quality-audit 变更记录（质量四性审计批 3/批 4）

> 目录：`.harness/changes/quality-audit/`。本切片为审计修复，无数据库迁移，故无 db-migrations.sql / rollback.sql。
> 审计清单与核对证据见同目录 `quality-audit.md`。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | quality-audit（批 3 安全性限流 + 批 4 可扩展性核对） |
| 分支 | 直接落 main（审计修复，独立 commit） |
| 需求来源 | REQ-quality-backlog F-8（安全性）/ 质量四性验收重头 |
| 类型 | fix |
| 涉及范围 | 后端（限流 Filter/错误码/安全配置/配置化） |

## 二、需求与方案

### 需求描述

1. 批 3 安全性：AI/登录公开端点无限流（Spring Boot 重写未迁移旧栈 RateLimitMiddleware）→ 新增滑动窗口限流。
2. 批 4 可扩展性：契约/配置化/迁移成对/承重墙四项核对。

### 技术方案

- RateLimitFilter（进程内存滑动窗口，IP+面维度，超阈值 429 统一 ApiResponse(RATE_LIMITED)），注册于 JWT 之前（注册序最先执行）。
- 配置 `tea.ratelimit.*` @Value 注入（跟随 garden.energy 模式），环境变量沿用旧栈 RATE_LIMIT_AI_MAX / RATE_LIMIT_LOGIN_MAX。
- 错误码 ErrorCode + RATE_LIMITED(429)。

## 三、影响分析

- 影响面：后端所有请求（仅 /api/v1/ai/** 与 /api/v1/auth/login 命中限流，其余直放）。
- 回滚路径：删 SecurityConfig 两行 addFilterBefore 即回退，或调大环境变量阈值。
- 契约变化：无新端点（Filter 基础设施）；wiki/api-contract.md 无需更新。
- 承重墙确认：未触及 teaAI.ts 降级链 / 评分模型 / 幂等。

## 四、自检清单

- [x] 编码规范红线零违反（audit-redlines ERRORS: []）
- [x] 测试全绿：RateLimitFilterTest 5/5 + mvn 全量 exit=0
- [x] 数据库迁移：无（已注明）
- [x] 无顺手重构（改动仅审计命中项）
- [x] 批 1 主门禁：audit-redlines + audit-wiki-drift ERRORS: []，verify-harness 全绿
