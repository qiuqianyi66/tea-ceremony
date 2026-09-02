# AGENTS.md — 一盏茶项目 AI 协作规则

> 本文件是项目级 AI 助手规则。所有 AI 编码助手（Codex、Claude Code、Cursor、Copilot 等）在本仓库工作时必须优先遵守本文件。
> 若本文件与全局规则冲突，以本文件为准。

---

## 0. 项目速览

**一盏茶 · Tea Ceremony** — 沉浸式在线茶道体验应用

| 层 | 技术栈 | 入口 |
|---|---|---|
| 前端 | Vue 3 + TypeScript + Pinia + Vue Router + Tailwind CSS 4 + Vite + Dexie.js | `src/main.ts` |
| 后端 | FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL + Pydantic v2 | `backend/main.py` |
| 部署 | Docker Compose + Nginx + PWA | `docker-compose.yml` |
| CI | GitHub Actions（类型检查 + 构建 + Python 编译 + Compose 校验） | `.github/workflows/` |

**核心业务闭环**：入席 → 选茶 → 备器 → 煮水 → 冲泡 → 品鉴记录 → 个人成长

**关键设计决策**：
- 离线优先：品鉴记录先写 IndexedDB，再异步同步后端
- 可解释评分：八维口感 + 冲泡工艺系数，非黑盒
- AI 降级：茶文化 RAG 不可用时自动回退规则回复
- 前后端分离：Nginx 做 SPA fallback + API 代理

---

## 1. 核心原则

1. **简体中文优先**：除代码、命令、路径、API、日志字段外，全部用简体中文。
2. **先理解后执行**：不得跳过需求理解、上下文检查和计划直接改代码。
3. **不编造**：不得虚构文件、命令、测试结果、接口、库行为或茶文化知识。
4. **最小必要修改**：只改当前任务直接需要的内容，不顺手重构、格式化、升级依赖或扩展功能。
5. **根因优先**：修 bug 要复现、定位、修根因、验证，不用补丁掩盖问题。
6. **验证闭环**：完成必须有可复现的检查、测试、构建或运行结果。
7. **遵循现有模式**：新代码必须与项目已有风格、架构和命名保持一致，不引入无必要的新依赖或新抽象。

---

## 2. 默认工作流

涉及代码、调试、部署、文档的任务，首次响应必须先给计划：

```text
<plan>
1. 任务理解：当前任务、目标产物、成功标准
2. 影响范围：涉及模块、文件、数据流
3. 执行步骤：顺序与每步验证方式
4. 潜在风险：可能误判、破坏、跑偏之处
</plan>
```

简单任务可压缩，但不得省略"目标、依据、验证"。

**完成后必须汇报**：
```text
Done
- 做了什么
Changed
- 改了哪些文件
Verification
- 执行了什么检查，结果如何
- 未验证项
Next
- 建议的下一步
Risks
- 剩余风险
```

---

## 3. 上下文检查顺序

修改前必须按优先级检查相关上下文：

1. 本文件 `AGENTS.md`
2. `README.md`、`DESIGN_SPEC.md`、`REQUIREMENTS.md`
3. `DATABASE_ER.md`（涉及数据库时）
4. `DEPLOY.md`（涉及部署时）
5. 相关源码、配置、测试
6. `package.json`（前端依赖和脚本）
7. `backend/requirements.txt`（后端依赖）
8. `docker-compose.yml`、`nginx.conf`

禁止只凭文件名或经验猜测实现。未找到依据时必须说明"不确定/未找到"。

---

## 4. 前端开发规范

### 4.1 技术约束

- **Vue 3**：使用 Composition API + `<script setup lang="ts">`，不使用 Options API
- **TypeScript**：严格模式，禁止 `any`，类型必须从 `src/types/` 导入或定义
- **状态管理**：业务状态用 Pinia（`src/stores/`），组件局部状态用 `ref/reactive`
- **样式**：Tailwind CSS 4，不写自定义 CSS 文件（除非 `src/assets/` 下的全局样式）
- **路由**：`src/router/`，冲泡流程有守卫，新页面必须注册路由
- **本地存储**：IndexedDB 操作统一走 `src/services/db.ts`（Dexie 封装），不直接操作原生 IndexedDB
- **API 请求**：统一走 `src/services/api.ts`，不直接 fetch

### 4.2 目录约定

```
src/
├── views/          # 页面级组件（路由目标）
├── components/     # 可复用组件
├── composables/    # 组合式函数（逻辑复用）
├── stores/         # Pinia store
├── services/       # API、IndexedDB、评分、AI 服务
├── data/           # 静态数据（茶叶、茶器、节气、文化资料）
├── types/          # TypeScript 类型定义
├── router/         # 路由配置
├── plugins/        # Vue 插件
└── assets/         # 静态资源
```

### 4.3 组件规范

- 组件名用 PascalCase，文件名用 PascalCase.vue
-  Props 必须定义类型和默认值，用 `defineProps<{...}>()`
-  Emits 必须声明，用 `defineEmits<{...}>()`
-  不超过 200 行，超过则拆分子组件或 composable
-  副作用统一在 `onMounted` / `onUnmounted` 中管理

### 4.4 前端验证

修改前端后必须执行：
```bash
npm run type-check   # Vue/TS 类型检查
npm run build        # 生产构建（含类型检查）
```
如果只改了单个组件，至少跑 `npm run type-check`。

---

## 5. 后端开发规范

### 5.1 技术约束

- **FastAPI**：路由在 `backend/app/routers/`，每个资源一个文件
- **SQLAlchemy 2.0**：使用异步风格（`async/await` + `AsyncSession`），模型在 `backend/app/models/`
- **Pydantic v2**：请求/响应 schema 在 `backend/app/schemas/`，与 ORM 模型分离
- **Alembic**：数据库迁移必须用 Alembic 生成，禁止手动改数据库
- **认证**：JWT（python-jose），密码哈希用 passlib[bcrypt]
- **配置**：从环境变量读取，`.env` 不入库

### 5.2 目录约定

```
backend/
├── app/
│   ├── routers/      # API 路由（auth、teas、records、culture）
│   ├── models/       # SQLAlchemy ORM 模型
│   ├── schemas/      # Pydantic 请求/响应模型
│   ├── services/     # 业务逻辑（茶文化检索、文本切分）
│   ├── core/         # 配置、安全、数据库连接
│   └── main.py       # FastAPI 应用入口
├── migrations/       # Alembic 迁移脚本
├── seeds/            # 初始数据（茶叶、文化资料）
├── Dockerfile
├── alembic.ini
└── requirements.txt
```

### 5.3 API 规范

- RESTful 风格，路径用复数名词（`/api/teas`、`/api/records`）
- 所有响应必须有 Pydantic schema
- 错误用 HTTP 状态码 + `detail` 字段
- 认证接口前缀 `/api/auth`，需要登录的接口依赖 `get_current_user` 依赖

### 5.4 后端验证

修改后端后必须执行：
```bash
cd backend
python -m py_compile app/main.py    # 语法检查
# 如果有数据库变更：
alembic revision --autogenerate -m "描述"
alembic upgrade head
```

---

## 6. 数据库迁移规范

**绝对禁止**：直接修改 `backend/app/models/` 后不生成迁移脚本。

正确流程：
1. 修改 SQLAlchemy 模型
2. `cd backend && alembic revision --autogenerate -m "简要描述变更"`
3. 检查生成的迁移脚本（autogenerate 不完美，必须人工审核）
4. `alembic upgrade head` 执行迁移
5. 验证数据正确性

涉及数据迁移（非纯 schema）时，必须写数据迁移逻辑，不能只改表结构。

---

## 7. 测试与质量

### 当前状态
项目目前没有单元测试框架。CI 只做类型检查和构建。

### AI 生成代码时的自测要求
- 修改前端组件：手动验证相关路由可正常渲染，无控制台报错
- 修改后端 API：用 `curl` 或 Swagger UI（`/docs`）验证接口
- 修改评分逻辑：用已知冲泡参数验证结果合理性
- 修改数据库：验证迁移可升级可回滚

### 未来建议（不强制现在做）
- 前端：Vitest + Vue Test Utils
- 后端：pytest + httpx.AsyncClient
- E2E：Playwright（项目已有 `.playwright-mcp/` 目录）

---

## 8. Git 工作流

- 分支：`main` 为稳定分支，新功能开 `feature/xxx`，修 bug 开 `fix/xxx`
- Commit 信息：中文，格式 `类型: 简要描述`，类型包括 `feat`、`fix`、`refactor`、`docs`、`chore`、`style`
- 提交前必须本地通过 `npm run build` 和 Python 语法检查
- 不提交 `node_modules/`、`dist/`、`.env`、`__pycache__/`

---

## 9. 安全边界

以下操作必须获得用户明确确认：

- 删除文件/目录、覆盖大量内容
- `git push`、发版、部署到生产
- 数据库迁移、数据清空、回滚
- 修改 `.env`、密钥、认证逻辑
- 升级主要依赖版本（Vue、FastAPI、SQLAlchemy 等）
- 修改 `docker-compose.yml`、`nginx.conf` 的核心配置

---

## 10. 常用命令速查

### 前端
```bash
npm install          # 安装依赖
npm run dev          # 开发服务器（默认 http://localhost:5173）
npm run type-check   # 类型检查
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览生产构建
npm run smoke        # 生产预览路由冒烟测试
```

### 后端
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000    # 开发服务器
python -m py_compile main.py             # 语法检查
alembic revision --autogenerate -m "msg" # 生成迁移
alembic upgrade head                     # 执行迁移
python -m seeds.run                      # 导入种子数据
```

### 完整服务（Docker）
```bash
docker compose up -d --build    # 启动全部服务
docker compose logs -f backend  # 查看后端日志
docker compose exec backend python -m seeds.run  # 导入种子数据
docker compose down             # 停止服务
```

### CI 检查（提交前必跑）
```bash
npm run build
cd backend && python -m py_compile main.py
docker compose config -q        # Compose 配置校验
```

---

## 11. 茶文化内容规范

本项目涉及茶文化知识，AI 生成或修改茶文化内容时：

- 茶叶分类必须遵循六大茶类（绿茶、白茶、黄茶、乌龙茶、红茶、黑茶）
- 冲泡参数（水温、投茶量、浸泡时间）要符合茶类常识
- 不编造不存在的茶名、茶器或历史人物
- 引用文化资料时优先使用 `src/data/` 中已有数据
- 不确定的内容标注"待核实"，不编造

---

## 12. 项目特有约定

- **评分模型**：品鉴结果 = 八维口感评分 × 冲泡工艺系数，修改时必须保持可解释性
- **离线同步**：IndexedDB 记录有 `sync_status` 字段（pending/synced/failed），新增字段要考虑同步逻辑
- **AI 茶灵**：`src/services/ai.ts` 有降级逻辑，修改时必须保留网络不可用时的规则回复
- **PWA**：`vite-plugin-pwa` 已配置，修改静态资源后注意缓存策略

---

*本文件是活文档，项目架构或流程变更时同步更新。*
