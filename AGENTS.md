# AGENTS.md — 一盏茶项目 AI 协作规则

> 本文件是项目级 AI 助手规则。所有 AI 编码助手（Codex、Claude Code、Cursor、Copilot 等）在本仓库工作时必须优先遵守本文件。
> 若本文件与全局规则冲突，以本文件为准。
> 更新记录：2026-09-05 对齐项目最新进度（自动化测试体系 / CI 7 job / 可分享品鉴卡 / AI 后端代理 / v1.0.0 Release / 3D 茶空间）。

---

## 0. 项目速览

**一盏茶 · Tea Ceremony** — 沉浸式在线茶道体验应用

| 层 | 技术栈 | 入口 |
|---|---|---|
| 前端 | Vue 3 + TypeScript + Pinia + Vue Router + Tailwind CSS 4 + Vite + Dexie.js + Three.js/TresJS + ECharts + Chart.js + qrcode | `src/main.ts` |
| 后端 | FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL + Pydantic v2 | `backend/main.py` |
| 部署 | Docker Compose + Nginx + PWA + GitHub Pages 静态 Demo | `docker-compose.yml` |
| 测试 | Vitest + fake-indexeddb + Playwright + pytest + Alembic 迁移测试 | 见 §8 |
| CI | GitHub Actions（7 job，合并门禁） | `.github/workflows/` |

**核心业务闭环**：入席 → 选茶 → 备器 → 煮水 → 冲泡 → 品鉴记录 → 个人成长

**关键设计决策**：
- 离线优先：品鉴记录先写 IndexedDB，再异步同步后端（`sync_status` 三态）
- 可解释评分：八维口感 + 冲泡工艺系数，非黑盒
- AI 降级：茶文化 RAG 不可用时自动回退规则回复（请求走后端代理）
- 前后端分离：Nginx 做 SPA fallback + API 代理；GitHub Pages 用 404.html SPA fallback
- 3D 视觉：冲泡页用 TresJS 3D 茶席场景 + 实景夜色暖光背景，状态机/按钮/音频不动

**项目进度（六阶段路线图）**

| 阶段 | 状态 |
|---|---|
| 一 打磨可展示（README/截图/线上 Demo） | ✅ 完成（Pages 线上 Demo、Open Graph 图） |
| 二 自动化测试与 CI | ✅ 完成（T1–T6，测试驱动修复 6 个真实缺陷） |
| 三 可分享品鉴卡 | ✅ 完成（二维码 / 分享链接 / 只读分享页） |
| 四 AI 后端代理与生产安全 | ✅ 完成（限流 / 统一错误 / 健康页 / 日志） |
| 五 GitHub 专业度 | ✅ 完成（v1.0.0 Release、CHANGELOG、LICENSE、英文 README、看板） |
| 六 简历与面试材料 | ⬜ 待做 |
| 视觉升级（真实沏茶场景） | 🔄 已推进（3D 茶席 #5/#6、泡茶动画 #7、冲泡流程 #8、产区地图 #9、冲泡页 UI #10、首页晨雾茶山 #11） |

---

## 1. 核心原则

1. **简体中文优先**：除代码、命令、路径、API、日志字段外，全部用简体中文。
2. **先理解后执行**：不得跳过需求理解、上下文检查和计划直接改代码。
3. **不编造**：不得虚构文件、命令、测试结果、接口、库行为或茶文化知识。
4. **最小必要修改**：只改当前任务直接需要的内容，不顺手重构、格式化、升级依赖或扩展功能。
5. **根因优先**：修 bug 要复现、定位、修根因、验证，不用补丁掩盖问题。
6. **验证闭环**：完成必须有可复现的检查、测试、构建或运行结果。
7. **遵循现有模式**：新代码必须与项目已有风格、架构和命名保持一致，不引入无必要的新依赖或新抽象。
8. **技能优先**：本仓库带有成体系的技能库（见 §3），匹配的技能必须读取并执行，禁止"有技能不用"。

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

复杂多步任务默认走 §3.6 的「7 步 AI 编码闭环」。

---

## 3. 技能使用规范（Skills 必读）

本仓库带有一套成体系的技能库。**匹配的技能必须先 Read 对应 `SKILL.md` 再执行**，禁止凭技能名猜测用法；技能内容以仓库内当前文件为准，不凭记忆。

### 3.1 技能位置

| 目录 | 类型 | 说明 |
|---|---|---|
| `.agents/skills/` | 工作流/方法论技能 | Superpowers 风格，已入库 git，所有 AI 助手可用 |
| `.codex/skills/` | 技术栈技能 | 面向 Codex CLI 的技术专家技能（未入库） |

### 3.2 工作流技能强制触发规则

| 场景 | 必须触发的技能 |
|---|---|
| 任何会话开始 / 不确定用哪个技能 | `using-superpowers` |
| 创建功能、组件、修改行为（任何创作类工作） | `brainstorming`（先澄清需求，**硬门：设计获批前不写代码**） |
| 遇到任何 bug / 测试失败 / 异常 | `systematic-debugging`（先定位根因，再提修复） |
| 实现任何功能或修复 | `test-driven-development`（RED → GREEN → REFACTOR） |
| 多步任务，写实施计划前 | `writing-plans` |
| 功能开发需要隔离主分支 | `using-git-worktrees`（先跑测试基线） |
| 有实现计划，当前会话内执行 | `subagent-driven-development`（每任务独立子代理 + 双道审查） |
| 有实现计划，独立会话执行 | `executing-plans` |
| 2+ 个互相独立的任务 | `dispatching-parallel-agents` |
| 完成任务 / 合并前 | `requesting-code-review` + `verification-before-completion` |
| 收到代码评审意见 | `receiving-code-review`（先核实，不盲从） |
| 分支开发收尾 | `finishing-a-development-branch` |
| 创建 / 编辑技能 | `writing-skills` |

### 3.3 项目专属技能（改相关代码必须读）

| 技能 | 触发场景 |
|---|---|
| `tea-tasting` | 修改评分逻辑、冲泡参数、新增茶类 |
| `db-migration` | 修改数据库表结构、新增字段、数据迁移 |
| `fastapi-endpoint` | 新增 / 修改后端 API 路由 |
| `vue-component` | 新建 / 修改 Vue 组件或页面 |

### 3.4 3D / 视觉技能（Three.js 相关任务）

- 总入口：`threejs-webgl`
- 分领域：`threejs-fundamentals`（场景/相机）、`threejs-geometry`（几何）、`threejs-materials`（材质）、`threejs-lighting` / `threejs-impl-lighting`（灯光）、`threejs-animation`（动画）、`threejs-interaction`（交互）、`threejs-postprocessing` / `threejs-impl-post-processing`（后处理）、`threejs-shaders`（着色器）、`threejs-loaders`（模型加载）、`threejs-textures`（贴图）、`threejs-impl-shadows`（阴影）
- 轻量 3D 装饰（Zdog / Vanta.js / Vanilla-Tilt）：`lightweight-3d-effects`
- 多 3D 库集成架构：`web3d-integration-patterns`
- 项目约定：冲泡页 3D 视觉挂在 `BrewView` 背景层，**不得改动状态机 / 手势 / 按钮 / 音频 / 进度条**（见 `3D_SPEC.md`）

### 3.5 Codex 技术技能（`.codex/skills/`，Codex CLI 使用）

`api-design`、`browser-qa`、`docker-patterns`、`fastapi-patterns`、`frontend-design`、`git-workflow`、`memory-auditor`、`playwright-expert`、`postgres-pro`、`python-pro`、`python-testing`、`reviewer`、`security-hook`、`typescript-pro`、`ui-ux-pro-max`、`verification-before-completion`、`vite-patterns`、`vue-expert`

### 3.6 7 步 AI 编码闭环（复杂任务默认流程）

```
需求澄清 → 工作区隔离 → 规格定义 → 任务拆解 → 子代理开发 → TDD 实现 → 审查收尾
```

1. **需求澄清**（`brainstorming`）：逐个提问澄清，给 2-3 个方案；产出规格；**不获批不写代码**
2. **工作区隔离**（`using-git-worktrees`）：独立分支/worktree，先跑测试基线
3. **规格定义**（`writing-plans`）：做什么 / 不做什么 / 验收标准 / 技术约束，落盘规格文档（如 `*_SPEC.md`）
4. **任务拆解**（`writing-plans`）：拆成 2-5 分钟小任务，声明文件路径、代码要求、验证步骤、阻塞依赖
5. **子代理开发**（`subagent-driven-development`）：每任务独立子代理，上下文隔离；完成后过「规范合规 + 代码质量」双道审查
6. **TDD 实现**（`test-driven-development`）：先写失败测试 → 最小实现 → 重构；防止过度设计
7. **审查收尾**（`requesting-code-review` + `verification-before-completion` + `finishing-a-development-branch`）：双轴审查（规范维度 + 规格维度），全部测试通过 + 手动确认 + 无回归才算完成

---

## 4. 上下文检查顺序

修改前必须按优先级检查相关上下文：

1. 本文件 `AGENTS.md`（含 §3 技能规范）
2. 匹配的 `SKILL.md`（§3 中的技能）
3. `README.md`、`DESIGN_SPEC.md`、`REQUIREMENTS.md`、`3D_SPEC.md`
4. `TESTING_SPEC.md`（涉及测试时）
5. `CONTEXT.md`、`DATABASE_ER.md`（涉及数据库时）
6. `DEPLOY.md`（涉及部署时）
7. 相关源码、配置、测试
8. `package.json`（前端依赖和脚本）
9. `backend/requirements.txt`、`backend/requirements-dev.txt`（后端依赖）
10. `docker-compose.yml`、`nginx.conf`

禁止只凭文件名或经验猜测实现。未找到依据时必须说明"不确定/未找到"。

---

## 5. 前端开发规范

### 5.1 技术约束

- **Vue 3**：使用 Composition API + `<script setup lang="ts">`，不使用 Options API
- **TypeScript**：严格模式，禁止 `any`，类型必须从 `src/types/` 导入或定义
- **状态管理**：业务状态用 Pinia（`src/stores/`），组件局部状态用 `ref/reactive`
- **样式**：Tailwind CSS 4，不写自定义 CSS 文件（除非 `src/assets/` 下的全局样式）
- **路由**：`src/router/`，冲泡流程有守卫，新页面必须注册路由
- **本地存储**：IndexedDB 操作统一走 `src/services/storage.ts`（Dexie 封装），不直接操作原生 IndexedDB
- **API 请求**：统一走 `src/services/api.ts`，不直接 fetch；**AI 请求必须走后端代理 `/api/ai/*`，禁止浏览器直连第三方 AI**
- **3D**：Three.js 场景组件放 `src/components/three/`，挂载为页面背景层，不侵入交互逻辑

### 5.2 目录约定

```
src/
├── views/          # 页面级组件（路由目标）
├── components/     # 可复用组件（含 three/ 3D 场景组件）
├── composables/    # 组合式函数（逻辑复用）
├── stores/         # Pinia store
├── services/       # API、IndexedDB、评分、AI、分享（storage.ts / api.ts / scoring.ts / teaAI.ts / share.ts）
├── data/           # 静态数据（茶叶、茶器、节气、文化资料、茶产区）
├── types/          # TypeScript 类型定义
├── router/         # 路由配置
├── plugins/        # Vue 插件
└── assets/         # 静态资源
```

### 5.3 组件规范

- 组件名用 PascalCase，文件名用 PascalCase.vue
- Props 必须定义类型和默认值，用 `defineProps<{...}>()`
- Emits 必须声明，用 `defineEmits<{...}>()`
- 不超过 200 行，超过则拆分子组件或 composable
- 副作用统一在 `onMounted` / `onUnmounted` 中管理

### 5.4 前端验证

修改前端后必须执行：
```bash
npm run type-check   # Vue/TS 类型检查
npm run build        # 生产构建（含类型检查）
```
改了逻辑 / store / 服务层，还必须跑 `npm run test`（Vitest）。
改了业务流程 / 路由，还必须跑 `npm run test:e2e`（Playwright）。
如果只改了单个组件，至少跑 `npm run type-check`。

---

## 6. 后端开发规范

### 6.1 技术约束

- **FastAPI**：路由在 `backend/app/routers/`，每个资源一个文件
- **SQLAlchemy 2.0**：使用异步风格（`async/await` + `AsyncSession`），模型在 `backend/app/models/`
- **Pydantic v2**：请求/响应 schema 在 `backend/app/schemas/`，与 ORM 模型分离
- **Alembic**：数据库迁移必须用 Alembic 生成，禁止手动改数据库
- **认证**：JWT（python-jose），密码哈希用 passlib[bcrypt]（**bcrypt 必须锁定 `==4.0.1`**，5.0 与 passlib 1.7.4 不兼容）
- **配置**：从环境变量读取，`.env` 不入库
- **生产安全**：AI 代理路由、API 限流、统一错误格式、健康检查、日志已就位，新增中间件需保持风格一致

### 6.2 目录约定

```
backend/
├── app/
│   ├── routers/      # API 路由（auth、teas、records、culture、ai、health）
│   ├── models/       # SQLAlchemy ORM 模型
│   ├── schemas/      # Pydantic 请求/响应模型
│   ├── services/     # 业务逻辑（茶文化检索、文本切分）
│   ├── core/         # 配置、安全、数据库连接、限流
│   └── main.py       # FastAPI 应用入口（日志、错误处理器、中间件）
├── migrations/       # Alembic 迁移脚本
├── seeds/            # 初始数据（茶叶、文化资料）
├── tests/            # pytest 测试（conftest + auth/records/ai/health/errors/middleware/migrations）
├── Dockerfile
├── alembic.ini
└── requirements.txt / requirements-dev.txt
```

### 6.3 API 规范

- RESTful 风格，路径用复数名词（`/api/teas`、`/api/records`）
- 所有响应必须有 Pydantic schema
- 错误用 HTTP 状态码 + 统一错误格式（`detail` 字段），生产环境隐藏内部细节
- 认证接口前缀 `/api/auth`，需要登录的接口依赖 `get_current_user` 依赖
- 新增接口必须带 pytest 测试（见 §8）

### 6.4 后端验证

修改后端后必须执行：
```bash
cd backend
python -m py_compile app/main.py    # 语法检查
.\.venv\Scripts\python.exe -m pytest tests -q   # 全量后端测试
# 如果有数据库变更：
alembic revision --autogenerate -m "描述"
alembic upgrade head
# 迁移脚本改动必须跑迁移测试（真实 Postgres）：
python -m pytest tests/test_migrations.py -q
```

---

## 7. 数据库迁移规范

**绝对禁止**：直接修改 `backend/app/models/` 后不生成迁移脚本。修改数据库相关代码前先读 `.agents/skills/db-migration/SKILL.md`。

正确流程：
1. 修改 SQLAlchemy 模型
2. `cd backend && alembic revision --autogenerate -m "简要描述变更"`
3. 检查生成的迁移脚本（autogenerate 不完美，必须人工审核；**JSONB、部分唯一索引等 PostgreSQL 专属语法必须用真实 Postgres 验证**）
4. `alembic upgrade head` 执行迁移
5. 验证数据正确性，并跑迁移测试（`upgrade head` / `downgrade base` 往返）

涉及数据迁移（非纯 schema）时，必须写数据迁移逻辑，不能只改表结构。

---

## 8. 测试与质量

### 当前状态（第二阶段已完成，全部接入 CI）

| 层 | 框架 | 位置 | 状态 |
|---|---|---|---|
| 评分单测 | Vitest | `src/services/__tests__/scoring.spec.ts` | ✅ 已接入 CI |
| store 闭环 | Vitest + fake-indexeddb | `src/stores/__tests__/tea.spec.ts` | ✅ 已接入 CI |
| 分享编解码 | Vitest | `src/services/__tests__/share.spec.ts` | ✅ 已接入 CI |
| AI 降级 | Vitest | `src/services/__tests__/teaAI.spec.ts` | ✅ 已接入 CI |
| E2E 完整流程 | Playwright | `e2e/full-journey.spec.ts` | ✅ 本地 + CI 双环境 |
| E2E 分享页 / 健康页 | Playwright | `e2e/share-page.spec.ts`、`e2e/health-page.spec.ts` | ✅ 已接入 CI |
| 后端 API | pytest + TestClient | `backend/tests/test_auth.py` 等 | ✅ 已接入 CI |
| 迁移测试 | pytest + Alembic（真实 Postgres） | `backend/tests/test_migrations.py` | ✅ CI 强制跑，本地无 Docker 自动 skip |

**CI 7 个 job（合并门禁）**：前端 type-check+build+smoke / 前端单测（Vitest）/ E2E（Playwright）/ 后端语法 / 后端 API（pytest）/ 迁移测试（Postgres service）/ Docker Compose 校验。

### 测试规则

- **新功能 / 修 bug 必须带测试**：前端逻辑改动补 Vitest 单测；流程改动补 E2E；后端接口补 pytest
- **TDD 优先**：先写会失败的测试（RED），再最小实现（GREEN），再重构（REFACTOR）
- **E2E 冲泡用真实等待**（不伪造时钟、不加产品开关），单用例约 30-40s，CI 已预留充足 timeout
- **E2E 选择器要稳定**：用可见文本 / 角色定位，避免依赖动画中间态；页面动画（如迎宾弹窗）要容错
- **CI 环境注意**：GitHub Pages base 为 `/tea-ceremony/`，E2E 导航用相对路径（`goto('history')`），不要用前导斜杠绝对路径
- 迁移测试必须用真实 Postgres（SQLite 无法验证 JSONB / 部分索引）
- 测试发现的产品缺陷按根因修复，单独 `fix:` commit

### AI 生成代码时的自测要求
- 修改前端组件：跑 `npm run test` + 手动验证相关路由可正常渲染，无控制台报错
- 修改后端 API：跑 pytest + 用 curl 或 Swagger UI（`/docs`）验证接口
- 修改评分逻辑：用已知冲泡参数验证结果合理性，跑 scoring 单测
- 修改数据库：验证迁移可升级可回滚 + 迁移测试

---

## 9. Git 工作流

- 分支：`main` 为稳定分支，新功能开 `feature/xxx`，修 bug 开 `fix/xxx`
- Commit 信息：中文，格式 `类型: 简要描述`，类型包括 `feat`、`fix`、`refactor`、`docs`、`chore`、`style`
- 缺陷修复与功能/测试**分开提交**（如：`fix:` 缺陷修复 commit + `test:`/`feat:` 测试与功能 commit）
- 提交前必须本地通过 `npm run build`、前端单测、后端 pytest 和 Python 语法检查
- 不提交 `node_modules/`、`dist/`、`.env`、`__pycache__/`、`.venv/`、`test-results/`、`playwright-report/`
- 分支收尾走 `finishing-a-development-branch` 技能（合并 / 清理 / Release 决策）

---

## 10. 安全边界

以下操作必须获得用户明确确认：

- 删除文件/目录、覆盖大量内容
- `git push`、发版、部署到生产、合并 PR
- 数据库迁移、数据清空、回滚
- 修改 `.env`、密钥、认证逻辑
- 升级主要依赖版本（Vue、FastAPI、SQLAlchemy 等）
- 修改 `docker-compose.yml`、`nginx.conf` 的核心配置

---

## 11. 常用命令速查

### 前端
```bash
npm install          # 安装依赖
npm run dev          # 开发服务器（默认 http://localhost:5173）
npm run type-check   # 类型检查
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览生产构建
npm run smoke        # 生产预览路由冒烟测试
npm run test         # Vitest 单元测试
npm run test:watch   # Vitest 监听模式
npm run test:e2e     # Playwright E2E（完整流程 + 分享页 + 健康页）
```

### 后端
```bash
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest tests -q      # 全量测试（API + 迁移）
python -m py_compile main.py                        # 语法检查
uvicorn main:app --reload --port 8000              # 开发服务器
alembic revision --autogenerate -m "msg"           # 生成迁移
alembic upgrade head                               # 执行迁移
python -m seeds.run                                 # 导入种子数据
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
npm run test
npm run test:e2e
cd backend && python -m py_compile main.py
cd backend && .\.venv\Scripts\python.exe -m pytest tests -q
docker compose config -q        # Compose 配置校验
```

---

## 12. 茶文化内容规范

本项目涉及茶文化知识，AI 生成或修改茶文化内容时：

- 茶叶分类必须遵循六大茶类（绿茶、白茶、黄茶、乌龙茶、红茶、黑茶）
- 冲泡参数（水温、投茶量、浸泡时间）要符合茶类常识（见 `tea-tasting` 技能基准表）
- 不编造不存在的茶名、茶器或历史人物
- 引用文化资料时优先使用 `src/data/` 中已有数据
- 不确定的内容标注"待核实"，不编造

---

## 13. 项目特有约定

- **评分模型**：品鉴结果 = 八维口感评分 × 冲泡工艺系数，修改时必须保持可解释性（读 `tea-tasting` 技能）
- **离线同步**：IndexedDB 记录有 `sync_status` 字段（pending/synced/failed），新增字段要考虑同步逻辑；写入前对 Vue 响应式对象 `toRaw` 去代理（防止 DataCloneError）
- **AI 茶灵**：`src/services/teaAI.ts` 有降级逻辑，请求走后端 `/api/ai/*` 代理，修改时必须保留网络不可用时的规则回复
- **品鉴卡分享**：`src/services/share.ts` 纯函数编解码（base64url），`/share` 只读分享页，PNG 下载内置二维码；数据经 URL 传输，必须做防御性校验
- **3D 茶空间**：`src/components/three/` 下的 TresJS 场景，只做视觉层，不改状态机；见 `3D_SPEC.md`
- **PWA**：`vite-plugin-pwa` 已配置，修改静态资源后注意缓存策略

---

*本文件是活文档，项目架构或流程变更时同步更新。*
