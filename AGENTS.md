# AGENTS.md — 一盏茶项目 AI 协作规则

> 给机器看的 README。仓库里所有 AI 编码助手（Codex、Claude Code、Cursor、Copilot、Gemini CLI 等）开工前必读。
> 本文件是活文档：AI 每次犯错，往「13 更新记录」加一行；每几周修剪一次。V4 重构见 ADR-009。

## 0. 不可妥协

1. **不奉承，不废话。** 禁止 "好的问题""你说得对""我很乐意" 这类开场白。直接给答案或行动。
2. **不同意就说。** 用户前提错了当面指出，再干活。为了礼貌附和错误前提，是编码助手最严重的失败模式。
3. **绝不编造。** 不编文件路径、commit 哈希、API 名、测试结果、库函数。不知道就读文件、跑命令、或说 "我查一下"。
4. **困惑就停。** 任务有两种合理解读且影响产出时，问。不许默默选一个往下做。
5. **只动必须动的。** 每一行改动都能追溯到用户请求。禁止顺手重构、顺手格式化、顺手清理。

## 1. 项目身份

「一盏茶」：沉浸式在线茶道应用——Vue 3.5 + TS 6（strict）+ Pinia 4 + Tailwind 4 + Vite 8 + TresJS 5.8/Three 0.185 + Dexie（离线优先 PWA）+ **Spring Boot 3.5 + Spring AI Alibaba + PostgreSQL（后端重写中，旧 FastAPI 仅维护不新增）**。不是泡茶工具，是一座数字茶室。

业务闭环：入席 → 选茶 → 备器 → 煮水 → 冲泡 → 品鉴记录 → 个人成长。

进度：阶段一至五 ✅、视觉升级 ✅、P0 打磨 ✅、P1 深化 ✅；阶段六（简历）**暂缓（用户明确不做）**；当前处生产级收敛（V4：docs 分层 + quality 门禁，ADR-009）。

日常任务（改样式/调文案/修小 bug）读本文件即可；架构级改动（新增路由/动数据库/动 3D 结构）读全文 + 对应文档。

## 2. AI 工作原则

- 写码前先说一两句计划；非琐碎任务给带验证步骤的编号清单。
- 先读要改的文件，再读调用它的文件；匹配项目现有模式，别按新项目习惯来。
- 把假设说出口："我假设你要 X，不对就说"；两种方案都可行时都摆出来讲清取舍，不许默默选一个。
- **用运行代替猜测**：有测试跑测试、有 lint 跑 lint、有 type-check 跑 type-check。plausibility 不是 correctness。
- 前端 UI 改动截图验证：改前一张、改后一张，描述差异；改完按设计审计清单自查。
- 上下文是稀缺资源：同一问题连续两次修正失败就停下，总结所学，请用户重开会话；探索性任务用只读手段，别污染主上下文。
- 关键决策（新功能立项/方案评审）先用多角色质询（PM/架构师/UX/开发者/分析师各提一个反对意见）或深度批判四法（pre-mortem 默认首选）。
- **写作风格（80% ASD-STE100，2026-10-06 融入）**：①每句一事实或一条指令，指令 ≤20 词、描述 ≤25 词；②主动语态，说清谁做什么；③同物同词——术语（契约字段/领域概念）定义一次后精确复用，禁换着叫；④先答案后细节（§0 已有，写解释时严格执行）；⑤步骤放编号列表，每段一个主题最多 6 句；⑥用用户的语言回答，句子简短；⑦流程/结构/架构超过 3 个部分时加 ASCII 图或引用架构图；⑧用户说"用 HTML 解释/做成网页"时，交付单文件交互式 HTML 页。评估与抽样流程见 `docs/agent-eval-baseline.md`。

## 3. 架构边界

- 前端 `views → stores → services`；后端 `Controller → Service → Repository`（Controller 只做参数与响应）。详见 `docs/architecture/system-overview.md`。
- **AI 请求必须走后端代理 `/api/ai/*`，禁止浏览器直连第三方 AI**；`teaAI.ts` 降级逻辑（网络不可用时规则回复）是承重墙，改动必须保留并回归。
- `src/components/three/` 只做视觉层，不改状态机（`3D_SPEC.md`）。
- IndexedDB 记录带 `sync_status`（pending/synced/failed），新增字段考虑同步逻辑；写入前 `toRaw` 去代理（防 DataCloneError）。
- 评分模型：品鉴结果 = 八维口感评分 × 冲泡工艺系数，保持可解释性（读 `tea-tasting`）。
- 品鉴卡分享：`share.ts` 纯函数 base64url，`/share` 只读页防御性校验（数据带版本字段，未知版本拒绝）。
- PWA：`vite-plugin-pwa` 已配置，改静态资源注意缓存策略；视频不本地化、离线降级静态图。
- 部署：Docker Compose 编排（backend/frontend/postgres/nginx），详见 `DEPLOY.md`（旧 Windows 原生脚本保留参考）。

## 4. 开发流程（AI Change Protocol）

所有 AI 修改必须按序走完，缺一步不算完成：

1. **理解上下文**——读相关文件 + 匹配技能 `SKILL.md` 后再动手。
2. **确认影响范围**——涉及承重 / 有版本 / 有迁移路径的改动，先问再做。
3. **修改**——按 §5 纪律，只动必须动的。
4. **运行验证**——按 §11 命令入口，验证级别匹配改动级别（§5 Modification Level）。
5. **报告证据**——做了什么、跑了什么、结果如何，凭证据报完成。

禁止：不读文件直接改代码；直接新增依赖；直接改变架构；跳过验证宣称完成。

## 5. 修改纪律

- **最小实现**：只解决被要求的问题，不加 "为了将来扩展"；200 行能解决不写 500 行。
- **外科手术式改动**：不顺手改进相邻代码/注释/格式/import；不重构跑得好好的代码。
- 自己改出的孤儿（失效 import/变量/函数）清掉；已有死代码不删，提一句即可。
- 检验标准：每一行改动都直接来自用户请求，不满足就回退。

**Modification Level**（改动分级，验证按级匹配）：

| 级别 | 改动类型 | 最低验证 |
|---|---|---|
| L0 | 文档 / 文案 | 无 |
| L1 | UI / 样式 | `npm run type-check` + `npm run build` |
| L2 | 业务逻辑 / 服务 | `npm run test` + L1 |
| L3 | 架构 / 数据模型 | ADR + 迁移测试 + L2 |

新增数据库表属 L3：必须写 ADR（写入 `docs/ADR/`）并走 Flyway 迁移 + upgrade/downgrade 往返测试（后端重写完成后；过渡期旧后端仍用 Alembic）。

## 6. 前端规范

- Vue 3 Composition API + `<script setup lang="ts">`，禁止 Options API、禁止 `any`；组件 ≤ 200 行超了拆；Props/Emits 必须带类型；副作用在 onMounted/onUnmounted 管理。
- 状态：业务用 Pinia（`src/stores/`），局部用 `ref/reactive`；样式：Tailwind 4，不写自定义 CSS 文件。
- IndexedDB 统一走 `src/services/storage/`；API 统一走 `src/services/api/`。
- 触控目标 ≥ 44px；状态五态齐全（hover/disabled/loading/error/empty）；正文对比度 ≥ 4.5:1；浏览器表面定制（选区/滚动条/焦点环/光标）。
- 字体自托管（@font-face + swap），生产禁 Google Fonts link；全屏 Hero 用 `min-h-[100dvh]` 禁 `h-screen`；图标一个库一个家族，禁手绘 SVG 路径；引入第三方库前先查 package.json。
- **设计令牌与组件规则**：色值/间距/圆角/阴影/动效令牌、组件规则、Three.js 规则（禁直接创建 renderer，统一 TresJS）见 `DESIGN_SPEC.md`；3D 详细约束见 `3D_SPEC.md`。
- **设计门禁（强制 6 步）**：① Design Read（页面类型/受众/vibe/倾向体系 + 三拨盘 8/6/4，未输出禁止写码）→ ② 视觉方向（一句话 + 4-6 色令牌 + 字体角色）→ ③ 对照简报评审 → ④ 实现（调用 taste-skill / ui-ux-pro-max / frontend-design / impeccable，禁模板手感）→ ⑤ critique（层级/清晰/情感）→ ⑥ audit + 设计审计 9 条，未过审计不得提交。完整规范见全局技能 `frontend-design-spec`。
- 设计禁令速查：AI 紫渐变 / 暖米白+陶土 / 纯黑灰（要 tint）/ Tailwind 默认色板 / Inter 与衬线体默认 / Fraunces·Instrument_Serif / eyebrow 眉题 / Hero+三卡片 / Emoji 当图标 / 玻璃拟态装饰 / 渐变文字 / bounce·elastic 动效 / 每节同款入场 / 「提交」式按钮文案，一律禁止。

## 7. 后端规范

> 完整编码规范（分层/异常/对象模型/事务/数据访问/线程/安全/AI 集成）见 `.harness/rules/编码规范.md`（15 条红线零容忍），此处只列要点。

- 后端重写为 Spring Boot 3.5 + Spring Data JPA + Spring AI Alibaba（**新代码按此规范；旧 FastAPI 代码仅维护，不新增功能**）。
- 分层 `Controller → Service → Repository` 单向依赖；Controller 只做参数与响应，不写业务逻辑、不写数据库查询。分层规则已机械化：`backend/src/test/java/com/tea/architecture/LayerDependencyTest.java`（ArchUnit，CI Maven test 门禁）。
- 错误统一 `ApiResponse<T>` + `{code, message}`：Service 抛 BusinessError 子类（BadRequest/Unauthorized/NotFound/Conflict）。
- 认证：Spring Security + JWT；需登录接口加鉴权；密码哈希用 BCrypt。
- 事务：写方法 `@Transactional(rollbackFor = Exception.class)`，只读 `readOnly = true`；禁事务内远程调用。

## 8. 数据规范

- **绝对禁止直接改模型不生成迁移**。改库前先读 `.harness/rules/编码规范.md` 数据库规范；**新 Spring Boot 库改动走 `.harness/skills/biz-dev/09-db-migration`（Flyway）；过渡期旧 FastAPI 后端改动走 `.agents/skills/db-migration`（Alembic），新栈优先**。
- 流程（后端重写后为 Flyway）：改模型 → 写迁移脚本（`db-migrations.sql` + `rollback.sql` 成对）→ 真实 Postgres 验证 → upgrade → 迁移测试（upgrade/downgrade 往返）。
- 数据迁移要写迁移逻辑，不能只改表结构。
- 茶文化数据：茶叶分类按六大茶类，冲泡参数符合茶类常识（`tea-tasting` 基准表）；不编造茶名/茶器/历史人物，不确定标 "待核实"；优先用 `src/data/` 已有数据。

## 9. 测试规范

- 新功能/修 bug 必须带测试；TDD 优先（先写失败测试 → 最小实现 → 重构）。
- **垂直切片（tracer bullet）**：一个测试 → 最小实现 → 下一个测试；禁止先写完所有测试再写实现（水平切片产出想象行为的垃圾测试）。单片必须端到端可验证。
- **行为测试三规则**：只走公共接口；不 mock 内部协作者（mock 只用于跨进程/外部边界：网络、时钟、DB 驱动）；重构不改测试。
- 宽重构走 expand-contract：先 expand（新旧并存、CI 保持绿）→ 按包分批迁移（每批独立 commit）→ contract（旧形式无引用后删除）。
- E2E 用真实等待，选择器用可见文本/角色，不依赖动画中间态；测试发现的缺陷按根因修，单独 commit。
- CI 13 job 是合并门禁（type-check+build+smoke / Vitest / Biome / npm+pip audit / E2E / axe / 后端语法 / pytest / ruff+bandit / Spring Boot Maven / 迁移测试 / Compose 校验 / harness 一致性）。

## 10. 禁止事项

- 提交或回显任何密钥：`.env*`、`*.pem`、`secrets/`、`credentials.json`（只读 `.env.example`）。
- 编辑或提交 `node_modules/`、`dist/`、`__pycache__/`、`.venv/`、`test-results/`、`playwright-report/`。
- `force-push main`；`push main`、发版、部署生产前必须按边界确认。
- 浏览器直连第三方 AI。
- 不读不写人类手写的未标记内容；AI 生成区与人类区必须分离。
- 删除/覆盖任何文件（含 git rm）前，先 Read 该文件并确认无独立价值。
- 技能返回 "不支持某能力" 时，先判断通用工具能否补齐（yt-dlp/PyAV/自写脚本），只有真实失败（403/风控/需登录/付费墙）才回报限制。
- 上线前自查三项：健壮性（友好错误+输入校验）、安全性（防越权）、稳定性（失败重试/容错）；尽量周二~周四上线；上线后跑完整回归重点测权限，观察至少一周。
- **Git commit**：英文 conventional commits `type(scope): desc`（feat/fix/refactor/perf/test/docs/chore/style），subject ≤ 72 字符，body 讲 why；缺陷修复与功能/测试分开提交；`main` 稳定，新功能 `feature/xxx`，修 bug `fix/xxx`。

## 11. 命令入口

提交前默认跑：`npm run quality`（前端统一门禁）+ 后端 pytest + `node scripts/verify-harness.cjs`（治理一致性，已挂 CI）。

```
npm run quality       # lint + type-check + test + build + verify（提交前必跑）
npm run dev           # 开发服务器 http://localhost:5173
npm run test:e2e      # Playwright E2E（改了流程/路由）
node scripts/verify-gardens.cjs    # 3D 茶园四园晴雨截图，期望 ERRORS: []
node scripts/verify-pavilion.cjs   # 茶亭验证
node scripts/scan-emoji.cjs        # 禁 emoji 扫描
node scripts/verify-icons.cjs      # lucide 图标渲染审计
node scripts/verify-brew-mobile.cjs  # 冲泡页移动端触控（≥44px、无横向滚动）
node scripts/audit-touch.cjs       # 全局触控目标审计
node scripts/eval-harness.cjs <切片> --verify  # harness 七维确定性评测（每切片必跑，总分<60 阻断；报告 docs/agent-eval/）
node scripts/verify-harness.cjs    # harness 一致性体检（ADR/CI job/技能数/路径/wiki 四件套/子代理/审查页/changes 门禁），期望 ERRORS: []，CI 门禁
node scripts/add-doc-meta.cjs      # docs 元信息头批量补齐（新文档缺 frontmatter 时跑）
cd backend && python -m py_compile app/main.py                  # 后端语法（旧 FastAPI，过渡期）
cd backend && .\.venv\Scripts\python.exe -m pytest tests -q     # 后端全量（旧 FastAPI，过渡期）
# 后端重写完成后替换为：cd backend && mvn -q test              # 后端全量（Spring Boot）
```

部署（Docker Compose 编排，后端重写后启用）：全流程见 `DEPLOY.md`；旧 Windows 原生脚本（`scripts/deploy-backend.ps1` / `update-backend.ps1` / `install-windows-service.ps1` / `backup-postgres.ps1`）保留参考。依赖双锁定：前端 `package-lock.json`；后端重写后 `pom.xml` + lock 管理。

## 12. 文档索引

- `.agents/skills/*/SKILL.md` — 匹配到的技能必须先 Read 再执行
- `.agents/skills/README.md` — 技能路由总表（66 个，按族分组，任务启动先读）
- `.harness/rules/技能规范.md` — 技能治理唯一权威（模板/触发式描述/路由表维护，§5 增删改流程）
- `docs/skills/` — 核心技能人读审查页（plan-control / tea-tasting / db-migration / fastapi-endpoint / vue-component / caveman-review，面向人核对）
- `CONTEXT.md` — 术语 + ADR 索引 + 架构关键词（必读）
- `docs/ADR/` — 架构决策记录（ADR-001~013；新决策写 ADR-0XX.md，禁止塞进 CONTEXT.md）
- `docs/plans/` — 迭代计划层（PLAN-* / TODO-PRIORITY / 环境审查清单）
- `docs/reference/` — 稳定参考（error-codes.md 错误码表）
- `docs/architecture/system-overview.md` — 架构分层、数据流、目录速查
- `README.md` — 项目背景与定位
- `3D_SPEC.md` — 3D 茶空间约束（改 three/ 前必读）
- `DESIGN_SPEC.md` — 设计基线（色令牌/字体角色）
- `TESTING_SPEC.md` — 涉及测试时
- `DEPLOY.md` — 涉及部署时
- `CHANGELOG.md` — 版本与历史
- 相关源码、配置、测试、`package.json`、`backend/requirements*.txt`（旧 FastAPI，过渡期）、`nginx-windows.conf`
- `.harness/rules/编码规范.md` — 编码规范唯一权威（后端/前端/数据库/部署四域 + 15 条红线）
- `.harness/rules/工程结构.md` — 工程结构（根目录/前端/后端新旧/目标 Spring Boot/.harness/docs 分层）
- `.harness/rules/开发流程规范.md` — 开发流程（十阶段流水线 + 分支提交 + 回滚 + 多 agent + review + token 按需加载）
- `.harness/wiki/` — AI 编码上下文四件套（业务模型 / 接口协议 / 数据模型 / 领域术语），编码前按需读 ≤3 份
- `.harness/changes/_template/` — 变更追踪模板（summary + db-migrations + rollback），与 git 分支同名
- `.claude/agents/` — 三子代理（code-reviewer / consistency-verifier / red-line-auditor）
- `.harness/skills/` — 技能全套 32 个（main-dev 8 / biz-dev 19 / trouble-shooting 5），每族带 README 路由表，按需渐进式加载（request-analysis 规则 + Wiki ≤3、coding-skill ≤4）
- `.github/workflows/ci.yml` — CI 合并门禁（含 compose-validate / harness 一致性）
- `docs/agent-eval-baseline.md` — AI 协作评估基线（通用+专项维度、抽样会话评分流程、评估证据沉淀）

禁止只凭文件名或经验猜实现；没找到依据就明说 "不确定 / 未找到"。

## 13. 更新记录

**维护规则**：保持短（超 500 行就是在跟自己打架，200-350 行最舒服）；只留救过命的规则（问 "删掉这行会让 AI 犯错吗？" 不会就删）；命令必须真实（从 package.json/scripts 抄）；写规则不写建议（给 "禁止 X" 不给 "建议用 X"）；AI 每次犯错在此加一行，已有规则覆盖就收紧，不重复。**经验三级进化（2026-10-07）**：踩坑先写 lesson（单次记录）→ 跨项目复现归纳 pattern → 验证后晋升 instinct 自动生效；每级晋升需人工确认，防错误经验扩散。**修剪（执行路径）**：稳定经验迁入 `docs/plans/patterns.md`（pattern 池，见开发流程规范 §八），AGENTS 留一行索引；学习记录可压缩为一行，不删除。

**学习记录（近况沉淀）**：
- 删除/覆盖文件前先 Read 确认无独立价值；恢复成本高于删除成本。
- 开工前调研必须用横纵分析框架：先纵向历史演进，再横向统一维度对比，两轴合看再规划；禁止只收集 star 数。
- 冲泡页零点击闭环：煮水→温杯→醒茶→出汤全自动，仅 READY 拖一次注水；禁止为温杯/醒茶/出汤加回手动确认按钮。
- 新功能立项先过四维甄别（自由/用户/竞品/伪需求）；"团队自己会不会用" 是硬门槛，伪需求优先降级或砍。
- PowerShell 往 .vue 写含 JS 模板字符串的代码（如 `/tea/${id}`）用单引号 here-string（@'...'@），防 `$` 插值破坏；动手前先探测行尾（HomeView LF，TeaRoom/MapView/TeaDetailView CRLF 混合）。
- `vite preview` 可能绑定 IPv6 ::1，`node scripts/smoke.mjs http://localhost:4173`（127.0.0.1 会全部 fetch failed）。
- biome --write 的 organizeImports 会把 TresJS 模板组件导入转 type-only 导致运行时炸；biome.json 的 `**/*.vue` override 已关 useImportType/useExportType，且 biome.json 是严格 JSON 禁注释。
- KTX2 工具链：装 Khronos KTX-Software 官方 exe 取 toktx.exe 转码；three basis transcoder 复制进 public/ 供 KTX2Loader 运行时加载；workbox runtimeCaching 的 /3d/ 必须补 `ktx2|wasm|js` 否则离线缓存失效。
- 技能规范：新增/修改/删除技能必须按 `.harness/rules/技能规范.md`（frontmatter 必填、触发式描述、name=目录名、README 路由表同步；README 不列 = 不存在）。
- 需求分析先行：批 B 及后续切片必须先产出需求文档（范围边界/做什么与不做什么/F-编号 + Given-When-Then 验收/影响分析）并经用户确认，才进方案设计；禁止跳过需求分析直接写方案（2026-10-06 沉淀）。
- 数据库容器密码认证失败：先试候选已知密码（如历史 .env 值）再考虑重建卷；重建卷是最后手段，删前必须确认目标卷与生产/开发库卷独立（2026-10-06 沉淀）。
- Canvas UI（canvasui.dev，MIT+Commons Clause）：25 个 canvas 特效组件库，Vue 版可用、Tailwind4/Three0.185 兼容；html-in-canvas 需 Chrome140+ flag/其余降级 overlay；禁转售组件本身。评估见 docs/canvas-ui.md，引入须过四维甄别 + 设计门禁（2026-10-06 沉淀）。
- E2E 测试导航路径必须相对 baseURL（'login'、'brew'、'garden'），禁止前导斜杠（'/login'）：CI vite base=/tea-ceremony/，前导斜杠跳出 SW scope（离线深链 ERR_DISCONNECTED）或命中 vite base 提示页（无 title/lang，axe 挂）；重测试（真实 IndexedDB 批量写）显式传 timeout（2026-10-06 沉淀）。
- npm audit 本地必须加 `--registry=https://registry.npmjs.org`（npmmirror 不实现 audit endpoint）；`npm audit fix` 后跑 quality 验证无破坏再提交（2026-10-06 沉淀）。
- caveman-review 技能（main-dev）：评审输出格式变体，一行一条 finding（`L<line>: 🔴🟡🟢 <problem>. <why>. <fix>.`，问题/根因/修复三要素 + 关键项附失败原文）+ 结尾 verdict；不改评审维度与红线，默认评审仍走 expert-reviewer，用户点名/需省 token 时用（2026-10-06 沉淀，2026-10-07 升级三要素）。
- 写作风格 = 80% ASD-STE100（航空维修手册规范）：一句一事实/指令≤20词描述≤25词/主动语态/同物同词/先答案后细节/编号列表每段≤6句/用中文简短/>3部分加 ASCII 图/"用 HTML 解释"→单文件交互页。已消化入 §2，与现有"不废话/编号清单/中文"合并不重复；评估见 docs/agent-eval-baseline.md（2026-10-06 沉淀）。
- 治理文档须与实现同步：改 CI job 数、ADR 编号、技能数量、代理位置后立即更新 AGENTS.md + 对应规则文档；发现漂移当场修，不遗留（2026-10-07 沉淀：一次修 6 处）。
- 阿里 Harness 精读对照（2026-10-07）：五层结构/薄主会话/门禁阻断/经验三级进化/eval 评测，见 docs/research-harness-alibaba-2026-10.md；已验证我们的 AGENTS.md+三规则+技能路由方向同构，差距为流程流水线与 eval 自动化（可迁移清单见该文）。
- 285 Harness 落地（2026-10-07）：①ArchUnit 分层测试机械化（红线 #1，错误信息三要素）②caveman-review 三要素升级（问题/根因/修复）③verify-harness.cjs 一致性体检（ADR/CI/技能数/路径，首跑抓出流程族 30→32 漂移并已修）。来源 docs/research-harness-engineering-285-2026-10.md。
- 285 docs 结构化落地（2026-10-07）：docs 元信息头 65/65（add-doc-meta.cjs 按 git 时间批量补）；verify-harness 挂 CI 门禁（CI 12→13 job）；expert-reviewer 补三要素（每条 finding 带 FIX + 规则出处）；docs/plans + reference 两层已建。
- 流程断点审计（2026-10-07）：开发流程规范 7 处结构修复——流程路径分级（L0-L3↔十阶段）、小改动判据、.claude/agents 标注环境可用性（豆包用 expert-reviewer/verify-harness 替代）、wiki 选择映射、提交前验证矩阵、经验三级进化落点（docs/plans/patterns.md）、完成标准加 HANDOFF/环境审查。来源开发流程规范 §一/§四/§六-九。
- 路径引用漂移审计（2026-10-07）：storage.ts/api.ts 实为目录（src/services/storage/ 与 src/services/api/）、waters.ts 不存在（水源数据在 src/data/constants.ts），三处已修；verify-harness 路径检查纳入 src/backend 前缀 + .agents 路由表双向核对 + 各族 README 数 + status 值域。
- GitHub push（2026-10-07）：~/.ssh/config 走 ssh.github.com:443 可能被本地网络重置；用一次性 `$env:GIT_SSH_COMMAND="ssh -o HostName=github.com -o Port=22"` 走 22 端口，不动全局配置。

**2026-10-01 V4 重构**：ADR 拆 `docs/ADR/` 独立文件（ADR-001~009，统一格式）、CONTEXT.md 精简为术语+ADR 索引+架构关键词、新增 `npm run quality` 统一门禁、commit 改英文 conventional、新增 AI Change Protocol + Modification Level。详见 ADR-009。
