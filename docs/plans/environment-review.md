---
last_updated: 2026-10-07
status: active
owner: tea-harness
---

# 每周环境审查清单（30 分钟）

> Harness 285「每周环境审查」固化。每周一次，逐项过一遍，问题当场修或记录到 TODO-PRIORITY。
> 期望结果：`verify-harness.cjs` 输出 `ERRORS: []`。

## 1. 治理一致性（5 分钟）

- [ ] `node scripts/verify-harness.cjs` → `ERRORS: []`
- [ ] 改过 CI job 数 / ADR 编号 / 技能数量后，AGENTS.md + 规则文档已同步（漂移当场修）
- [ ] 新技能 README 路由表已登记（README 不列 = 不存在）

## 2. 依赖与安全（5 分钟）

- [ ] 前端：`npm audit --registry=https://registry.npmjs.org`（npmmirror 无 audit endpoint）
- [ ] 后端：`pip-audit`（旧 FastAPI 过渡期）/ `mvn` 依赖体检（重写完成后）
- [ ] 新依赖引入前已查 package.json / pom.xml（禁随手新增）

## 3. 构建与测试（10 分钟）

- [ ] `npm run quality`（lint + type-check + test + build + verify）通过
- [ ] 后端 `mvn test` 通过（含 ArchUnit LayerDependencyTest）
- [ ] 改了流程/路由 → `npm run test:e2e` 通过

## 4. 环境残留（5 分钟）

- [ ] 无 Exited 状态的本地容器堆积（postgres 等，`docker ps -a`）
- [ ] 无游离临时文件/测试残留（test-results / playwright-report 不入库）
- [ ] 旧分支已合并清理（feature/* 合入 main 后删除）

## 5. 文档活性（5 分钟）

- [ ] docs 新文档带 frontmatter（`node scripts/add-doc-meta.cjs --dry-run` 应无 noFm）
- [ ] 已过期文档标记 `status: deprecated`，不删除（留档）
- [ ] plans/ 与 reference/ 目录惯例未被绕过（新计划类入 plans/，新稳定参考入 reference/）
- [ ] **内容级抽查**：system-overview / wiki 四件套 / error-codes 抽 1-2 篇，正文 vs 实现对照（verify-harness 只查元数据，内容活性靠本条）

## 发现处理

1. 能当场修的当场修，修完重跑对应验证。
2. 需决策的记入 `docs/TODO-PRIORITY.md`（标 P 级与影响）。
3. 连续两周同一问题复发 → 写进 AGENTS.md §13 学习记录（沉淀为规则）。
