# 「一盏茶」V3 路线图（V3_ROADMAP）

> 对齐现状的开发指令基线：保留 V2 方法、对齐事实、修正违规、纳入深化、精而不滥。
> 创建：2026-09-10。取代 `V2_UPGRADE.md` 作为开发指令；`V2_UPGRADE.md` 原文件保留供对照，不删不改。
> 事实来源：代码与 `src/data/` 实核、`package.json`、`src/assets/SOURCES.md`、git log、AGENTS.md。未核实的数字一律标注"待核实"，不得写死。

---

## 1 现状基线

### 1.1 技术栈全景（来源：package.json 实测）

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Vue 3.5 + TypeScript + Pinia 4 + Vue Router 5 | Composition API + `<script setup lang="ts">` |
| 构建 | Vite 8 + Tailwind 4（@tailwindcss/vite） | 无自定义 CSS 文件 |
| 3D | Three.js 0.185 + TresJS 5.8（@tresjs/core + @tresjs/cientos） | 3D 茶空间视觉层 |
| 数据 | Dexie 4（IndexedDB 离线优先）+ Pinia | 统一走 `src/services/storage.ts` |
| 图表 | ECharts 6 + Chart.js 4（vue-chartjs） | 品鉴雷达图等 |
| 特效 | @tsparticles（bubbles/fire）+ canvas-confetti + howler | 冲泡粒子、音效 |
| 图标 | lucide-vue-next | 已全量替换 emoji（commit db95e0c） |
| 分享 | qrcode + base64url（src/services/share.ts） | 品鉴卡分享 |
| PWA | vite-plugin-pwa | 离线优先，静态资源注意缓存策略 |
| 后端 | FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL + Pydantic v2 | 入口 `backend/main.py`，路由在 `backend/app/routers/` |
| 部署 | Docker Compose + Nginx + GitHub Pages Demo | `docker-compose.yml`、`nginx.conf` |
| 测试 | Vitest（67 用例）+ fake-indexeddb + Playwright + pytest + Alembic 迁移测试 | CI 7 job 合并门禁 |

### 1.2 已完成功能盘点（来源：src/views 19 个视图、src/components/three 15 个组件、git log）

按业务闭环组织：入席 → 选茶 → 备器 → 煮水 → 冲泡 → 品鉴记录 → 个人成长。

| 环节 | 落点 | 现状 |
|---|---|---|
| 入席 | HomeView | 茶山雾景 Hero 视频（Pexels 38238683，远程加载，离线降级静态图）+ 入席入口 |
| 选茶 | SelectView + TeaDetailView | 49 款茶（src/data/teas.ts），含详情页 |
| 备器 | ToolSelect + CollectionView | 6 款茶器（src/data/teawares.ts），解锁与收藏 |
| 煮水/冲泡 | BrewView + 3D 冲泡场景 | TeaBrewScene3D / TeaBrewSceneInner 已上线，tsparticles 冲泡粒子 |
| 品鉴 | TasteView + TeaSynesthesiaView | 八维口感评分 × 冲泡工艺系数；茶通感（六境）视图 |
| 记录 | HistoryView | 品鉴历史日志 |
| 成长 | AIAsk + TeaGraph + TeaBreak + HealthView | AI 茶灵（teaAI.ts，网络不可用降级规则回复）；茶图谱（22 位茶人 src/data/teaMasters.ts）；茶歇；茶与健康 |
| 空间 | TeaRoom + GardenView + MapView | 3D 茶室；3D 茶园四产区（src/data/gardenRegions.ts：hangzhou/wuyishan/yunnan/fuding），含地形、成垄茶行、茶亭、竹篱笆、石块小径、天气（云/晨雾/雨天）、动物、环境音、浇水/采摘交互、后端同步（commit 系列：cc94a96→1456187→ecec561→4a87ed1→a1326ac→8980996→0dae836→33b4ae6）；产区地图（MapView + src/data/china-map.json + teaRegions.ts 52 条） |
| 分享 | ShareView | 品鉴卡只读页，base64url 编解码 + 防御性校验，qrcode 生成 |
| 用户 | LoginView + 后端 /api/auth | 登录，需登录接口依赖 get_current_user |
| 节气 | src/data/solarTerms.ts | 24 节气数据 |
| 茶室主题 | src/data/themes.ts | 宋式茶室 / 明式茶室 / 山林茶舍 3 套主题 |

其他已完成：
- 真实素材接入：29 张 Pexels 可商用照片（commit f3b5023），见第 6 章
- Hero 茶山雾景视频接入（commit c0f1eb7，三级降级）
- 全项目 emoji 替换为 lucide 图标（commit db95e0c），配套扫描脚本 scripts/scan-emoji.cjs、scripts/verify-icons.cjs
- TresJS 渲染配置修复（commit a8a8d35，vite.config 接入 template-compiler-options）
- 茶亭叙事锚点 + 设计审计（commit 33b4ae6）

### 1.3 数据资产（来源：src/data/ 实核）

| 文件 | 数量 | 说明 |
|---|---|---|
| teas.ts | 49 款 | 六大茶类 |
| teawares.ts | 6 款 | 茶器 |
| teaMasters.ts | 22 位 | 茶人 |
| gardenRegions.ts | 4 产区 | hangzhou / wuyishan / yunnan / fuding |
| solarTerms.ts | 24 节气 | 节气数据 |
| teaRegions.ts | 52 条 | 产区数据 |
| themes.ts | 3 套 | 茶室主题 |
| china-map.json | 1 份 | 产区地图底图 |

### 1.4 阶段进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| 一 | 打磨展示 | 完成 |
| 二 | 自动化测试 | 完成 |
| 三 | 分享品鉴卡 | 完成 |
| 四 | AI 代理 | 完成 |
| 五 | GitHub 专业度 | 完成 |
| 六 | 简历 | 暂缓（用户明确不做，见 7.4） |
| — | 视觉升级（3D 茶席 / 泡茶动画 / 产区地图 / 晨雾茶山） | 推进中，收尾见 7.1 P0 |

---

## 2 定位与旅程

### 2.1 产品定位（保留自 V2）

> 东方数字茶空间 —— 不是泡茶工具，而是一座数字茶室。
> Slogan：一席茶，一方天地，一念清心。

### 2.2 用户旅程八步（保留 V2 叙事，标注实现状态）

| 环节 | 落点 | 状态 |
|---|---|---|
| 入境 | HomeView（Hero 茶山雾景） | 已实现 |
| 识茶 | SelectView + TeaDetailView（49 茶） | 已实现 |
| 备器 | ToolSelect（6 器） | 已实现 |
| 烹水 | BrewView（水温/水类型） | 已实现 |
| 冲泡 | BrewView + TeaBrewScene3D | 已实现，动画完成度待 P0 过检（见 7.1-P0-1） |
| 品鉴 | TasteView（八维 × 工艺系数） | 已实现 |
| 收藏 | CollectionView + HistoryView | 已实现 |
| 修习茶道 | AIAsk / TeaGraph / TeaSynesthesia / 节气 / TeaBreak | 已实现，深度扩展属 P1（见 7.2） |

---

## 3 真实差距表

> 规则：每个"待做"必须有验收标准（测试 / 截图 / 指标），没有验收的不进表。
> 优先级：P0 当前 / P1 深化 / P2 远期。

| 维度 | 现状（真实） | 待做 | 优先级 | 验收标准 |
|---|---|---|---|---|
| 首页沉浸 | Hero 视频 + 入席，三级降级 | 视频层在真实浏览器的 autoplay + preload 行为验证收尾 | P0 | Playwright 截图确认视频渲染；离线/拦截时静态图降级生效 |
| 视觉升级 | 3D 茶席/茶园已多轮迭代；泡茶动画、产区地图、晨雾茶山已有落点 | 按设计审计清单逐页过检，修到"认不出模板/AI" | P0 | `node scripts/verify-gardens.cjs` 期望 ERRORS: []；改前/改后截图对比；设计审计清单全过（第 4 章） |
| 设计令牌 | AGENTS.md 已立禁令与色板（4.2） | 全局一致性检查：色令牌、字体角色、浏览器表面定制 | P0 | `node scripts/scan-emoji.cjs` 零命中；逐页截图对比令牌；正文对比度 ≥ 4.5:1 |
| 素材 | 29 张可商用图 + 1 视频已落地（第 6 章） | 通用图覆盖的茶补专图；SOURCES.md 归并规则随数据同步维护 | P1 | 每张新图登记 SOURCES.md 且 ≤ 体积上限；抽查归并关系与 teas.ts 一致 |
| 茶文化深度 | 49 茶/22 茶人/24 节气数据齐；冲泡参数在茶类常识范围内 | 产区风土叙事入茶详情；冲泡参数对照 tea-tasting 基准表校验 | P1 | 抽样 10 款茶参数与 tea-tasting 基准表一致，不一致修复并标来源；无"待核实"悬空 |
| 测试覆盖 | 67 Vitest + Playwright + verify-* 脚本群 | 视觉收尾的每次改动补截图验证；素材/分享链路 E2E | P1 | 改动提交前跑对应 verify 脚本；分享卡 E2E 覆盖编码/解码/非法输入 |
| 社交 | 分享卡已实现 | 好友茶空间 / 点赞评论（增量） | P2 | E2E 覆盖核心交互；设计门禁链走完 |
| 云端 | LoginView + 后端 /api/auth + IndexedDB sync_status 同步基础 | 品鉴记录云同步增强 | P2 | pytest 全量过；同步往返（pending→synced/failed）测试 |
| 阶段六（简历） | 用户明确不做 | 不做，标注暂缓 | 暂缓 | 不立项，文档不进入开发计划 |

---

## 4 设计规范（对齐 AGENTS.md，规则原文优先，不自行改）

### 4.1 设计流程门禁链（强制 6 步，缺一步不算完成）

1. Design Read（门禁 1）：页面类型 / 受众 / vibe / 倾向体系 + 三拨盘（VARIANCE / MOTION / DENSITY，基线 8/6/4）。未输出 = 任务未开始，禁止写任何代码（含临时草稿）。
2. 视觉方向（门禁 2）：一两句话 + 4-6 色令牌 + 字体角色。方向未定不得进入实现。
3. 对照简报评审：像"任何项目都能用的默认"就改；简报优先。
4. 实现：调用匹配技能（taste-skill / ui-ux-pro-max / frontend-design / impeccable / Aceternity 品质线），禁止普通模板手感。
5. 评审 critique：层级 / 清晰 / 情感三维，发现偏离立即修正。
6. 审计 audit + 设计审计：a11y / 性能 / 响应式 + 审计清单；未过审计不得提交。

### 4.2 视觉方向：东方茶色体系（色令牌 + 字体角色）

> 色令牌以 DESIGN_SPEC V1.0 + 代码 @theme（src/assets/main.css）实际值为准。
> 修正记录：2026-09-10 审计发现 V3_PLAN 速查的"晨雾茶山"色值（#F5F1E6 / #0F1A14 / #C9A96E / #A5C9A0 / #8D6E63）无项目文档与代码落地，已剔除；
> "晨雾茶山"仅保留为视觉升级的方向描述（AGENTS.md 用语），不代表独立色板。

| 令牌 | 色值 | CSS 变量 / 角色 |
|---|---|---|
| 宣纸白 | #FAF6F0 | --color-cream，页面底色 |
| 纸色 | #F5F0E8 | --color-paper，卡片背景 |
| 墨色字 | #3D3225 | --color-ink，正文 |
| 木色 | #5D4E37 | --color-wood，按钮/标题 |
| 木色浅 | #7E6A55 | --color-wood-light，次要文字（2026-09-10 调深，对比度 4.78/4.54 达标） |
| 茶汤金 | #9E8050 | --color-tea-gold，强调色（一页一个强调色，全页锁定） |
| 竹青 | #6B7D5A | 自然相关（DESIGN_SPEC，无 CSS 变量） |
| 朱砂 | #A33B2E | 印章/成就（DESIGN_SPEC，无 CSS 变量） |
| 黛青 | #36454F | AI 茶灵（DESIGN_SPEC，无 CSS 变量） |

字体角色：Noto Serif SC 同族（标题与正文同一家族，禁混插异族字体）；标题内强调用同字体斜体/粗体，禁默认衬线体（Fraunces / Instrument_Serif 直接禁）。

### 4.3 禁令速查（完整版见 AGENTS.md §8）

- 配色：AI 紫渐变、暖米白 + 陶土、纯黑灰（要 tint）、Tailwind 默认色板。
- 字体：Inter / 系统栈禁默认；衬线体禁默认。
- 布局：Hero + 三卡片；完美居中；等宽多栏；眉题 eyebrow 绝对禁；01/02/03 编号除非真序列。
- 组件：卡片套卡片；玻璃拟态装饰；渐变文字；彩色侧边条；Emoji 当图标；等宽当戏服；几何蒙版抠图。
- 动效：每节同款入场禁；bounce / elastic 禁；悬停动图禁；一个编排时刻；尊重 prefers-reduced-motion。
- 文案：空话 / Lorem Ipsum / 被动语态 / 错误道歉禁；错误说清问题 + 恢复方式；按钮写动作不写"提交"。

### 4.4 组件与质量底线

- 组件 ≤ 200 行，超了拆；Props/Emits 必须带类型；副作用在 onMounted/onUnmounted 管理。
- 触控目标 ≥ 44px；状态五态齐全（hover / disabled / loading / error / empty）。
- 正文/占位对比度 ≥ 4.5:1；正文度量 65-75ch；display ≤ 6rem；阴影带偏移 + 软模糊。
- 浏览器表面定制：选区、滚动条、焦点环、光标上主题色。
- 全屏 Hero 禁 h-screen，用 min-h-[100dvh]；复杂布局用 Grid。
- 字体自托管（@font-face + swap），生产禁 `<link>` 引 Google Fonts。
- 新组件/效果先读 Aceternity 组件目录挑模式，在 Vue + Tailwind 4 + TresJS 里复刻，引用标注灵感来源。

### 4.5 验收口径

一眼认不出是模板，也认不出是 AI 生成的。去掉 logo 还能认出是"一盏茶"。

---

## 5 工程规范（对齐 AGENTS.md）

### 5.1 AI 硬约束

- AI 请求必须走后端代理 `/api/ai/*`，禁止浏览器直连第三方 AI。
- teaAI.ts 有降级逻辑（网络不可用时的规则回复），修改必须保留。

### 5.2 验证基线（命令真实来自 package.json 与 scripts/ 实测）

改完代码必跑（最小门槛 type-check 起底，提交前跑完整基线）：

```
npm run type-check   # 类型检查（最小门槛）
npm run test         # Vitest 单测（改了逻辑/store/service，当前 67 用例）
npm run build        # 生产构建（含类型检查）
npm run test:e2e     # Playwright E2E（改了流程/路由）
node scripts/verify-gardens.cjs   # 3D 茶园四园晴雨截图验证，期望 ERRORS: []
node scripts/verify-pavilion.cjs  # 茶亭验证
node scripts/scan-emoji.cjs       # 禁 emoji 扫描
node scripts/verify-icons.cjs     # lucide 图标渲染审计
cd backend && python -m py_compile app/main.py   # 后端语法
cd backend && .\.venv\Scripts\python.exe -m pytest tests -q   # 后端全量
```

提交前默认跑：`npm run build` + `npm run test` + 后端 pytest。

### 5.3 提交规范

- Commit 中文，格式 `类型: 简要描述`（feat/fix/refactor/docs/chore/style），subject ≤ 72 字符，body 讲 why。
- 缺陷修复与功能/测试分开提交；新功能/修 bug 必须带测试（TDD 优先）。
- 不提交 `node_modules/`、`dist/`、`.env`、`__pycache__/`、`.venv/`、`test-results/`、`playwright-report/`。
- `main` 稳定，新功能 `feature/xxx`，修 bug `fix/xxx`；不 push main、禁 force-push main。

### 5.4 评分口径

品鉴结果 = 八维口感评分 × 冲泡工艺系数，保持可解释性。任何评分改动不得破坏该公式与可解释性。

### 5.5 数据库约定

- 绝对禁止直接改模型不生成迁移。改库前先读 `.agents/skills/db-migration/SKILL.md`。
- 流程：改模型 → `alembic revision --autogenerate` → 人工审核脚本 → `alembic upgrade head` → 跑迁移测试（upgrade/downgrade 往返）。
- 密码哈希 passlib [bcrypt]，bcrypt 必须锁定 `==4.0.1`（5.0 与 passlib 1.7.4 不兼容）。

### 5.6 3D 与离线约定

- `src/components/three/` 只做视觉层，不改状态机；见 `3D_SPEC.md`。
- IndexedDB 记录有 `sync_status`（pending/synced/failed），新增字段考虑同步逻辑；写入前 `toRaw` 去代理（防 DataCloneError）。
- 品鉴卡分享：`share.ts` 纯函数 base64url 编解码，`/share` 只读页，数据经 URL 传输必须防御性校验。
- PWA：改静态资源注意缓存策略。

---

## 6 真实素材专项

### 6.1 已落地清单（来源：src/assets/SOURCES.md + 文件实核，全部 Pexels License 可商用）

| 类别 | 数量 | 位置 | 说明 |
|---|---|---|---|
| 茶叶照片 | 21 张 | `src/assets/teas/` | 覆盖 49 款茶，按茶类归并共享（见 6.3） |
| 茶器照片 | 4 张 | `src/assets/wares/` | gaiwan / zisha / glass / jianzhan，对应 6 款茶器 |
| 产区实景 | 4 张 | `public/garden/` | hangzhou / wuyishan / yunnan / fuding，对应 gardenRegions.ts |
| Hero 视频 | 1 个 | 远程 URL（Pexels 38238683） | 11s / 720p，首页 Hero 背景，离线降级 `tea-mountain-hero.jpg` |

### 6.2 版权与体积约束（新增素材必须遵守）

- 只使用 Pexels License 素材（免费可商用、可修改、无需署名），每张必须登记 SOURCES.md（来源 URL + 授权 + 作者）。
- 图片本地化并压缩：茶/器最长边 800px、单张 ≤ 80KB；产区图最长边 ≤ 1600px、单张 ≤ 150KB；新图必须过 `node scripts/compress-assets.cjs`。
- 视频不本地化、不进入 PWA 缓存；直链加载失败/离线时首页 Hero 自动降级为静态图。

### 6.3 归并共享规则（防"张冠李戴"，随数据同步维护）

- 绿色系 8 张（longjing/biluochun/huangshanmaofeng/xinyangmaojian/taipinghoukui/anji + 2 通用图），六安瓜片/蒙顶甘露/恩施玉露/婺源绿茶/顾渚紫笋/阳羡雪芽共享通用图。
- 白茶 2 张（yinzhen/baimudan 均为通用图，无白牡丹/寿眉专图）。
- 黄茶 1 张（junshan 通用图，无君山银针专图）。
- 乌龙 2 张（Pexels 仅 2 张乌龙专图；武夷岩茶系 7 款、铁观音、凤凰单丛、台湾乌龙按产区归并共享）。
- 红茶 4 张（qimen/jinjunmei/dianhong + 1 通用图，英德/宁红/川红共享通用图）。
- 黑茶 4 张（shengpu/shoupu/liubao/fuzhuan，普洱饼/紧压茶形态通用）。
- 产区：hangzhou 为杭州龙井茶园专图；wuyishan/yunnan/fuding 用同类茶园实景代替。

### 6.4 缺口与待办

| 缺口 | 状态 | 处理 |
|---|---|---|
| Hero 视频层最终 Playwright 截图验收 | Organizer 任务遗留（o_000191zvXWa，90%） | P0-2 收尾，见 7.1 |
| 通用图覆盖的茶补专图 | 已标注 SOURCES.md 文末 | P1 逐款补 Pexels 专图，每张登记 + 过体积上限 |
| 图片加载失败兜底（占位/背景色） | 现状待核实 | P0-2 一并核查并补齐 |

---

## 7 精深化路线图

> 原则：功能不在多在于精。P0 只做打磨与收尾，不新增功能；P1 深化已有功能；P2 远期增量。每项带验收标准。

### 7.1 P0 打磨（当前，做完再进 P1）

| 项 | 目标 | 验收标准 |
|---|---|---|
| P0-1 视觉升级收尾 | 3D 茶席 / 泡茶动画 / 产区地图 / 晨雾茶山按设计审计清单逐页过检，修到验收口径（4.5） | `node scripts/verify-gardens.cjs` ERRORS: []；每处改动改前/改后截图对比；设计审计清单全过 |
| P0-2 素材收尾 | Hero 视频层截图验收；图片加载失败兜底核查补齐 | Playwright 截图确认视频渲染、离线/拦截时降级静态图正常；图片加载失败有兜底（占位图或背景色），无破图 |
| P0-3 设计令牌落地 | 色令牌/字体角色全局一致性检查（DESIGN_SPEC + @theme，见 4.2） | `node scripts/scan-emoji.cjs` 零命中；逐页截图对比色令牌；正文对比度 ≥ 4.5:1；浏览器表面定制（选区/滚动条/焦点环） |

### 7.2 P1 深化（已有功能的深度，不新增页面）

| 项 | 目标 | 验收标准 |
|---|---|---|
| P1-1 茶文化深度 | 产区风土叙事入茶详情；冲泡参数对照 tea-tasting 基准表校验 | 抽样 10 款茶参数与基准表一致，不一致修复并标来源；无"待核实"悬空 |
| P1-2 素材补专图 | 通用图覆盖的茶逐款补 Pexels 专图 | 每张登记 SOURCES.md、过 compress-assets 体积上限；归并规则与 teas.ts 一致 |
| P1-3 六境/节气深度 | 茶通感六境与 24 节气内容深化（数据与叙事层） | 数据无编造（标来源）；页面按门禁链走完；截图对比 |
| P1-4 测试补强 | 分享链路 E2E；视觉组件回归脚本 | 分享卡编码/解码/非法输入 E2E 通过；verify-* 脚本群纳入提交前基线 |

### 7.3 P2 远期（增量，不作为当前主线）

| 项 | 目标 | 验收标准 |
|---|---|---|
| P2-1 社交增量 | 好友茶空间 / 点赞评论（分享卡已实现，此为增量） | E2E 覆盖核心交互；设计门禁链走完 |
| P2-2 云端同步增强 | 品鉴记录云同步（LoginView + /api/auth + sync_status 已有基础） | pytest 全量过；同步往返（pending→synced/failed）测试 |

### 7.4 不做清单（防范围蔓延，每项可追溯到用户决定或 AGENTS.md）

- 阶段六简历：用户明确不做，暂缓，不进入开发计划。
- 会员商城 / 商业化：V2 旧构想，当前不做。
- 社交社区当主线：仅 P2 增量，不做社区生态。
- APP 实现：Web 优先，架构预留，不开发客户端。
- 新增页面：除非业务闭环需要（入席→…→修习茶道），否则不新增。
- 不引入重型依赖：先查 package.json，缺了先输出安装命令，禁止假设存在。

---

## 8 边界与风险（陷阱清单）

> 每条写"症状 → 处理方式"。处理方式必须是可执行的规则，不是建议。

### 8.1 素材版权
- 症状：未登记来源的图进入代码；通用图被当专图使用（张冠李戴）。
- 处理：只用 Pexels License 并登记 SOURCES.md；归并规则（6.3）随 teas.ts/teawares.ts 变更同步更新；新图必须过 compress-assets 体积上限。

### 8.2 离线 / PWA
- 症状：离线时视频黑屏、静态资源加载失败、AI 茶灵无响应。
- 处理：视频不本地化不进缓存，离线降级 `tea-mountain-hero.jpg`（已有，禁止改动降级链）；AI 茶灵保留网络不可用时的规则回复；改静态资源注意 vite-plugin-pwa 缓存策略。
- 风险：移动端 autoplay 被浏览器拦截、preload=none 行为不确定 → 归 P0-2 实测验证，不得假设。

### 8.3 AI
- 症状：浏览器直连第三方 AI（违反硬约束）、降级逻辑被改坏。
- 处理：AI 请求必须走后端代理 `/api/ai/*`；teaAI.ts 降级逻辑是承重墙，改动必须保留并回归测试。

### 8.4 数据 / DB
- 症状：直接改模型无迁移、迁移脚本未过真实 Postgres、bcrypt 版本漂移、IndexedDB 升级丢数据。
- 处理：改库前读 db-migration SKILL.md，走 alembic 迁移 + upgrade/downgrade 往返测试；bcrypt 锁定 `==4.0.1`；新增字段考虑 sync_status 同步逻辑；写入前 toRaw 去代理；Dexie schema 升级写版本迁移。

### 8.5 3D
- 症状：在 three/ 组件里动状态机、移动端帧率暴跌。
- 处理：three/ 只做视觉层不改状态机（3D_SPEC.md）；SSAO/Bloom/粒子数量在移动端实测帧率，不达标降配。

### 8.6 分享卡
- 症状：URL 超长被截断、非法数据注入 /share、schema 变更后旧分享卡失效。
- 处理：share.ts 纯函数 base64url，/share 只读页防御性校验（AGENTS.md 硬约束）；分享数据带版本字段（现状待核实，P1 补）；数据量增长超 URL 上限时改短链方案（P2）。

### 8.7 设计
- 症状：跳门禁链直接写码、引入禁令内元素（emoji 图标/AI 紫/eyebrow/玻璃拟态装饰等）。
- 处理：门禁链 6 步强制，未过审计不得提交；提交前跑 scan-emoji.cjs + verify-icons.cjs；设计审计清单逐项自查。

### 8.8 Git / 工程
- 症状：提交生成目录、密钥入库、空 commit、push main。
- 处理：不提交 node_modules/dist/.env/__pycache__/.venv/test-results/playwright-report/；不提交不回显任何密钥（.env*、*.pem、secrets/、credentials.json 只读 .env.example）；commit 中文规范（5.3）；不 push main、禁 force-push main；提交前跑 build + test + 后端 pytest。

### 8.9 运行时
- 症状：远程视频弱网卡顿、图片加载失败破图、双图表库体积膨胀、字体加载闪跳。
- 处理：视频三级降级（已有）；图片失败兜底归 P0-2 核查补齐；ECharts + Chart.js 双库按需引入，构建后核对体积；字体自托管 @font-face + swap，生产禁 Google Fonts link。

### 8.10 茶文化
- 症状：编造茶名/茶器/历史人物、冲泡参数违背茶类常识。
- 处理：茶叶分类按六大茶类，冲泡参数对照 tea-tasting 技能基准表；不编造，不确定标"待核实"；优先用 src/data/ 已有数据。

---

## 9 执行原则

### 9.1 保留（自 V2）
1. 代码必须模块化。
2. 所有数据未来支持服务器数据库迁移（DB 迁移预留）。
3. 当前先完成 Web 版本，架构预留 APP。

### 9.2 新增（对齐 AGENTS.md）
4. AI 必须走后端代理 `/api/ai/*`，禁止浏览器直连第三方 AI。
5. 设计门禁链 6 步强制，未过审计不得提交。
6. 验收标准先行：每个待做项有测试/截图/指标，用运行代替猜测。
7. 素材版权可商用 + 体积控制 + PWA 离线优先。
8. 最小实现：每一行改动都能追溯到用户请求，不顺手重构、不堆功能。

---

*本文档基于代码与 git 实核（2026-09-10）+ AGENTS.md 规范生成；数字来源见各章标注，未核实处标"待核实"。*
