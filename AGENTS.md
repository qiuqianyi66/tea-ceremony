# AGENTS.md — 一盏茶项目 AI 协作规则

> 给机器看的 README。仓库里所有 AI 编码助手（Codex、Claude Code、Cursor、Copilot、Gemini CLI 等）开工前必读。
> 格式遵循 AGENTS.md 开放标准（Linux Foundation / Agentic AI Foundation 治理，与 MCP、Agent Skills 并列）。
> 本文件是活文档：每次 AI 犯错，往「项目学习记录」加一行；每几周修剪一次。

## 0. 不可妥协

这几条优先级最高，与本文其他内容冲突时以本条为准：

1. **不奉承，不废话。** 禁止"好的问题""你说得对""我很乐意"这类开场白。直接给答案或行动。
2. **不同意就说。** 用户的前提错了要当面指出，再干活。为了礼貌附和错误前提，是编码助手最严重的失败模式。
3. **绝不编造。** 不编文件路径、commit 哈希、API 名、测试结果、库函数。不知道就读文件、跑命令、或说"我查一下"。
4. **困惑就停。** 任务有两种合理解读且影响产出时，问。不许默默选一个往下做。
5. **只动必须动的。** 每一行改动都能追溯到用户请求。禁止顺手重构、顺手格式化、顺手清理。

## 1. 摘要

「一盏茶」是沉浸式在线茶道应用：Vue 3 前端 + FastAPI 后端 + TresJS 3D 茶空间，离线优先、可分享品鉴卡、六阶段路线图已推进到视觉升级阶段。

- **日常任务**（改样式、调文案、修小 bug）：读本摘要 + 「必守规则」+「边界」即可，不必读全文。
- **架构级改动**（新增路由、动数据库、动 3D 场景结构）：读全文。
- 上下文不够时，优先保「不可妥协」和「必守规则」。

## 2. 项目速览

| 层 | 技术栈 | 入口 |
|---|---|---|
| 前端 | Vue 3 + TS + Pinia + Vue Router + Tailwind 4 + Vite + Dexie + Three.js/TresJS | `src/main.ts` |
| 后端 | FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL + Pydantic v2 | `backend/main.py` |
| 部署 | Docker Compose + Nginx + PWA + GitHub Pages Demo | `docker-compose.yml` |
| 测试 | Vitest + fake-indexeddb + Playwright + pytest + Alembic 迁移测试 | 见「验证」 |
| CI | GitHub Actions（7 job 合并门禁） | `.github/workflows/` |

业务闭环：入席 → 选茶 → 备器 → 煮水 → 冲泡 → 品鉴记录 → 个人成长。

进度：阶段一至五✅（打磨展示 / 自动化测试 / 分享品鉴卡 / AI 代理 / GitHub 专业度）；阶段六简历待做；视觉升级推进中（3D 茶席、泡茶动画、产区地图、晨雾茶山）。

## 3. 写码前

- 先用一两句话说明计划；非琐碎任务给带验证步骤的编号清单。
- 读要改的文件，再读调用它的文件。
- 匹配项目现有模式：项目用 X 就用 X，别按新项目习惯来。
- 把假设说出口："我假设你要 X，不对就说"。
- 两种方案都可行时，两个都摆出来讲清取舍，不许默默选一个。琐碎任务（改错字、重命名）除外。

## 4. 写码纪律

- **最小实现**：只解决被要求的问题。不加没要求的功能、抽象、配置、钩子。
- 不加"为了将来扩展"——将来是将来做的决定。倾向于删代码而不是加代码。
- 200 行能解决的事不写 500 行。写完先自查：资深工程师看这个 diff 会觉得过度设计吗？会就简化。
- **外科手术式改动**：不"顺手"改进相邻代码、注释、格式、import。不重构跑得好好的代码。
- 自己改出来的孤儿（失效的 import、变量、函数）要清掉。已有死代码不删，提一句即可。
- 检验标准：每一行改动都直接来自用户请求。不满足就回退。

## 5. 目标驱动与验证

- 把模糊需求改写成可验证目标再动手："修 bug"→"写一个复现报错症状的失败测试，再让它通过"。
- 写码前先定成功标准；能写验证（测试/脚本/截图对比）就写；跑验证、读输出，不凭"看起来对"报完成。
- **用运行代替猜测**：有测试跑测试，有 lint 跑 lint，有 type-check 跑 type-check。plausibility 不是 correctness。
- 修 bug 修根因，不压症状。读报错读完整，半截 trace 修不出对的修复。
- 前端 UI 改动要截图验证：改前一张、改后一张，描述差异。

### 本项目的验证基线（改完代码必跑）

```bash
npm run type-check   # 类型检查（最小门槛）
npm run test         # Vitest 单测（改了逻辑/store/service）
npm run build        # 生产构建（含类型检查）
npm run test:e2e     # Playwright E2E（改了流程/路由）
node scripts/verify-gardens.cjs   # 3D 茶园四园晴雨截图验证，期望 ERRORS: []
cd backend && python -m py_compile app/main.py   # 后端语法
cd backend && .\.venv\Scripts\python.exe -m pytest tests -q   # 后端全量
```

提交前默认跑：`npm run build` + `npm run test` + 后端 pytest。

## 6. 会话卫生与沟通

- 上下文是稀缺资源。长会话累积多次失败，不如带着更好的提示开新会话。
- 同一问题连续两次修正失败就停下，总结学到的东西，请用户重开会话。
- 探索性任务用子代理/只读手段，别让几十次文件读取污染主上下文。
- 沟通直率不绕弯："这个方案扩展不了因为 X"好过"这思路有意思，但你有没有考虑过……"。
- 默认简洁，两三段话。不重复问题，不写客套结尾。短答案用散文，别堆无谓的标题和列表。
- commit 信息写清楚：subject ≤ 72 字符，body 讲 why。禁止"update file""fix bug"这类空 commit。

## 7. 何时问，何时直接做

**先问再做**：请求有两种合理解读且选择实质影响产出；改动碰的是被明示"承重/有版本/有迁移路径"的东西；需要你给凭据或生产资源；用户的目标和字面请求冲突。

**直接做**：琐碎且可逆（改错字、重命名局部变量）；歧义能靠读代码或跑命令解决；这个问题本会话用户已经回答过。

## 8. 必守规则

### 语言与通用

- 简体中文优先：除代码、命令、路径、API、日志字段外，全部中文。
- 不编造：不虚构文件、命令、测试结果、接口、库行为、茶文化知识。
- 最小必要修改：不顺手重构、格式化、升级依赖、扩展功能。
- 技能优先：匹配的技能必须先 Read 对应 `SKILL.md` 再执行，禁止凭技能名猜用法。
- 写规则不写建议：给"禁止 X"不给"建议用 X"；把"为什么"写进规则。

### 前端

- Vue 3 Composition API + `<script setup lang="ts">`，禁止 Options API、禁止 `any`。
- 状态：业务用 Pinia（`src/stores/`），局部用 `ref/reactive`。
- 样式：Tailwind 4，不写自定义 CSS 文件。
- IndexedDB 统一走 `src/services/storage.ts`；API 统一走 `src/services/api.ts`；**AI 请求必须走后端代理 `/api/ai/*`，禁止浏览器直连第三方 AI**。
- 组件 ≤ 200 行，超了拆；Props/Emits 必须带类型；副作用在 `onMounted`/`onUnmounted` 管理。

### 后端

- FastAPI 路由在 `backend/app/routers/`，SQLAlchemy 2.0 异步风格，Pydantic v2 schema 与 ORM 分离。
- RESTful 复数路径，响应必须有 schema，错误用状态码 + `detail` 统一格式。
- 认证接口 `/api/auth`，需登录的接口依赖 `get_current_user`。
- 密码哈希 passlib[bcrypt]，**bcrypt 必须锁定 `==4.0.1`**（5.0 与 passlib 1.7.4 不兼容）。

### 数据库

- **绝对禁止**直接改模型不生成迁移。改库前先读 `.agents/skills/db-migration/SKILL.md`。
- 流程：改模型 → `alembic revision --autogenerate` → 人工审核脚本（JSONB 等 PG 语法必须真实 Postgres 验证）→ `alembic upgrade head` → 跑迁移测试（upgrade/downgrade 往返）。
- 数据迁移要写迁移逻辑，不能只改表结构。

### 测试

- 新功能/修 bug 必须带测试；TDD 优先（先写失败测试 → 最小实现 → 重构）。
- E2E 用真实等待，不伪造时钟；选择器用可见文本/角色，不依赖动画中间态。
- CI 7 job 是合并门禁：前端 type-check+build+smoke / Vitest / E2E / 后端语法 / pytest / 迁移测试 / Compose 校验。
- 测试发现的产品缺陷按根因修，单独 `fix:` commit。

### Git

- `main` 稳定，新功能 `feature/xxx`，修 bug `fix/xxx`。
- Commit 中文，格式 `类型: 简要描述`（feat/fix/refactor/docs/chore/style）。
- 缺陷修复与功能/测试分开提交。
- 不提交 `node_modules/`、`dist/`、`.env`、`__pycache__/`、`.venv/`、`test-results/`、`playwright-report/`。

### 茶文化

- 茶叶分类按六大茶类；冲泡参数符合茶类常识（见 `tea-tasting` 技能基准表）。
- 不编造不存在的茶名、茶器、历史人物；不确定标"待核实"；优先用 `src/data/` 已有数据。

### 项目特有约定

- 评分模型：品鉴结果 = 八维口感评分 × 冲泡工艺系数，保持可解释性（读 `tea-tasting`）。
- 离线同步：IndexedDB 记录有 `sync_status`（pending/synced/failed），新增字段考虑同步逻辑；写入前 `toRaw` 去代理（防 DataCloneError）。
- AI 茶灵：`teaAI.ts` 有降级逻辑，修改必须保留网络不可用时的规则回复。
- 品鉴卡分享：`share.ts` 纯函数 base64url 编解码，`/share` 只读页，数据经 URL 传输必须防御性校验。
- 3D 茶空间：`src/components/three/` 只做视觉层，不改状态机；见 `3D_SPEC.md`。
- PWA：`vite-plugin-pwa` 已配置，改静态资源注意缓存策略。

### 设计风格（反主流网页美学）

> 执行前端/页面设计的是一位资深独立设计师，反主流、鄙视 SaaS 模板、每个像素都有温度。

- 配色禁止：紫/靛蓝/蓝紫渐变（`#6366F1`、`#8B5CF6`）；纯平背景（必须噪点纹理或渐变）；Tailwind 默认色板。
- 布局禁止：Hero+三卡片；完美居中；等宽多栏（必须不对称）。
- 文案禁止：高深名词和空话；Lorem Ipsum；被动语态和长句。风格：口语化、有数字和场景、可幽默自嘲、每句 ≤15 字。
- 组件禁止：Shadcn/Material UI 默认组件（必须深度定制）；Emoji 当功能图标；线性动画（`ease-in-out`）。
- 图片：图标 Iconify、占位图 Picsum、真实图 Pexels、插画 unDraw。

## 9. 必读文档

- `.agents/skills/*/SKILL.md` — 匹配到的技能必须先读再执行
- `README.md` — 项目背景与定位
- `3D_SPEC.md` — 3D 茶空间约束（改 three/ 前必读）
- `DESIGN_SPEC.md`、`REQUIREMENTS.md` — 设计与需求基线
- `TESTING_SPEC.md` — 涉及测试时
- `CONTEXT.md`、`DATABASE_ER.md` — 涉及数据库时
- `DEPLOY.md` — 涉及部署时
- 相关源码、配置、测试、`package.json`、`backend/requirements*.txt`、`docker-compose.yml`、`nginx.conf`

禁止只凭文件名或经验猜实现；没找到依据就明说"不确定/未找到"。

## 10. 边界

### ✅ 总是做

- 改代码前先读相关文件和匹配的 SKILL.md。
- 改动后跑最小验证（type-check 起底），提交前跑完整基线。
- 只写 `src/`、`backend/app/`、`tests/`、`e2e/` 等业务区。

### ⚠️ 先问再做

- 删除文件/目录、覆盖大量内容。
- `git push`、发版、部署生产、合并 PR。
- 数据库迁移、数据清空、回滚。
- 修改 `.env`、密钥、认证逻辑。
- 升级主要依赖（Vue、FastAPI、SQLAlchemy 等）。
- 修改 `docker-compose.yml`、`nginx.conf` 核心配置。

### 🚫 绝不

- 提交或回显任何密钥：`.env*`、`*.pem`、`secrets/`、`credentials.json` 只读 `.env.example`。
- 编辑 `node_modules/`、`dist/`、生成目录。
- `force-push main`。
- 浏览器直连第三方 AI。
- 不读不写人类手写的未标记内容；AI 生成区与人类区必须分离。

## 11. 命令速查

### 前端

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器（http://localhost:5173）
npm run type-check   # 类型检查
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览生产构建
npm run smoke        # 生产预览路由冒烟测试
npm run test         # Vitest 单测
npm run test:watch   # Vitest 监听
npm run test:e2e     # Playwright E2E
```

### 后端

```bash
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest tests -q
python -m py_compile main.py
uvicorn main:app --reload --port 8000
alembic revision --autogenerate -m "msg"
alembic upgrade head
python -m seeds.run
```

### Docker

```bash
docker compose up -d --build
docker compose logs -f backend
docker compose exec backend python -m seeds.run
docker compose down
```

## 12. 项目学习记录

**本区由 AI 维护，不是只给人类看。** 用户纠正了你的做法，就在本会话结束前加一行具体规则（"总是用 X 做 Y"，不要"注意 Y"）。已有规则覆盖就先收紧它，不要重复加。问题消失（模型升级、重构、流程变更）就删行。

- （空）

## 13. 来源与维护

本融合版基于：AGENTS.md 开放标准（agents.md）、TechSpokes 规范 v3（章节顺序/解析可靠性）、TheRealSeanDonahoe agents-md（行为脚手架/学习记录）、awesome-agents-md（七段内容结构）、eugeniughelbur agents-md（边界三层/不覆盖人类内容）、bysiber agents-md-tools（lint 十条/密钥排除）、ai-boost agents_md_author（写作纪律/命令溯源）、agentsmd.io 最佳实践（活文档/迭代）。

维护规则：

- **保持短。** 超 500 行就是在跟自己打架，200-300 行最舒服。详细内容放外部文档，这里只留链接。
- **只留救过命的规则。** 定期问："删掉这行会让 AI 犯错吗？"不会就删。
- **命令必须真实。** 一律从 `package.json` scripts、Makefile、CI 抄，不凭记忆写。
- **写规则不写建议。** "禁止 X"能机械执行，"建议 X"只能被尽量遵守。
- **更新记录**：2026-09-09 融合多源规范重构（行为脚手架 + 边界三层 + 学习记录 + 设计风格规范并入）。

*本文件是活文档，项目架构或流程变更时同步更新。*
