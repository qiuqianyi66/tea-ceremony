# 一盏茶 · Tea Ceremony

> 一席茶，一方天地，一念清心。

沉浸式在线茶道：入席、选茶、煮水、冲泡、品鉴——在浏览器里走完一场完整的工夫茶。
不是百科，不是计时器，是一座可以走进去的数字茶室。

**3D 茶席让每一步茶事可被看见；八维评分让品鉴可被沉淀；离线优先让这杯茶不被网络打断。**

[![License MIT](https://img.shields.io/badge/License-MIT-9E8050?style=for-the-badge&labelColor=1C1C1C)](LICENSE)
[![Built with Vue 3 · Spring Boot 3](https://img.shields.io/badge/Built_with-Vue_3_%C2%B7_Spring_Boot_3-5D4E37?style=for-the-badge&labelColor=1C1C1C)](https://vuejs.org/)
[![Domain Immersive Tea Ceremony](https://img.shields.io/badge/Domain-Immersive_Tea_Ceremony-6B7D5A?style=for-the-badge&labelColor=1C1C1C)](README.md)
[![Stack PWA · 3D · Offline-first](https://img.shields.io/badge/Stack-PWA_%C2%B7_3D_%C2%B7_Offline--first-3D3225?style=for-the-badge&labelColor=1C1C1C)](README.md)

[![CI](https://github.com/qiuqianyi66/tea-ceremony/actions/workflows/ci.yml/badge.svg)](https://github.com/qiuqianyi66/tea-ceremony/actions/workflows/ci.yml)

**中文** · [English](README.en.md) · [概述](#它是什么) · [界面](#核心界面) · [技术栈](#技术栈) · [快速开始](#快速开始) · [部署](DEPLOY.md) · [设计规范](DESIGN_SPEC.md)

## 立即体验

👉 **在线 Demo（无需注册，离线可用）**：[qiuqianyi66.github.io/tea-ceremony](https://qiuqianyi66.github.io/tea-ceremony/)
👉 **完整版（含后端，公网部署）**：[https://42.121.125.4](https://42.121.125.4/)

![一盏茶 · 社交封面](docs/screenshots/og-cover.png)

## 它是什么

大多数"茶文化"产品停在图文介绍。「一盏茶」把文化变成可操作、可反馈、可记录的一次茶事：

- **3D 茶席**：TresJS / Three.js 渲染的木桌茶器，注水有蒸汽，出汤看汤色，时间、节气、主题茶室影响氛围
- **完整流程闭环**：备器 → 煮水 → 温杯 → 醒茶 → 冲泡 → 观色 → 闻香 → 品味，八维口感评分 × 冲泡工艺系数
- **离线优先**：Dexie.js + IndexedDB，品鉴记录先落本地，断网也能泡，联网后自动同步
- **可分享**：一键生成带二维码的品鉴卡 PNG / 只读分享链接，把这席茶送给朋友
- **AI 茶灵**：五角色专家（选茶 / 冲泡 / 品鉴 / 茶文化 / 成长导师）+ 多工具 Agent + SSE 流式回复 + 跨会话长期记忆；RAG 向量检索（自托管本地 embedding，答案可溯源），断网自动降级到规则回复

## 核心界面

| 沉浸式首页 | 3D 冲泡 | 品鉴分享卡 |
| --- | --- | --- |
| ![首页](docs/screenshots/home.jpg) | ![冲泡](docs/screenshots/brew-3d-steeping.png) | ![品鉴卡](docs/screenshots/share.png) |

![选茶](docs/screenshots/select.png)
![3D 出汤](docs/screenshots/brew-3d-done.png)
![个人成长](docs/screenshots/growth-desktop.png)

## 为什么做

为三种人做的：

1. **想学茶但嫌麻烦的人**——要引导、要氛围，不想一上来就背六大茶类
2. **有品茶习惯的人**——要记录、要沉淀，喝完一杯有迹可循
3. **慢生活人群**——要陪伴感，五分钟不被打扰的茶歇

坚持：无广告、无付费墙、可自托管、离线可用。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3 + TypeScript（strict）+ Pinia + Vue Router + Tailwind CSS + Vite |
| 3D | Three.js / TresJS（KTX2 压缩贴图 + basis transcode） |
| 数据 | Dexie.js + IndexedDB（离线优先，`sync_status` 重试队列）；PostgreSQL + pgvector（RAG 向量检索）+ user_memory（跨会话记忆） |
| 后端 | Spring Boot 3.5 + Spring Data JPA + Spring AI Alibaba + Flyway（旧 FastAPI 仅维护） |
| AI | 后端代理 `/api/v1/ai/*`（浏览器禁止直连第三方）；五角色专家 + 多工具 Agent + SSE 流式回复 + 跨会话长期记忆；RAG 向量检索（自托管 bge-large-zh-v1.5 ONNX 本地嵌入 + pgvector cosine，DashScope 远程备降）；熔断降级 + request_id 请求链路贯穿 |
| 部署 | Docker Compose（frontend / backend / postgres / nginx），公网 ECS 在线，GitHub Pages 静态 Demo |
| 测试 | Vitest + fake-indexeddb、Playwright E2E + axe、Maven 全量测试（Testcontainers + ArchUnit + LayerDependency）、pytest（旧栈） |
| CI | GitHub Actions 14 job：类型检查+build+smoke / Vitest / Biome / 依赖审计 / gitleaks 密钥扫描 / E2E / axe 可访问性 / 后端语法 / pytest / ruff+bandit / Spring Boot Maven / 迁移往返 / Compose 校验 / harness 一致性 |

## 工程质量与治理

流程、规范、验证都写成代码，机器可查，不靠自觉。

- **AI 协作规则**：`AGENTS.md` 定义红线、开发流程与三轨道分诊（Fast / Guided / Controlled），先拆解、再动手、后验证
- **架构决策记录**：ADR-001~029（29 个），每个架构选择写「选 A 理由 + 否 B 理由 + 反转条件」；被砍的方案也留档（如 Graph 编排，四维甄别 0/4）；最近的决策覆盖自托管本地 embedding（ADR-029）与跨会话长期记忆（ADR-028）
- **技能体系**：66 个通用/领域技能（`.agents/skills`）+ 39 个流程族技能（`.harness/skills`），按需加载，README 路由表治理
- **CI 合并门禁**：14 job 全绿才合并——类型检查 / 单测 / lint / 依赖审计 / gitleaks / E2E / a11y / 后端双栈测试 / 迁移往返 / Compose 校验 / harness 一致性
- **确定性体检**：`verify-harness.cjs`（ADR/CI/技能/路径一致性，期望 ERRORS: []）、`audit-redlines.cjs`（红线机械化）、`audit-wiki-drift.cjs`（API 契约双向核对）、`audit-context-budget.cjs`（常驻上下文 token 预算）
- **AI 评测闭环**：50 条评测集 + LLM-as-Judge 全量判分；v9 全量真实分 0.86（2026-10-30，judgeCoverage 0.97）、RAG 命中率 0.48（recall@k=3/3）；口径纪律：只引用 judgeCoverage ≥ 0.95 的版本（v8 0.95 基线可查）
- **分支保护**：main 只走 PR，CI 全绿才合并

## 快速开始

只玩前端（推荐先跑这个）：

```bash
npm install
npm run dev
```

完整全栈（Docker Compose：PostgreSQL + Spring Boot 后端）：

```bash
cp .env.example .env        # Windows PowerShell 用 Copy-Item .env.example .env；编辑 POSTGRES_PASSWORD、JWT_SECRET、DB_PASSWORD
docker compose up -d --build
# 前端 http://localhost:5173，后端 http://localhost:18080
```

常用命令：`npm run type-check` · `npm run test` · `npm run build` · `npm run test:e2e`
后端测试：`cd backend && mvn -q test`（旧 FastAPI 栈：`python -m pytest tests -q`）

完整部署、架构说明、设计规范见：[DEPLOY.md](DEPLOY.md) · [CONTEXT.md](CONTEXT.md) · [DESIGN_SPEC.md](DESIGN_SPEC.md) · [3D_SPEC.md](3D_SPEC.md)

## 参与贡献

欢迎从 Good First Issue 入手——补茶名数据、补英文翻译、补测试、补茶器图标都算。
流程见 [CONTRIBUTING.md](CONTRIBUTING.md)，Issue 和 PR 模板已就位。

## 路线图

- 真实茶汤与茶器摄影素材替换占位图
- 茶单扩充到中国茶区主要品类（当前 66 款，目标 100+）
- 多人共席（分享卡从只读进化到双人茶会）
- 生产环境接入 Sentry 错误追踪与 Redis 限流

## 素材致谢

首页茶山背景 `src/assets/tea-mountain-hero.jpg`：摄影作者 Tanmoy281，来源 [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Darjeeling-tea-plantation.jpg)，[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.zh)；本项目仅做尺寸缩放与晨雾色调处理。
茶叶摄影：Pexels 可商用素材。

## License

[MIT](LICENSE) © 2026 严恒（qiuqianyi66）
