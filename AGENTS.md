# AGENTS.md — 一盏茶项目 AI 协作规则

> 给机器看的 README。仓库里所有 AI 编码助手（Codex、Claude Code、Cursor、Copilot、Gemini CLI 等）开工前必读。
> 本文件是活文档：AI 每次犯错写一行 lesson → `docs/plans/lessons.md`（按需文件，不常驻）；本文件只留规则与索引，每几周修剪一次。V4 重构见 ADR-009。

## 0. 不可妥协

1. **不奉承，不废话。** 禁止 "好的问题""你说得对""我很乐意" 这类开场白。直接给答案或行动。
2. **不同意就说。** 用户前提错了当面指出，再干活。为了礼貌附和错误前提，是编码助手最严重的失败模式。**反驳要量化**：给「把 X 改成 Y，代价是 Z」而不是「这样可能不太好」；说不出代价就先查再说。
3. **绝不编造。** 不编文件路径、commit 哈希、API 名、测试结果、库函数。不知道就读文件、跑命令、或说 "我查一下"。
4. **困惑就停。** 任务有两种合理解读且影响产出时，问。不许默默选一个往下做。**指令冲突透明化**：用户实时指令优先于预置技能/规则建议；若某规则使你不得不暂停、额外确认或无法完成用户要求，直接指出该规则的具体条款并说明原因，不静默卡住。
5. **只动必须动的。** 每一行改动都能追溯到用户请求。禁止顺手重构、顺手格式化、顺手清理。
6. **客观执行。** 结论以实测为准，不以记忆、推断、上一份交接为准。状态/数字/测试结果/文件存在性，先跑命令再下结论；无法实测的必须标注「**未复核断言**」，禁止当事实转抄。转抄他人结论前先复核（历史经验不是当前事实）。
7. **先拆解、再动手。** 遇到问题先拆成子问题（现状 → 根因 → 待验证项）再解；需求先过 `request-analysis`；跨模块/架构/不可逆任务先过 `plan-control`（见 §4 轨道），禁止未拆解直接开工。
8. **交付前自检。** 交付前拦五类：①伪阻断提问（能自查/自定却推给用户——可逆、只读、常规修复不必反复请求许可，先把能做的做完再问）；②半途交付（未完成却宣称完成，含把最高价值步包装成"可选/回头再说"）；③声明替代实测（「已检查/已验证」必须真跑过，整条消息含结尾总结都扫，不用声明豁免尾巴）；④**验证双向可靠**——报"有问题"前先证伪自己、报"全绿"前先证全覆盖（防假阳性/假阴性），结论不用含糊隐喻（"埋坑/翻车"改"未覆盖缺陷/验证未通过"，附触发条件+影响+根因）；⑤**禁埋语言后门**——产出的约束性文本（规则/技能/文档/注释）不得出现"为某目的而禁止某行为"（动机条件式，留开脱钩子）、预埋开脱钩子、伪装成正常陈述的逃逸口，禁止须锚定行为本身。

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
- **规则=全量常驻、技能=渐进按需加载**（token 分工红线，见 `.harness/rules/三层语义.md`）：禁止把技能内容抄回规则文件。
- 关键决策（新功能立项/方案评审）先用多角色质询（PM/架构师/UX/开发者/分析师各提一个反对意见）或深度批判四法（pre-mortem 默认首选）；方案含糊时先「决策树拷问」——把方案拆成决策分支，逐分支追问到收敛（每问附推荐答案，事实自查、决策由用户拍板），禁止带隐藏假设进编码。
- **架构克制（YAGNI）**：能插件化≠该插件化，能分布式≠该分布式，能上编排框架≠该上。选型从需求信号推，不从"主流/熟悉/现成"推；架构级选型必须写「选 A 理由 + 否 B 理由 + 反转条件」（双向论证，见 plan-control §9.1，症状对照表 §9.2）。本地实证：Graph 编排经四维甄别 0/4 被砍（ADR-018）。
- **写作风格（80% ASD-STE100，2026-10-06 融入）**：①每句一事实或一条指令，指令 ≤20 词、描述 ≤25 词；②主动语态，说清谁做什么；③同物同词——术语（契约字段/领域概念）定义一次后精确复用，禁换着叫；④先答案后细节（§0 已有，写解释时严格执行）；⑤步骤放编号列表，每段一个主题最多 6 句；⑥用用户的语言回答，句子简短；⑦流程/结构/架构超过 3 个部分时加 ASCII 图或引用架构图；⑧用户说"用 HTML 解释/做成网页"时，交付单文件交互式 HTML 页。评估与抽样流程见 `docs/agent-eval-baseline.md`。
- **面向用户可见文本**（`docs/promotion/` 传播文案 / README / 官网 / UI 文案）：写前读 `.harness/skills/main-dev/tea-voice`（`docs/promotion/posts.md` 是 tea 声音的唯一范本，其正反对照定义法与短句成段即标准）。
- **任务机制从最轻开始**（2026-10-16 融自 claude-code-best-practice 选择矩阵）：能直接答不用技能，技能够用不委派子代理，重机制（子代理/编排）仅在轻机制证明不足时启用。详见 `docs/research-claude-code-best-practice-2026-10.md`。

## 3. 架构边界

- 前端 `views → stores → services`；后端 `Controller → Service → Repository`（Controller 只做参数与响应）。详见 `docs/architecture/system-overview.md`。
- **AI 请求必须走后端代理 `/api/v1/ai/*`，禁止浏览器直连第三方 AI**；`teaAI.ts` 降级逻辑（网络不可用时规则回复）是承重墙，改动必须保留并回归。
- `src/components/three/` 只做视觉层，不改状态机（`3D_SPEC.md`）。
- IndexedDB 记录带 `sync_status`（pending/synced/failed），新增字段考虑同步逻辑；写入前 `toRaw` 去代理（防 DataCloneError）。
- 评分模型：品鉴结果 = 八维口感评分 × 冲泡工艺系数，保持可解释性（读 `tea-tasting`）。
- 品鉴卡分享：`share.ts` 纯函数 base64url，`/share` 只读页防御性校验（数据带版本字段，未知版本拒绝）。
- PWA：`vite-plugin-pwa` 已配置，改静态资源注意缓存策略；视频不本地化、离线降级静态图。
- 部署：Docker Compose 编排（backend/frontend/postgres/nginx），详见 `DEPLOY.md`（旧 Windows 原生脚本保留参考）。

## 4. 开发流程（AI Change Protocol）

所有 AI 修改必须按序走完，缺一步不算完成：

0. **开工自查**：先 `git log --oneline -10` 查目标功能是否已实现；已实现 → 补缺验证，禁止从零重写。
1. **分诊 + 拆解**（§0 第 7 条）：先判定轨道（下 §4.1），再把问题拆成子问题。复杂需求拆解格式固定为：**现状（实测）→ 根因 → 子问题清单 → 待验证项**。拆解未产出，禁止进入编码。
2. **理解上下文**——读相关文件 + 匹配技能 `SKILL.md` 后再动手。**技能匹配两类（先判哪类，再加载）**：①**流程驱动**——按当前阶段查 `.harness/skills/main-dev/README.md` 路由表（走到阶段 4 → coding-skill，阶段 5 → unit-test-write）；②**任务驱动**——按产出物性质触发，不看阶段（产出对外文字 → `tea-voice`；用户点名 caveman → `caveman-review`；要求架构体检 → `arch-deepen`）。两份总表：`.agents/skills/README.md`（66 个，通用+领域）+ 三族 README（流程族 39 个）。**README 不列 = 技能不存在**。
3. **需求分析**——新功能 / 需求变更 / 行为改动先过 `request-analysis`（F 编号 + Given-When-Then + 范围边界 + 影响分析）。轻量路径按 §4.1 合并。
4. **方案设计**——Controlled 轨道先过 `plan-control`（风险评分 + 方案 + 取舍 + 回滚 + Not Doing）；Guided 轨道出 Mini Plan。
5. **修改**——按 §5 纪律，只动必须动的。
6. **运行验证**——按 §11 命令入口，验证级别匹配改动级别（§5 Modification Level）。
7. **报告证据**——做了什么、跑了什么、结果如何，凭证据报完成。

禁止：不读文件直接改代码；直接新增依赖；直接改变架构；跳过验证宣称完成；未拆解直接开工。

### 4.1 任务轨道（分诊结果决定流程深度）

> 分诊规则与十阶段流水线的完整对照见 `.harness/rules/开发流程规范.md` §一（含 L0-L3 路径分级与小改动判据）。此处只定入口：

| 轨道 | 触发 | 流程 |
|---|---|---|
| **Fast** | 纯问答 / 明确步骤执行 / 单文件低风险可逆改动 | 理解 → 执行 → 验证 → 交付（跳过方案与需求文档） |
| **Guided** | 多文件 / 部分假设 / 影响可估 | Mini Plan（目标/步骤/影响/验证）→ 执行 → 验证 |
| **Controlled** | 架构选择 / 数据模型 / 不可逆 / 高风险 / 需求含糊 | 拆解 → 需求分析 → 完整方案（plan-control §9）→ 确认 → 执行 → 证据 → 评审 |

- 轨道由 **风险 + 置信度 + 复杂度** 决定，不由「感觉难不难」决定；打分带依据（plan-control §6）。
- 调研后发现评分不准 → **重新分诊并说明**，禁止硬走原轨道。
- 用户显式指令优先：说「直接做」就走 Fast；说「先出方案」就上 Controlled。

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

> 完整前端规范见 `.harness/rules/编码规范.md` §17-26（Vue 组件 / 类型安全 / 状态与数据流 / 路由 / 表单 / 样式与令牌 / 3D / 离线与性能 / 可访问性；红线 R11-R14 零容忍，含 3D 禁直建 renderer、统一 TresJS）。
> 设计令牌、组件规则、字体（自托管 + 禁 Google Fonts link）、图标（一个库一个家族）、浏览器表面定制（选区/滚动条/焦点环/光标）见 `DESIGN_SPEC.md`；3D 约束见 `3D_SPEC.md`。**本节只列入口独有的门禁**；引入第三方库/图标前先查 `package.json`，禁重复引入。

- **设计门禁（强制 6 步）**：⓪**先定轨道**（品牌物料轨：应用 UI / 图标 / 海报，全禁衬线；编辑出版轨：传播长文 / 文档 / 画册，长文允许衬线）——轨道定了才选风格，顺序不可颠倒（2026-10-10 融入，源自 design-aesthetics-book 轨道层）→ ① Design Read（页面类型/受众/vibe/倾向体系 + 三拨盘 8/6/4，未输出禁止写码）→ ② 视觉方向（一句话 + 4-6 色令牌 + 字体角色）→ ③ 对照简报评审 → ④ 实现（调用 taste-skill / ui-ux-pro-max / frontend-design / impeccable，禁模板手感）→ ⑤ critique（层级/清晰/情感）→ ⑥ audit + 设计审计 9 条，未过审计不得提交。完整规范见全局技能 `frontend-design-spec`。
- 设计禁令速查：AI 紫渐变 / 暖米白+陶土 / 纯黑灰（要 tint）/ Tailwind 默认色板 / Inter 与衬线体默认 / Fraunces·Instrument_Serif / eyebrow 眉题 / Hero+三卡片 / Emoji 当图标 / 玻璃拟态装饰 / 渐变文字 / bounce·elastic 动效 / 每节同款入场 / 「提交」式按钮文案，一律禁止。

## 7. 后端规范

> 完整编码规范（分层/异常/对象模型/事务/数据访问/线程/安全/AI 集成）见 `.harness/rules/编码规范.md`（15 条红线零容忍），此处只列要点。

- 后端重写为 Spring Boot 3.5 + Spring Data JPA + Spring AI Alibaba（**新代码按此规范；旧 FastAPI 代码仅维护，不新增功能**）。
- 分层 `Controller → Service → Repository` 单向依赖；Controller 只做参数与响应，不写业务逻辑、不写数据库查询。分层规则已机械化：`backend/src/test/java/com/tea/architecture/LayerDependencyTest.java`（ArchUnit，CI Maven test 门禁）。
- 错误统一 `ApiResponse<T>` + `{code, message}`：Service 抛 BusinessException 子类（BadRequest/Unauthorized/NotFound/Conflict/Gateway/QuotaExceeded）。
- 认证：Spring Security + JWT；需登录接口加鉴权；密码哈希用 BCrypt。
- 事务：写方法 `@Transactional(rollbackFor = Exception.class)`，只读 `readOnly = true`；禁事务内远程调用。

## 8. 数据规范

- **绝对禁止直接改模型不生成迁移**。改库前先读 `.harness/rules/编码规范.md` 数据库规范；**新 Spring Boot 库改动走 `.harness/skills/biz-dev/09-db-migration`（Flyway）；过渡期旧 FastAPI 后端改动走 `.agents/skills/db-migration`（Alembic），新栈优先**。
- 流程（后端重写后为 Flyway）：改模型 → 写迁移脚本（`db-migrations.sql` + `rollback.sql` 成对）→ 真实 Postgres 验证 → upgrade → 迁移测试（upgrade/downgrade 往返）。
- 数据迁移要写迁移逻辑，不能只改表结构。
- 茶文化数据：茶叶分类按六大茶类，冲泡参数符合茶类常识（`tea-tasting` 基准表）；不编造茶名/茶器/历史人物，不确定标 "待核实"；优先用 `src/data/` 已有数据。

## 9. 测试规范

- 新功能/修 bug 必须带测试；TDD 优先（先写失败测试 → 最小实现 → 重构）。
- **按需测试（不过度工程）**：可逆、影响小的改动不写仅复刻实现逻辑的无意义测试；只跑与改动相称的验证，通过后不无休止扩大/重复测试范围，直接推进交付（除非出现新变更或失败）。
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
- **临时产物放自己的子目录**：`.tmp/<会话标识>-<日期时分>/`（如 `.tmp/lead-1017-1545/`）。`<会话标识>` 单独不唯一——2026-10-17 实测两个会话都往 `.tmp/lead/` 写，必须带时间或 ID 后缀。清理只删本会话目录，禁 `Remove-Item .tmp -Recurse` / `Get-ChildItem .tmp | Remove-Item` 这类整目录清空（`.tmp` 在 `.gitignore` 内，误删无恢复路径）。
- 技能返回 "不支持某能力" 时，先判断通用工具能否补齐（yt-dlp/PyAV/自写脚本），只有真实失败（403/风控/需登录/付费墙）才回报限制。
- 上线前自查三项：健壮性（友好错误+输入校验）、安全性（防越权）、稳定性（失败重试/容错）；尽量周二~周四上线；上线后跑完整回归重点测权限，观察至少一周。
- **Git commit**：英文 conventional commits `type(scope): desc`（feat/fix/refactor/perf/test/docs/chore/style），subject ≤ 72 字符，body 讲 why；缺陷修复与功能/测试分开提交；`main` 稳定，新功能 `feature/xxx`，修 bug `fix/xxx`。**AI 提交标记（K20，2026-10-13 起）**：AI 代理提交 subject 前加 `[ai]` 前缀（如 `[ai] docs(plans): ...`），供 `scripts/measure-ai-commits.cjs` 度量占比。

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
node scripts/eval-harness.cjs <切片> [--verify]  # harness 七维确定性评测（每切片必跑，总分<60 阻断；不传 --verify 则代码正确性维记 0 分；报告 docs/agent-eval/）
node scripts/verify-harness.cjs    # harness 一致性体检（ADR/CI job/技能数/路径/wiki 四件套/子代理/审查页/changes 门禁），期望 ERRORS: []，CI 门禁
node scripts/audit-redlines.cjs    # 红线机械化审计（替代 red-line-auditor；R2/7/8/9/10/11/12/14），期望 ERRORS: []，CI 门禁
node scripts/audit-wiki-drift.cjs  # wiki 契约漂移审计（替代 consistency-verifier；api-contract 端点 vs 代码路由双向核对），期望 ERRORS: []，CI 门禁
node scripts/add-doc-meta.cjs      # docs 元信息头批量补齐（新文档缺 frontmatter 时跑）
node scripts/audit-context-budget.cjs  # 常驻上下文预算体检（估算 token；超预算即 error，防 AGENTS.md / 规则层重新膨胀），期望 ERRORS: []
cd backend && python -m py_compile main.py                  # 后端语法（旧 FastAPI，过渡期；main.py 在 backend/ 根）
cd backend && .\.venv\Scripts\python.exe -m pytest tests -q     # 后端全量（旧 FastAPI，过渡期）
# 后端重写完成后替换为：cd backend && mvn -q test              # 后端全量（Spring Boot）
```

部署（Docker Compose 编排，后端重写后启用）：全流程见 `DEPLOY.md`；旧 Windows 原生脚本（`scripts/deploy-backend.ps1` / `update-backend.ps1` / `install-windows-service.ps1` / `backup-postgres.ps1`）保留参考。依赖双锁定：前端 `package-lock.json`；后端重写后 `pom.xml` + lock 管理。

## 12. 文档索引

- `.agents/skills/*/SKILL.md` — 匹配到的技能必须先 Read 再执行
- `.agents/skills/README.md` — 技能路由总表（66 个，按族分组，任务启动先读）
- `.harness/rules/技能规范.md` — 技能治理唯一权威（模板/触发式描述/路由表维护，§5 增删改流程）
- `docs/skills/` — 核心技能人读审查页（plan-control / tea-tasting / db-migration / fastapi-endpoint / vue-component / caveman-review / quality-audit / arch-deepen / session-handoff / tea-voice / retro / pr-body / 00-bug-diagnose，面向人核对）
- `CONTEXT.md` — 术语 + ADR 索引 + 架构关键词（必读）
- `docs/ADR/` — 架构决策记录（ADR-001~022；新决策写 ADR-0XX.md，禁止塞进 CONTEXT.md）
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
- `.harness/rules/三层语义.md` — 规则/技能/工具三层语义与 token 分工红线（Rule 全量常驻 / Skill 按需加载 / Tool 不参与推理）
- `docs/plans/lessons.md` — lesson 池（踩坑 / 精读 / 落地记录，按需加载；§13 新条目写这里）
- `docs/token-optimization-guide.md` — 通用 token 优化方案（控制层 / 模板 / 度量 / 流行技巧审查）
- `.harness/wiki/` — AI 编码上下文四件套（业务模型 / 接口协议 / 数据模型 / 领域术语），编码前按需读 ≤3 份
- `.harness/changes/_template/` — 变更追踪模板（summary + db-migrations + rollback），与 git 分支同名
- `.claude/agents/` — 三子代理（code-reviewer / consistency-verifier / red-line-auditor；Claude Code 专用。豆包环境等效：expert-reviewer / audit-wiki-drift.cjs + verify-harness.cjs / audit-redlines.cjs，见开发流程规范 §子代理）
- `.harness/skills/` — 技能全套 39 个（main-dev 14 / biz-dev 19 / trouble-shooting 6），每族带 README 路由表，按需渐进式加载（request-analysis 规则 + Wiki ≤3、coding-skill ≤4）
- `.github/workflows/ci.yml` — CI 合并门禁（含 compose-validate / harness 一致性）
- `docs/agent-eval-baseline.md` — AI 协作评估基线（通用+专项维度、抽样会话评分流程、评估证据沉淀）

禁止只凭文件名或经验猜实现；没找到依据就明说 "不确定 / 未找到"。

## 13. 更新记录

**维护规则**：保持短（超 500 行就是在跟自己打架，200-350 行最舒服）；只留救过命的规则（问 "删掉这行会让 AI 犯错吗？" 不会就删）；命令必须真实（从 package.json/scripts 抄）；写规则不写建议（给 "禁止 X" 不给 "建议用 X"）；AI 每次犯错写一行进 `docs/plans/lessons.md`（本文件只收晋升后的规则），已有规则覆盖就收紧，不重复。**经验三级进化（2026-10-07）**：踩坑先写 lesson（单次记录）→ 跨项目复现归纳 pattern → 验证后晋升 instinct 自动生效；每级晋升需人工确认，防错误经验扩散。**晋升门槛（2026-10-10 收紧）**：晋升须附 **≥3 条真实可查证据**（真实日志/commit/文件，日期真实存在），证据不足只标「候选·证据不足」，禁止写成规则；**改技能/规则名或路径前先 grep 记忆层+技能层+任务层+文档层四处引用并同步**，防断链。**静默失效警觉（2026-10-10）**：治理类问题（规则漂移/技能断链/文档过期/引用失效）**当场不报错，几周后才显形**——所以「本次没发现问题」≠「没问题」，须靠确定性脚本（verify-harness 等）定期体检而非凭印象；指标取不到时报「未测」，禁按 0 计（把「没测到」读成「正常」是本机制最致命的失败模式）。**写入五问（写新条目/规则前自问，防膨胀）**：①与已有条目同主题？→合并更新不新增；②新说法覆盖旧说法？→替换不并存；③操作细节/命令/路径？→进技能不进规则；④临时状态/进行中？→不写（用会话/任务清单）；⑤核心偏好/身份？→画像层，环境事实→记忆层。**防膨胀护栏**：压缩稿须 <95% 原文（否则是"压缩后变大"），备份先行保留 14 天，单次降幅 ≤40%，**达标即停**（降到目标即止，不做超额治理）。**修剪（执行路径）**：lesson 进 `docs/plans/lessons.md`（按需池，不常驻），跨场景复现的进 `docs/plans/patterns.md`（pattern 池，见开发流程规范 §八），晋升后的约束写回本文件；本文件只留规则与索引。**迁移 ≠ 压缩**：整段外置到按需文件（内容零改动）不算压降，只须备份 + 引用同步；降幅护栏针对「同文件内删除/改写」。

**学习记录（近况沉淀）**：lesson 池已外置 → `docs/plans/lessons.md`（研究精读 / 落地记录 / 历史决策原文，**按需加载，不常驻**）。**新增 lesson 写进该文件，不写回本文件**；写入前过「写入五问」，晋升按下方门槛。
**仍具约束力的条目（常驻保留，勿迁走）**：
- 冲泡页零点击闭环：煮水→温杯→醒茶→出汤全自动，仅 READY 拖一次注水；禁止为温杯/醒茶/出汤加回手动确认按钮。
- 新功能立项先过四维甄别（自由/用户/竞品/伪需求）；"团队自己会不会用" 是硬门槛，伪需求优先降级或砍。
- 技能规范：新增/修改/删除技能必须按 `.harness/rules/技能规范.md`（frontmatter 必填、触发式描述、name=目录名、README 路由表同步；README 不列 = 不存在）。
- 需求分析先行：批 B 及后续切片必须先产出需求文档（范围边界/做什么与不做什么/F-编号 + Given-When-Then 验收/影响分析）并经用户确认，才进方案设计；禁止跳过需求分析直接写方案（2026-10-06 沉淀）。
- 治理文档须与实现同步：改 CI job 数、ADR 编号、技能数量、代理位置后立即更新 AGENTS.md + 对应规则文档；发现漂移当场修，不遗留（2026-10-07 沉淀：一次修 6 处）。
- **main 分支保护规则 = 只走 PR，禁直接 push main**（2026-10-09，用户拍板）：远端 main 设了「Changes must be made through a pull request」保护。本次 4 commit 直接 push 是 bypass（已确认接受现状），此后新改动一律 `feature/xxx` 或 `fix/xxx` 分支 → push 远端 → 开 PR → CI 全绿 → 合并。**禁再 bypass 直推 main**（force-push main 是红线，同禁）。
- **裸编号跨文档复用会造成实质误工**（2026-10-10）：`P0-3` 在三份文档指三个事项——`docs/PLAN-harness-research-2026-10.md` = 前端返工、`docs/TODO-PRIORITY.md`（deprecated）= AI key、`docs/OPTIMIZATION_PLAN.md` = PWA prompt。交接转述的「P0-3 前端返工验收」若被按 AI key 理解，会去做已完成的事。铁律：**编号不跨文档裸用**，引用时带文档前缀；消歧只在各文档就地加警示，**不做全库重编号**（会毁掉历史引用）。已在本会话修（2026-10-10 沉淀）。

