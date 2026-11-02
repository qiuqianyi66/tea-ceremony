# 一盏茶 · Tea Ceremony

> 沉浸式在线茶道应用：**Vue 3 + Spring Boot 3 + Spring AI Alibaba 全栈项目**，含 3D 茶席、离线优先 PWA、自托管 RAG 向量检索、SSE 流式 AI 对话与跨会话长期记忆。一席茶，一方天地，一念清心。

[![License MIT](https://img.shields.io/badge/License-MIT-9E8050?style=for-the-badge&labelColor=1C1C1C)](LICENSE)
[![Built with Vue 3 · Spring Boot 3](https://img.shields.io/badge/Built_with-Vue_3_%C2%B7_Spring_Boot_3-5D4E37?style=for-the-badge&labelColor=1C1C1C)](https://vuejs.org/)
[![Domain Immersive Tea Ceremony](https://img.shields.io/badge/Domain-Immersive_Tea_Ceremony-6B7D5A?style=for-the-badge&labelColor=1C1C1C)](README.md)
[![Stack PWA · 3D · Offline-first](https://img.shields.io/badge/Stack-PWA_%C2%B7_3D_%C2%B7_Offline--first-3D3225?style=for-the-badge&labelColor=1C1C1C)](README.md)

[![CI](https://github.com/qiuqianyi66/tea-ceremony/actions/workflows/ci.yml/badge.svg)](https://github.com/qiuqianyi66/tea-ceremony/actions/workflows/ci.yml)

**中文** · [English](README.en.md)

## 目录

- [它是什么](#它是什么)
- [立即体验](#立即体验)
- [核心特性](#核心特性)
- [截图](#截图)
- [技术栈](#技术栈)
- [AI 能力](#ai-能力)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [工程质量与治理](#工程质量与治理)
- [常见问题](#常见问题)
- [路线图](#路线图)
- [致谢](#致谢)
- [License](#license)

## 它是什么

「一盏茶」不是百科、不是计时器，是一座可以走进去的数字茶室。

业务闭环：入席 → 选茶 → 备器 → 煮水 → 冲泡 → 品鉴记录 → 个人成长。前端用 Vue 3 + Three.js 渲染可交互的 3D 茶席，后端用 Spring Boot 3.5 + Spring AI Alibaba 提供 RAG 问答与多工具 Agent，数据层 PostgreSQL + pgvector 支撑向量检索。

## 立即体验

- **在线 Demo（无需注册，离线可用）**：[qiuqianyi66.github.io/tea-ceremony](https://qiuqianyi66.github.io/tea-ceremony/)
- **完整版（含后端，公网部署）**：[https://42.121.125.4](https://42.121.125.4/)

![一盏茶 · 社交封面](docs/screenshots/og-cover.png)

## 核心特性

- **3D 茶席**：TresJS / Three.js 渲染的木桌茶器，注水有蒸汽、出汤看汤色，时间、节气、主题茶室影响氛围
- **完整流程闭环**：备器 → 煮水 → 温杯 → 醒茶 → 冲泡 → 观色 → 闻香 → 品味，八维口感评分 × 冲泡工艺系数
- **离线优先 PWA**：Dexie.js + IndexedDB，品鉴记录先落本地，断网也能泡，联网后自动同步（`sync_status` 重试队列）
- **可分享**：一键生成带二维码的品鉴卡 PNG / 只读分享链接
- **AI 茶灵**：五角色专家 + 多工具 Agent + SSE 流式回复 + 跨会话长期记忆，RAG 答案可溯源
- **工程化**：14 个 CI 合并门禁 job、29 个 ADR、ArchUnit 分层测试、Testcontainers 集成测试、可观测性与安全头全套

## 截图

| 沉浸式首页 | 3D 冲泡 | 品鉴分享卡 |
| --- | --- | --- |
| ![首页](docs/screenshots/home.jpg) | ![冲泡](docs/screenshots/brew-3d-steeping.png) | ![品鉴卡](docs/screenshots/share.png) |

![选茶](docs/screenshots/select.png)
![3D 出汤](docs/screenshots/brew-3d-done.png)
![个人成长](docs/screenshots/growth-desktop.png)

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端框架 | Vue 3.5 + TypeScript 6（strict）+ Pinia 4 + Vue Router + Tailwind CSS 4 + Vite 8 |
| 3D | Three.js 0.185 + TresJS 5.8（KTX2 压缩贴图 + basis transcode） |
| 前端数据 | Dexie.js + IndexedDB（离线优先） |
| 后端 | Spring Boot 3.5 + Spring Data JPA + Spring AI Alibaba + Flyway 迁移 |
| AI 框架 | Spring AI Alibaba（多工具 Agent、SSE 流式、Advisor 记忆） |
| 向量 | PostgreSQL + pgvector（HNSW 索引，cosine 距离） |
| 本地嵌入 | bge-large-zh-v1.5 ONNX 自托管（1024 维，onnxruntime 1.20.0） |
| 后端旧栈 | FastAPI（仅维护，不新增功能） |
| 部署 | Docker Compose（frontend / backend / postgres / nginx） |
| 静态托管 | GitHub Pages（前端 Demo） |
| 测试 | Vitest + Playwright E2E + axe a11y + Maven Testcontainers + ArchUnit |
| CI | GitHub Actions 14 job（type-check / Vitest / Biome / gitleaks / E2E / a11y / 后端 Maven / pytest / 迁移往返 / Compose 校验 / harness 一致性） |

## AI 能力

- **五角色专家**：选茶师、冲泡师、品鉴师、茶文化学者、成长导师
- **多工具 Agent**：Spring AI Alibaba Tool Calling，后端注册多个工具供模型调用
- **SSE 流式输出**：前端 `EventSource` 接收 token 流，打字机式回复
- **跨会话长期记忆**：`user_memory` 表存用户画像，下次会话开场注入 system prompt
- **自托管 RAG**：文化知识 8 张表切片 → ONNX embedding → pgvector 检索 → 上下文拼 prompt；答案带 sources 可溯源
- **熔断降级**：浏览器永不直连第三方 AI，请求全走 `/api/v1/ai/*` 后端代理；断网时前端降级到本地规则回复
- **评测闭环**：50 条评测集 + LLM-as-Judge 全量判分；v9 全量真实分 **0.86**（2026-10-30，judgeCoverage 0.97），RAG 命中率 **0.48**（recall@k=3/3）

## 项目结构

```
tea-ceremony/
├── src/                        # Vue 3 前端（Vite）
│   ├── views/                  # 页面（3D 冲泡、AI 茶灵、成长、分享…）
│   ├── stores/                 # Pinia（auth / progress / brew / tasting）
│   ├── services/               # 后端代理 + 离线降级
│   ├── components/three/      # TresJS 茶席（视觉层，不碰状态机）
│   └── router/                 # 21 条路由
├── backend/                    # Spring Boot 3.5 后端
│   ├── src/main/java/com/tea/  # Controller → Service → Repository
│   └── src/test/               # Testcontainers + ArchUnit + LayerDependency
├── docs/                       # ADR-001~029、计划、评测证据
├── .agents/skills/            # 66 个通用/领域技能
├── .harness/                   # 39 个流程族技能 + 规则 + Wiki 四件套
├── deploy/                     # Docker Compose、nginx、观测栈
└── .github/workflows/ci.yml    # 14 job 合并门禁
```

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

## 工程质量与治理

流程、规范、验证都写成代码，机器可查，不靠自觉。

- **AI 协作规则**：`AGENTS.md` 定义红线、开发流程与三轨道分诊（Fast / Guided / Controlled）
- **架构决策记录**：ADR-001~029，每个选择写「选 A 理由 + 否 B 理由 + 反转条件」；最近的覆盖自托管本地 embedding（ADR-029）与跨会话长期记忆（ADR-028）
- **CI 合并门禁**：14 job 全绿才合并；main 分支保护 = 只走 PR
- **确定性体检脚本**：`verify-harness.cjs` / `audit-redlines.cjs` / `audit-wiki-drift.cjs` / `audit-context-budget.cjs`，挂 CI 门禁
- **架构分层**：ArchUnit 强制 Controller → Service → Repository 单向依赖

## 常见问题

**Q：这个项目用了什么技术栈？**
A：Vue 3.5 + TypeScript + Pinia + Tailwind + Vite 前端；Spring Boot 3.5 + Spring AI Alibaba + PostgreSQL/pgvector 后端；Three.js 3D；Docker Compose 部署；GitHub Actions CI。

**Q：AI 是怎么实现的？**
A：Spring AI Alibaba 做多工具 Agent、SSE 流式回复与 Advisor 记忆；RAG 用自托管 bge-large-zh-v1.5 ONNX 模型生成 embedding，存入 pgvector 做 cosine 检索；用户画像存 `user_memory` 表跨会话复用。

**Q：离线能用吗？**
A：能。前端用 Dexie.js + IndexedDB 做离线优先，品鉴记录先写本地，联网后通过 `sync_status` 重试队列同步；AI 不可用时降级到本地规则回复。

**Q：后端是 Spring Boot 还是 FastAPI？**
A：主后端是 Spring Boot 3.5（Spring Data JPA + Spring AI Alibaba + Flyway）。旧 FastAPI 仅维护，不新增功能。

**Q：怎么本地跑起来？**
A：只跑前端：`npm install && npm run dev`。全栈：`cp .env.example .env` 后 `docker compose up -d --build`。

**Q：为什么自托管 embedding 而不是用 DashScope？**
A：DashScope 账号欠费不可恢复，自托管 ONNX 是解锁向量 RAG 的唯一路径。决策记录见 ADR-029（选型 bge-large-zh-v1.5，1024 维免改表）。

**Q：怎么部署？**
A：Docker Compose 编排 frontend / backend / postgres / nginx 四个容器；前端静态 Demo 部署到 GitHub Pages。完整流程见 [DEPLOY.md](DEPLOY.md)。

## 路线图

- 真实茶汤与茶器摄影素材替换占位图
- 茶单扩充到中国茶区主要品类（当前 66 款，目标 100+）
- 多人共席（分享卡从只读进化到双人茶会）
- 生产环境接入 Sentry 错误追踪与 Redis 限流

## 致谢

首页茶山背景 `src/assets/tea-mountain-hero.jpg`：摄影作者 Tanmoy281，来源 [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Darjeeling-tea-plantation.jpg)，[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.zh)；本项目仅做尺寸缩放与晨雾色调处理。茶叶摄影：Pexels 可商用素材。

## License

[MIT](LICENSE) © 2026 严恒（qiuqianyi66）
