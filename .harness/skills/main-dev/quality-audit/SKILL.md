---
name: quality-audit
description: 质量四性审计：规范性/维护性/安全性/可扩展性四批检查 + 修复清单 + 分批提交门禁。当用户要求质量审计、四性审计、规范性/安全性/维护性/可扩展性检查，或大提交与发布前质量门时触发。
type: executable
verification: node scripts/audit-redlines.cjs && node scripts/verify-harness.cjs
---

# 质量四性审计（quality-audit）

四批审计覆盖代码质量四个维度。每批独立产出修复清单，分批修复、每批独立提交、逐批验证。禁止一次性大改后宣称完成。

## 触发条件

- 用户要求"质量审计 / 四性审计 / 规范性检查 / 安全审计 / 维护性检查 / 可扩展性检查"
- 大提交（跨模块 / 多文件）合并或发布前的质量门
- 需求分析（REQ）中质量四性验收重头的落地执行
- 不触发：单点 bug 修复（走 trouble-shooting）、新功能开发（走 request-analysis）、纯文档小改

## 前置条件（硬门，缺失回退）

- 仓库可运行：`npm run type-check` 与后端测试基线可跑（审计含运行验证）
- 已读 `.harness/rules/编码规范.md`（15 条红线，本技能只引用编号，不重复定义）
- 已读 `.harness/rules/技能规范.md`（技能治理）与 `.harness/rules/三层语义.md`（token 分工）
- 明确审计范围：全库或指定模块；未指定默认全库

## 规则 / 流程

### 批 1 规范性（红线 + 架构 + 风格）

1. 跑 `node scripts/audit-redlines.cjs`，期望 `ERRORS: []`（红线机械子集 R2/7/8/9/10/11/12/14）。
2. 跑后端 ArchUnit：`mvn test -Dtest=LayerDependencyTest`（分层单向依赖，红线 #1）。
3. 跑前端 `npm run lint`（Biome）。
4. 命中项 → 修复清单（格式见下），逐条修。

### 批 2 维护性（治理一致性 + 文档 + 死代码）

1. 跑 `node scripts/verify-harness.cjs`，期望 `ERRORS: []`（ADR/CI job/技能数/路径/wiki 四件套/changes 门禁）。
2. 跑 `node scripts/audit-wiki-drift.cjs`，期望 `ERRORS: []`（api-contract 端点 vs 代码路由双向核对）。
3. 核对 docs 元信息头（缺 frontmatter 时 `node scripts/add-doc-meta.cjs` 补齐，status 值域 active|draft|deprecated）。
4. 自查死代码孤儿：本批改动引入的失效 import/变量/函数当场清（已有死代码只提一句不删）。

### 批 3 安全性（越权 + 密钥 + 输入 + 面收敛）

1. 越权核对：所有需登录接口有鉴权；带 id/sessionId 的归属校验（非本人 404/403）；写路径不得横向越权。
2. 密钥核对：`git grep -lE "sk-|secret|password|token" -- backend/src .env*` 白名单核对；`.env*`、`*.pem`、`secrets/` 不入库（AGENTS.md §10）。
3. 输入校验：非法输入 → 业务异常（BadRequest 子类），不落 500。
4. 面收敛：CSP 头、限流（登录/AI 端点）、OWASP API 面（未鉴权面最小化）。
5. `npm audit --registry=https://registry.npmjs.org`（npmmirror 不实现 audit endpoint）。

### 批 4 可扩展性（契约 + 配置 + 迁移）

1. 契约核对：新增/修改端点已在 `.harness/wiki/api-contract.md` 登记（audit-wiki-drift 已机械核对路由）。
2. 配置化核对：环境相关值走 application.yml/.env（@Value 注入），禁硬编码；变化值有默认且可覆盖。
3. 迁移成对核对：Schema 变更 = Flyway up + rollback.sql 成对（红线 #7）；旧栈 Alembic 同规则。
4. 增量演进核对：改动可 expand-contract 或可 revert；不破坏承重墙（AI 降级链/幂等/评分模型）。

### 修复清单格式

每批产出 `.harness/changes/<feat>/quality-audit.md`，一行一条：

```
L<file:line>: <严重度> <问题>. <根因>. <修复>.
```

严重度：高危（数据/安全/承重墙）/ 中危（行为偏离规范）/ 低危（风格/文档）。高危清零才过，中低危列入清单排期。

### 分批提交门禁

- 每批修复独立 commit（`fix(audit): <批> ...`），批间可回退。
- 每批提交前跑该批对应验证命令。
- 修复只动审计命中的违规，禁止顺手重构、格式化、改注释。
- 全部四批完成后重跑批 1 主门禁（audit-redlines + verify-harness）确认全绿。

## 检查清单

- [ ] 批 1 规范性：audit-redlines ERRORS: [] + ArchUnit 绿 + Biome 绿
- [ ] 批 2 维护性：verify-harness ERRORS: [] + audit-wiki-drift ERRORS: [] + docs frontmatter 齐
- [ ] 批 3 安全性：越权/密钥/输入/CSP/限流五项核对 + npm audit 绿
- [ ] 批 4 可扩展性：契约登记 + 配置化 + 迁移成对 + 承重墙未动
- [ ] 修复清单已产出（格式合规），高危清零
- [ ] 每批独立 commit，批间可回退
- [ ] 无顺手重构（每行改动可追溯审计命中）

## 下一步

- 修复清单完成 → 按清单逐批修 → 批 1 主门禁重跑全绿 → 交付审计报告。
- 审计发现的新红线缺口 → 按 AGENTS.md §13 学习记录沉淀。
