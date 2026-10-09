---
last_updated: 2026-10-09
status: active
owner: yanha
---

# t14-k13-repomap 变更记录（T14/K13 仓库地图）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | t14-k13-repomap（仓库地图自动生成） |
| 分支 | 直接落 main（K13 独立 commit） |
| 需求来源 | PLAN §190-193（K13 repo map ≤300 行 + 符号抽查） |
| 类型 | feat |
| 涉及范围 | scripts/gen-repomap.cjs + docs/reference/repo-map.md（自动产物） |

## 二、需求与方案

### 需求描述

1. `node scripts/gen-repomap.cjs` → `docs/reference/repo-map.md`，≤300 行。
2. 抽查关键符号命中，防 map 与代码漂移。

### 技术方案

- 扫描 4 根：src / backend/src/main/java / scripts / docs（跳 node_modules/dist/target/.git/.venv 等）。
- 目录树截断 250 行 + 总量注记；总行数 270 ≤300。
- 抽查 8 个关键符号（teaAI/teaProcesses/stores/components-three/AiChatService/LibrarianAgent/RateLimitFilter/TODO-PRIORITY），关键词命中即算，缺失 exit 1。
- 产物带 frontmatter（docs 元信息头治理一致）+ 自动生成声明（勿手改）。

## 三、影响分析

- 影响面：新增 1 脚本 + 1 文档；不触碰代码。
- 契约变化：无。repo-map.md 供 AI 编码上下文四件套（.harness/wiki）之外的快速导航。
- 回滚：revert commit；产物可由脚本重新生成。

## 四、自检清单

- [x] 实跑：605 条目 / 树 250 行 / 文件总 270 行 ≤300 / 抽查 8/8 命中 / exit 0
- [x] frontmatter 元信息头齐备（title/last_updated）
- [x] 缺失任一符号 → exit 1（防漂移机制自带，未触发）
