# CONTEXT.md — 一盏茶项目共享语言

> 本文件定义项目的统一术语和架构决策。AI 助手和开发者都使用这里的术语沟通，避免每次重新解释。
> 新增术语或架构变更时同步更新本文件。

---

## 核心概念

| 术语 | 定义 | 代码位置 |
|------|------|----------|
| 茶席 | 一次完整的茶道体验流程：入席→选茶→备器→煮水→冲泡→品鉴 | `src/views/` |
| 冲泡 | 投茶、注水、浸泡、出汤的交互过程 | `src/views/Brewing.vue`、`src/components/brewing/` |
| 品鉴 | 观色、闻香、品味三步评分流程 | `src/views/Tasting.vue` |
| 八维评分 | 汤色、香气、滋味、苦涩、生津、喉韵、耐泡度、协调性 | `src/services/scoring.ts` |
| 工艺系数 | 水温、投茶量、时间、茶器、水源对评分的修正系数（0.8-1.2） | `src/services/scoring.ts` |
| 离线优先 | 数据先写 IndexedDB，再异步同步后端 | `src/services/db.ts` |
| 同步状态 | pending / synced / failed 三态 | `src/types/tasting.ts` |
| AI 茶灵 | 茶文化 RAG 检索 + LLM 对话，网络不可用时降级规则回复 | `src/services/ai.ts` |
| 茶器 | 泡茶器具（盖碗、紫砂壶、玻璃杯等），影响工艺系数 | `src/data/teawares.ts` |
| 水源 | 冲泡用水（纯净水、矿泉水、山泉水），影响工艺系数 | `src/data/waters.ts` |

---

## 架构决策记录（ADR）

### ADR-001：离线优先的数据层
**决策**：品鉴记录先写 IndexedDB（Dexie），再异步同步后端。
**原因**：用户完成品茶不应依赖网络；数据不能因一次请求失败丢失。
**影响**：所有品鉴相关操作必须处理 `sync_status` 三态；新增字段要考虑同步逻辑。

### ADR-002：可解释评分模型
**决策**：用八维口感 × 工艺系数的可解释公式，不用黑盒模型。
**原因**：用户需要理解为什么得到这个分数；便于调试和扩展。
**影响**：评分在记录创建时计算并存储，不随逻辑变更而重算历史记录。

### ADR-003：AI 降级策略
**决策**：AI 茶灵网络不可用时自动回退到规则回复。
**原因**：PWA 离线可用是核心特性；不能因为 LLM 不可用就整个功能失效。
**影响**：`src/services/ai.ts` 必须保留规则回复分支。

### ADR-004：前后端分离 + Nginx 代理
**决策**：前端 Vue SPA，后端 FastAPI，Nginx 做 SPA fallback 和 API 代理。
**原因**：部署简单，前后端独立开发，安全头统一在 Nginx 配置。
**影响**：API 路径统一前缀 `/api`；前端开发环境代理到 `localhost:8000`。

### ADR-005：SQLAlchemy 2.0 异步 + Alembic 迁移
**决策**：后端用异步 SQLAlchemy，所有 schema 变更走 Alembic。
**原因**：异步性能好；迁移可追溯、可回滚。
**影响**：禁止手动改数据库；模型变更必须生成迁移脚本。

---

## 目录速查

```
src/
├── views/          页面（路由目标）
├── components/     可复用组件
├── composables/    组合式函数（逻辑复用）
├── stores/         Pinia 状态
├── services/       API / IndexedDB / 评分 / AI
├── data/           静态数据（茶、茶器、节气、文化）
├── types/          TypeScript 类型
├── router/         路由 + 冲泡流程守卫
├── plugins/        Vue 插件
└── assets/         静态资源

backend/
├── app/
│   ├── routers/    API 路由
│   ├── models/     SQLAlchemy ORM
│   ├── schemas/    Pydantic 请求/响应
│   ├── services/   业务逻辑（RAG 检索等）
│   └── core/       配置、安全、数据库
├── migrations/     Alembic 迁移
└── seeds/          初始数据
```

---

## 常用命令

| 操作 | 命令 |
|------|------|
| 前端开发 | `npm run dev` |
| 类型检查 | `npm run type-check` |
| 生产构建 | `npm run build` |
| 后端开发 | `cd backend && uvicorn main:app --reload --port 8000` |
| 生成迁移 | `cd backend && alembic revision --autogenerate -m "msg"` |
| 执行迁移 | `cd backend && alembic upgrade head` |
| 导入种子 | `docker compose exec backend python -m seeds.run` |
| 启动全部 | `docker compose up -d --build` |

---

## 技术栈版本

| 技术 | 版本 |
|------|------|
| Vue | 3.5+ |
| TypeScript | 6.0（严格模式） |
| Pinia | 4.0 |
| Tailwind CSS | 4.3 |
| Vite | 8.1 |
| Dexie | 4.4 |
| FastAPI | 0.115 |
| SQLAlchemy | 2.0.35 |
| Alembic | 1.13 |
| PostgreSQL | 16+ |
| Python | 3.12+ |
| Node | 22.18+ / 24.12+ |

---

## 待办与已知限制

- [ ] 尚无单元测试（CI 只做类型检查和构建）
- [ ] E2E 测试未落地（已有 `.playwright-mcp/` 目录）
- [ ] AI 第三方请求目前浏览器直连，计划收敛到后端代理
- [ ] 茶汤和茶器用的是矢量/粒子效果，计划增加真实图片
- [ ] 用户公开品鉴卡片和分享链接未实现
