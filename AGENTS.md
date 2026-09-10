# AGENTS.md — 一盏茶项目 AI 协作规则

> 给机器看的 README。仓库里所有 AI 编码助手（Codex、Claude Code、Cursor、Copilot、Gemini CLI 等）开工前必读。
> 格式遵循 AGENTS.md 开放标准（Linux Foundation / Agentic AI Foundation 治理，与 MCP、Agent Skills 并列）。
> 本文件是活文档：每次 AI 犯错，往「项目学习记录」加一行；每几周修剪一次。

## 0. 不可妥协

这几条优先级最高，与本文其他内容冲突时以本条为准：



1. **不奉承，不废话。** 禁止 "好的问题"" 你说得对 ""我很乐意" 这类开场白。直接给答案或行动。

2. **不同意就说。** 用户的前提错了要当面指出，再干活。为了礼貌附和错误前提，是编码助手最严重的失败模式。

3. **绝不编造。** 不编文件路径、commit 哈希、API 名、测试结果、库函数。不知道就读文件、跑命令、或说 "我查一下"。

4. **困惑就停。** 任务有两种合理解读且影响产出时，问。不许默默选一个往下做。

5. **只动必须动的。** 每一行改动都能追溯到用户请求。禁止顺手重构、顺手格式化、顺手清理。

## 1. 摘要

「一盏茶」是沉浸式在线茶道应用：Vue 3 前端 + FastAPI 后端 + TresJS 3D 茶空间，离线优先、可分享品鉴卡、六阶段路线图已推进到视觉升级阶段。



* **日常任务**（改样式、调文案、修小 bug）：读本摘要 + 「必守规则」+「边界」即可，不必读全文。

* **架构级改动**（新增路由、动数据库、动 3D 场景结构）：读全文。

* 上下文不够时，优先保「不可妥协」和「必守规则」。

## 2. 项目速览



| 层  | 技术栈                                                                           | 入口                   |
| -- | ----------------------------------------------------------------------------- | -------------------- |
| 前端 | Vue 3 + TS + Pinia + Vue Router + Tailwind 4 + Vite + Dexie + Three.js/TresJS | `src/main.ts`        |
| 后端 | FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL + Pydantic v2                 | `backend/main.py`    |
| 部署 | Docker Compose + Nginx + PWA + GitHub Pages Demo                              | `docker-compose.yml` |
| 测试 | Vitest + fake-indexeddb + Playwright + pytest + Alembic 迁移测试                  | 见「验证」                |
| CI | GitHub Actions（7 job 合并门禁）                                                    | `.github/workflows/` |

业务闭环：入席 → 选茶 → 备器 → 煮水 → 冲泡 → 品鉴记录 → 个人成长。

进度：阶段一至五✅（打磨展示 / 自动化测试 / 分享品鉴卡 / AI 代理 / GitHub 专业度）；阶段六简历待做；视觉升级推进中（3D 茶席、泡茶动画、产区地图、晨雾茶山）。

## 3. 写码前



* 先用一两句话说明计划；非琐碎任务给带验证步骤的编号清单。

* 读要改的文件，再读调用它的文件。

* 匹配项目现有模式：项目用 X 就用 X，别按新项目习惯来。

* 把假设说出口："我假设你要 X，不对就说"。

* 两种方案都可行时，两个都摆出来讲清取舍，不许默默选一个。琐碎任务（改错字、重命名）除外。

## 4. 写码纪律



* **最小实现**：只解决被要求的问题。不加没要求的功能、抽象、配置、钩子。

* 不加 "为了将来扩展"—— 将来是将来做的决定。倾向于删代码而不是加代码。

* 200 行能解决的事不写 500 行。写完先自查：资深工程师看这个 diff 会觉得过度设计吗？会就简化。

* **外科手术式改动**：不 "顺手" 改进相邻代码、注释、格式、import。不重构跑得好好的代码。

* 自己改出来的孤儿（失效的 import、变量、函数）要清掉。已有死代码不删，提一句即可。

* 检验标准：每一行改动都直接来自用户请求。不满足就回退。

## 5. 目标驱动与验证



* 把模糊需求改写成可验证目标再动手："修 bug"→"写一个复现报错症状的失败测试，再让它通过"。

* 写码前先定成功标准；能写验证（测试 / 脚本 / 截图对比）就写；跑验证、读输出，不凭 "看起来对" 报完成。

* **用运行代替猜测**：有测试跑测试，有 lint 跑 lint，有 type-check 跑 type-check。plausibility 不是 correctness。

* 修 bug 修根因，不压症状。读报错读完整，半截 trace 修不出对的修复。

* 前端 UI 改动要截图验证：改前一张、改后一张，描述差异；页面完成后按「前端设计 · 设计审计」清单自查。

### 本项目的验证基线（改完代码必跑）



```
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



* 上下文是稀缺资源。长会话累积多次失败，不如带着更好的提示开新会话。

* 同一问题连续两次修正失败就停下，总结学到的东西，请用户重开会话。

* 探索性任务用子代理 / 只读手段，别让几十次文件读取污染主上下文。

* 沟通直率不绕弯："这个方案扩展不了因为 X" 好过 "这思路有意思，但你有没有考虑过……"。

* 默认简洁，两三段话。不重复问题，不写客套结尾。短答案用散文，别堆无谓的标题和列表。

* commit 信息写清楚：subject ≤ 72 字符，body 讲 why。禁止 "update file""fix bug" 这类空 commit。

## 7. 何时问，何时直接做

**先问再做**：请求有两种合理解读且选择实质影响产出；改动碰的是被明示 "承重 / 有版本 / 有迁移路径" 的东西；需要你给凭据或生产资源；用户的目标和字面请求冲突。

**直接做**：琐碎且可逆（改错字、重命名局部变量）；歧义能靠读代码或跑命令解决；这个问题本会话用户已经回答过。

## 8. 必守规则

### 语言与通用



* 简体中文优先：除代码、命令、路径、API、日志字段外，全部中文。

* 不编造：不虚构文件、命令、测试结果、接口、库行为、茶文化知识。

* 最小必要修改：不顺手重构、格式化、升级依赖、扩展功能。

* 技能优先：匹配的技能必须先 Read 对应 `SKILL.md` 再执行，禁止凭技能名猜用法。

* 写规则不写建议：给 "禁止 X" 不给 "建议用 X"；把 "为什么" 写进规则。

### 前端



* Vue 3 Composition API + `<script setup lang="ts">`，禁止 Options API、禁止 `any`。

* 状态：业务用 Pinia（`src/stores/`），局部用 `ref/reactive`。

* 样式：Tailwind 4，不写自定义 CSS 文件。

* IndexedDB 统一走 `src/services/storage.ts`；API 统一走 `src/services/api.ts`；**AI 请求必须走后端代理&#x20;**`/api/ai/*`**，禁止浏览器直连第三方 AI**。

* 组件 ≤ 200 行，超了拆；Props/Emits 必须带类型；副作用在 `onMounted`/`onUnmounted` 管理。

### 后端



* FastAPI 路由在 `backend/app/routers/`，SQLAlchemy 2.0 异步风格，Pydantic v2 schema 与 ORM 分离。

* RESTful 复数路径，响应必须有 schema，错误用状态码 + `detail` 统一格式。

* 认证接口 `/api/auth`，需登录的接口依赖 `get_current_user`。

* 密码哈希 passlib [bcrypt]，**bcrypt 必须锁定** `==4.0.1`（5.0 与 passlib 1.7.4 不兼容）。

### 数据库



* **绝对禁止**直接改模型不生成迁移。改库前先读 `.agents/skills/db-migration/SKILL.md`。

* 流程：改模型 → `alembic revision --autogenerate` → 人工审核脚本（JSONB 等 PG 语法必须真实 Postgres 验证）→ `alembic upgrade head` → 跑迁移测试（upgrade/downgrade 往返）。

* 数据迁移要写迁移逻辑，不能只改表结构。

### 测试



* 新功能 / 修 bug 必须带测试；TDD 优先（先写失败测试 → 最小实现 → 重构）。

* E2E 用真实等待，不伪造时钟；选择器用可见文本 / 角色，不依赖动画中间态。

* CI 7 job 是合并门禁：前端 type-check+build+smoke / Vitest / E2E / 后端语法 /pytest/ 迁移测试 / Compose 校验。

* 测试发现的产品缺陷按根因修，单独 `fix:` commit。

### Git



* `main` 稳定，新功能 `feature/xxx`，修 bug `fix/xxx`。

* Commit 中文，格式 `类型: 简要描述`（feat/fix/refactor/docs/chore/style）。

* 缺陷修复与功能 / 测试分开提交。

* 不提交 `node_modules/`、`dist/`、`.env`、`__pycache__/`、`.venv/`、`test-results/`、`playwright-report/`。

### 茶文化



* 茶叶分类按六大茶类；冲泡参数符合茶类常识（见 `tea-tasting` 技能基准表）。

* 不编造不存在的茶名、茶器、历史人物；不确定标 "待核实"；优先用 `src/data/` 已有数据。

### 项目特有约定



* 评分模型：品鉴结果 = 八维口感评分 × 冲泡工艺系数，保持可解释性（读 `tea-tasting`）。

* 离线同步：IndexedDB 记录有 `sync_status`（pending/synced/failed），新增字段考虑同步逻辑；写入前 `toRaw` 去代理（防 DataCloneError）。

* AI 茶灵：`teaAI.ts` 有降级逻辑，修改必须保留网络不可用时的规则回复。

* 品鉴卡分享：`share.ts` 纯函数 base64url 编解码，`/share` 只读页，数据经 URL 传输必须防御性校验。

* 3D 茶空间：`src/components/three/` 只做视觉层，不改状态机；见 `3D_SPEC.md`。

* PWA：`vite-plugin-pwa` 已配置，改静态资源注意缓存策略。

### 前端设计（反主流 × 创新）

> 执行前端 / 页面设计的是一位资深独立设计师：反主流、鄙视 SaaS 模板、每个像素都有温度。
> 验收标准：**一眼认不出是模板，也认不出是 AI 生成的**。通用完整版见 `FRONTEND_DESIGN_SPEC.md`（设计任务必读）+ `.agents/skills/frontend-design/SKILL.md`。

**设计流程（强制门禁链）**——所有设计 / UI 任务必须按序走完 6 步，缺一步不算完成，禁止跳步：

1. **Design Read（门禁 1）**：开工先输出一行 Design Read（页面类型 / 受众 / vibe / 倾向体系）+ 三拨盘（VARIANCE / MOTION / DENSITY，基线 8/6/4）。**未输出 Design Read = 任务未开始，禁止写任何代码**（含临时草稿）。
2. **视觉方向（门禁 2）**：一两句话写视觉方向（如"清晨茶园的水墨留白"），列 4-6 色令牌 + 字体角色。方向未定不得进入实现。
3. **对照简报评审**：对照用户简报评审第 1-2 步，像"任何项目都能用的默认"就改；简报优先，用户明说方向时简报原话赢；勇气只花在一个地方，一个元素负责让人记住；体系诚实（审美方向无官方包时原生实现并标注"近似"）。
4. **实现**：按 Design Read + 视觉方向写码，执行时调用匹配技能（taste-skill / ui-ux-pro-max / frontend-design / impeccable / Aceternity 品质线），禁止用普通模板手感凑数。
5. **评审 critique**：收尾走 impeccable critique（层级 / 清晰 / 情感三维），发现偏离方向立即修正。
6. **审计 audit + 设计审计**：audit（a11y / 性能 / 响应式）+ 本文件「设计审计」清单；**未过审计不得提交**。

**与 superpowers 流程的联动**：Design Read / 视觉方向必须在 brainstorming + writing-plans 阶段产出并写进计划（计划第一项 = 设计方向），executing-plans 阶段只做门禁 4-6；superpowers 的计划 / 执行 / 收尾三阶段分别对应门禁 1-3 / 4 / 5-6。

**与 functional-design 的联动（功能架构先行）**：新建页面 / 新功能 / 大组件，实现前先调 `functional-design` 技能走 Phase 1-5（功能发现 13 问 → 架构映射 → 行为规格 → 交互设计 → 验证），产出功能规格后再进入门禁链 1-3（视觉方向）→ 实现（Phase 6-8 按规格生成代码）→ 门禁 5-6 收尾；小改动 / 单组件 / 纯视觉调整跳过功能阶段，直接走门禁链。

**组件与效果标准（Aceternity 品质线）**：

* 网站 / 页面组件必须对标 Aceternity UI（https://ui.aceternity.com/components）的品质：免费复制粘贴级、Tailwind + 动效内置、微交互齐全——**禁止退回普通卡片模板**。
* Aceternity 是 React/Next.js + Motion 生态，本项目是 Vue 3 + TresJS：**不直接 import**，改为在 Vue 中复刻其设计语言与效果模式（Aurora 极光背景、Spotlight 光斑、Tilt 倾斜卡片、Cloud Shader 程序化云、Text Flipping Board 翻板文字、Chromatic 色彩分离图像等）。
* 设计新组件 / 效果前，先读 Aceternity 组件目录（https://ui.aceternity.com/components）挑效果模式，再在 Vue + Tailwind 4 + TresJS 里实现；引用时标注灵感来源。

**禁令速查**（完整清单见 FRONTEND_DESIGN_SPEC.md §3）：

* 配色：AI 紫渐变、暖米白 + 陶土、**纯黑灰（要 tint）**、Tailwind 默认色板；**一页一个强调色全页锁定**。
* 字体：Inter / 系统栈禁默认；**衬线体禁默认**（最大 AI 特征）；Fraunces / Instrument_Serif 直接禁；标题内强调用同字体斜体 / 粗体，禁混插异族字体。
* 布局：Hero + 三卡片；完美居中；等宽多栏；**眉题 eyebrow 绝对禁**；01/02/03 编号除非真序列。
* 组件：卡片套卡片；玻璃拟态装饰；渐变文字；彩色侧边条；Emoji 当图标；等宽当戏服；几何蒙版抠图。
* 动效：每节同款入场禁；bounce / elastic 禁；悬停动图禁；**一个编排时刻**；尊重 `prefers-reduced-motion`。
* 文案：空话 / Lorem Ipsum / 被动语态 / 错误道歉禁；错误说清问题 + 恢复方式；按钮写动作不写"提交"。风格：口语化、有数字和场景、每句 ≤15 字。

**质量底线**（可验证，不只是"看起来对"）：

* 正文 / 占位对比度 ≥ 4.5:1；彩色底上次要文字用同色相派生色，禁灰。
* 正文度量 65-75ch；display ≤ 6rem；阴影带偏移 + 软模糊。
* 状态五态齐全：hover / disabled / loading / error / empty。
* **浏览器表面定制**：选区、滚动条、焦点环、光标上主题色——"人做的 vs 拼装的"最便宜信号。

**工程规范**：

* 引入第三方库前先查 `package.json`，缺了先输出安装命令，禁止假设存在。
* 全屏 Hero 禁 `h-screen`，用 `min-h-[100dvh]`；复杂布局用 Grid，禁 flex 百分比数学。
* 字体自托管（@font-face + swap），生产禁 `<link>` 引 Google Fonts。

**创新工具箱**（2026 趋势，按场景选用，不当模板堆）：

* 打破网格：文字压图、超大字重、错位留白。
* 液态玻璃 / 玻璃拟态：背景内容透过半透明面板可见，配噪声纹理压"廉价感"。
* 3D 沉浸：项目已有 TresJS，用 3D 元素做叙事锚点，不做装饰摆设。
* 暗黑模式：从设计之初就做明暗两套，不是事后反转。
* 插画 / 手绘：用 unDraw 风格定制插画替代统一图标。
* 新粗野（Neo-Brutalism）：硬边框、硬阴影、高饱和，表达"敢"。
* 交互叙事：滚动驱动叙事（scroll-driven），让页面像故事展开。

**设计工作流**（新页面 / 重构按序走）：

* 新页面先规划 UX/UI（信息架构 / 层级）再写码；评审用 critique（层级 / 清晰 / 情感）→ audit（a11y / 性能 / 响应式）；收尾 polish。
* 调性：bolder（太安全放大）/ quieter（太吵收）/ distill（删到本质）；专项：harden（错误 / 溢出边界）/ onboard（空态 / 首登）/ clarify（UX 文案）。

**设计审计**（页面 / 组件完成后截图自查，完整版见 FRONTEND_DESIGN_SPEC.md §6）：

* 去掉 logo 还能认出是"一盏茶"吗？认不出 = 没性格。
* 会不会被当成模板 / AI 生成？会就改掉最像模板的那个元素。
* 浏览器表面定制了吗（选区 / 滚动条 / 焦点环）？色彩一致性锁了吗？五态齐全吗？
* 数字、场景、文案是否具体？动效有意图还是纯装饰？
* 手机端可读、可点、无重叠裁切？触控目标 ≥ 44px？

**图片系统**：图标 Iconify、占位图 Picsum、真实图 Pexels、插画 unDraw。

## 9. 必读文档



* `.agents/skills/*/SKILL.md` — 匹配到的技能必须先读再执行

* `README.md` — 项目背景与定位

* `3D_SPEC.md` — 3D 茶空间约束（改 three/ 前必读）

* `DESIGN_SPEC.md` — 设计基线（REQUIREMENTS.md 已删除，需求基线以 V2_UPGRADE.md + V3_PLAN.md 为准）

* `TESTING_SPEC.md` — 涉及测试时

* `CONTEXT.md`、`DATABASE_ER.md` — 涉及数据库时

* `DEPLOY.md` — 涉及部署时

* 相关源码、配置、测试、`package.json`、`backend/requirements*.txt`、`docker-compose.yml`、`nginx.conf`

禁止只凭文件名或经验猜实现；没找到依据就明说 "不确定 / 未找到"。

## 10. 边界

### ✅ 总是做



* 改代码前先读相关文件和匹配的 SKILL.md。

* 改动后跑最小验证（type-check 起底），提交前跑完整基线。

* 只写 `src/`、`backend/app/`、`tests/`、`e2e/` 等业务区。

### ⚠️ 先问再做



* 删除文件 / 目录、覆盖大量内容。

* `git push`、发版、部署生产、合并 PR。

* 数据库迁移、数据清空、回滚。

* 修改 `.env`、密钥、认证逻辑。

* 升级主要依赖（Vue、FastAPI、SQLAlchemy 等）。

* 修改 `docker-compose.yml`、`nginx.conf` 核心配置。

### 🚫 绝不



* 提交或回显任何密钥：`.env*`、`*.pem`、`secrets/`、`credentials.json` 只读 `.env.example`。

* 编辑 `node_modules/`、`dist/`、生成目录。

* `force-push main`。

* 浏览器直连第三方 AI。

* 不读不写人类手写的未标记内容；AI 生成区与人类区必须分离。

## 11. 命令速查

### 前端



```
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



```
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



```
docker compose up -d --build

docker compose logs -f backend

docker compose exec backend python -m seeds.run

docker compose down
```

## 12. 项目学习记录

**本区由 AI 维护，不是只给人类看。** 用户纠正了你的做法，就在本会话结束前加一行具体规则（"总是用 X 做 Y"，不要 "注意 Y"）。已有规则覆盖就先收紧它，不要重复加。问题消失（模型升级、重构、流程变更）就删行。



* 删除 / 覆盖任何文件（含 git rm）之前，先 Read 该文件内容并确认无独立价值，再动手；恢复成本高于删除成本。

## 13. 来源与维护

本融合版基于：AGENTS.md 开放标准（agents.md）、TechSpokes 规范 v3（章节顺序 / 解析可靠性）、TheRealSeanDonahoe agents-md（行为脚手架 / 学习记录）、awesome-agents-md（七段内容结构）、eugeniughelbur agents-md（边界三层 / 不覆盖人类内容）、bysiber agents-md-tools（lint 十条 / 密钥排除）、ai-boost agents_md_author（写作纪律 / 命令溯源）、agentsmd.io 最佳实践（活文档 / 迭代）。

维护规则：



* **保持短。** 超 500 行就是在跟自己打架，200-300 行最舒服。详细内容放外部文档，这里只留链接。

* **只留救过命的规则。** 定期问："删掉这行会让 AI 犯错吗？" 不会就删。

* **命令必须真实。** 一律从 `package.json` scripts、Makefile、CI 抄，不凭记忆写。

* **写规则不写建议。** "禁止 X" 能机械执行，"建议 X" 只能被尽量遵守。

* **更新记录**：2026-09-09 融合多源规范重构（行为脚手架 + 边界三层 + 学习记录 + 设计风格规范并入）；同日前端设计升级为「反主流 × 创新」规范（视觉方向先行 + 2026 创新工具箱 + 设计审计）；随后产出通用规范 FRONTEND_DESIGN_SPEC.md（四家融合）并把核心吸收进设计节（设计流程 / 质量底线 / 工程规范 / 设计工作流）；同日安装设计技能全家桶（taste-skill 13 + ui-ux-pro-max 7 + impeccable 全套 + Anthropic 官方 10 + Vercel 3）并新增「组件与效果标准（Aceternity 品质线）」；设计流程升级为 6 步强制门禁链并与 superpowers 流程三阶段联动（Design Read 未产出禁止写码 / 未过审计禁止提交）；安装 functional-design 技能并接入门禁链（功能架构先行：新页面/新功能先走 13 问+状态机规格，再进视觉门禁）。2026-09-09 更新记录已满，后续新增记录另起一行。

*本文件是活文档，项目架构或流程变更时同步更新。*