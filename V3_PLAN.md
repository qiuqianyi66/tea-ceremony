# 「一盏茶」V3 重写规划 — V3_ROADMAP.md 产出方案

> 本文件是"把 V2_UPGRADE.md 重写为对齐现状的 V3_ROADMAP.md"的完整执行方案。
> 直接按此执行即可，不需再向用户确认方向。
> 创建日期：2026-09-09。执行人：AI（明日新会话）。

---

## 0. 任务一句话

把 `V2_UPGRADE.md`（V1→V2 旧构想，现状描述过时、存在违规）重写为 `V3_ROADMAP.md`：
**保留方法、对齐事实、修正违规、纳入深化，每个待做项带验收标准，可直接当开发指令。**

---

## 1. V2_UPGRADE.md 审视结论（已定，勿重做）

### 1.1 可取（6 项，保留进 V3）
1. 用户旅程叙事：入境→识茶→备器→烹水→冲泡→品鉴→收藏→修习茶道
2. 差距表方法：维度/已有/需新增/工作量
3. 阶段化实施路线 + P0/P1/P2 优先级
4. 四阶段演进：能体验→持久化→核心竞争力→商业化
5. 执行原则：模块化 / 数据库迁移预留 / Web 优先（架构预留 APP）
6. 水系统 / 茶器收藏 / AI 评价的信息结构

### 1.2 过时（8 处，V3 必须对齐现状）
| V2 文档说法 | 项目实际 |
|---|---|
| "6 类 7 款茶" | 49 款茶（src/data/teas.ts） |
| "3 款茶器" | 6 款 + 解锁/评分影响（src/data/teawares.ts） |
| "品鉴 3 步（观色→闻香→品味）" | 八维口感评分 × 冲泡工艺系数 |
| "无 AI" | 已有 AI 茶灵（teaAI.ts，含网络不可用降级） |
| "不推荐 Three.js（学习成本大）" | 3D 茶园/茶席/茶亭已上线（TresJS 5.8） |
| "不推荐社交/云端" | 分享品鉴卡（/share）+ FastAPI 后端已有 |
| 后端 "Node+NestJS+Supabase" | FastAPI + SQLAlchemy 2.0 + PostgreSQL + Alembic + Docker |
| 页面规划 "TeaRoom=首页" | HomeView 是首页，TeaRoom 是茶室 |

### 1.3 冲突（4 处，V3 必须修正）
1. **前端直连 LLM**（V2 3.1 节 prompt 示例）→ AGENTS.md 硬约束：AI 必须走后端代理 `/api/ai/*`，禁止浏览器直连第三方 AI
2. 文档用 emoji 当图标/标记 → 设计禁令"Emoji 当图标禁"（V3 全文禁 emoji）
3. 设计任务无 Design Read/视觉方向 → AGENTS.md 门禁链强制 6 步
4. 工作量无验收标准 → 必须改写成可验证目标

### 1.4 可深化（6 个方向，V3 纳入）
1. 真实素材专项（图/视频）——接用户最新诉求，PWA 离线优先
2. 评分口径统一：八维口感×工艺系数
3. 茶文化深度：产区风土 + 冲泡参数基准（tea-tasting 技能基准表）
4. 每个 Phase 配测试/截图/指标
5. 设计令牌落地：晨雾茶山色系/字体角色
6. 路线图对齐阶段进度 + 阶段六简历（用户明确不做，标注为"暂缓"）

---

## 2. V3_ROADMAP.md 文档结构（8 章）

| 章 | 内容 | 来源/原则 |
|---|---|---|
| 1 现状基线 | 技术栈全景、已完成功能盘点、阶段进度（一至五✅） | 从代码与 git log 实核，不编造 |
| 2 定位与旅程 | 保留 V2 旅程叙事，每环节标注"已实现/进行中/待做" | 保留可取 |
| 3 真实差距表 | 维度/现状（真实）/待做/优先级/验收标准 | 可验证目标 |
| 4 设计规范 | 门禁链 6 步、晨雾茶山色令牌+字体角色、禁令清单、组件标准 | 修正无门禁链冲突 |
| 5 工程规范 | AI 走后端代理、验证基线命令、提交规范、评分口径统一 | 修正 AI 直连冲突 |
| 6 真实素材专项 | 49 茶（按茶类归并）/6 器/4 产区/Hero 视频；版权/PWA 离线/体积约束 | 接用户最新诉求 |
| 7 路线图 V3 | P0：真实素材增强 + 视觉升级收尾；远期：社交/云端；每项带验收 | 对齐进度 |
| 8 执行原则 | 保留模块化/DB 迁移预留/Web 优先，新增代理/门禁/验证三条 | 保留+更新 |

---

## 3. 执行顺序（7 步）

1. **核对现状**（必做，10 分钟内）：
   - `git log --oneline -15` 确认最新进度（应含 2026-09-09 的 4 个 commit：feat 茶亭 / fix 3D 渲染 / refactor emoji / chore 脚本）
   - 用 `peek_task_progress` 查 Organizer `o_000191zvXWa`（真实素材增强任务）是否完成、产出在哪
   - 盘点 `src/assets/` 素材落盘（Organizer 应新增 teas/wares/regions 目录）
   - 核对 `src/data/` 实际数量：teas.ts 49 款 / teaMasters.ts 22 位 / teawares.ts 6 款 / gardenRegions.ts 4 产区
   - 视觉升级三件套实际完成度：3D 茶席、泡茶动画、产区地图、晨雾茶山（查 src/components/three/ 与相关视图）
2. **搭骨架**：8 章标题 + 每章要点占位
3. **填第 1-3 章**：真实基线 + 旅程标注 + 差距表
4. **写第 4-5 章**：从 AGENTS.md 抽取设计/工程规范（原样引用规则，不自行改规则）
5. **写第 6 章**：素材清单对接 Organizer 结果（若任务未完成，写"进行中 + 清单占位"）
6. **写第 7-8 章**：路线图带验收 + 执行原则
7. **审阅**：对照 AGENTS.md 自查——全文禁 emoji、每个待做项有验收标准、数字可追溯（有来源或标"待核实"）

---

## 4. 关键事实速查（已核实，直接引用）

- 项目根：`C:\Users\yanha\Desktop\tea`；技术栈：Vue3+TS+Pinia+Tailwind4+TresJS 5.8.3+Dexie+FastAPI+SQLAlchemy 2.0+PostgreSQL+Alembic+Docker Compose+Nginx+PWA
- 数据：teas.ts 49 款茶（longjing/biluochun/huangshanmaofeng/.../jingmai_sh）；teaMasters.ts 22 位茶人；teawares.ts 6 款茶器；gardenRegions.ts 4 产区（hangzhou/wuyishan/yunnan/fuding）
- 阶段进度：阶段一至五✅（打磨展示/自动化测试/分享品鉴卡/AI 代理/GitHub 专业度）；阶段六简历 = 用户明确不做（标注暂缓）；视觉升级推进中（3D 茶席、泡茶动画、产区地图、晨雾茶山）
- 评分模型：品鉴结果 = 八维口感评分 × 冲泡工艺系数（保持可解释性）
- AI 硬约束：AI 请求必须走后端代理 `/api/ai/*`，禁止浏览器直连第三方 AI；teaAI.ts 有降级逻辑（网络不可用时规则回复）
- 设计令牌（晨雾茶山体系）：宣纸白 #F5F1E6 / 墨青 #0F1A14-#1A2420 / 茶汤金 #C9A96E / 竹青 #A5C9A0 / 枯褐 #8D6E63；字体 Noto Serif SC 同族（标题内强调用同字体斜体/粗体，禁混插异族字体）
- 设计禁令速查：禁 emoji 当图标、AI 紫渐变、暖米白+陶土、纯黑灰（要 tint）、Tailwind 默认色板；一页一个强调色全页锁定；禁 eyebrow 眉题；禁玻璃拟态装饰；禁渐变文字；禁 bounce/elastic
- 组件标准：≤200 行（超了拆）；触控目标 ≥44px；状态五态齐全（hover/disabled/loading/error/empty）；浏览器表面定制（::selection/:focus-visible 已补）；正文对比度 ≥4.5:1；正文度量 65-75ch
- 验证基线：`npm run type-check` / `npm run test`（67）/ `npm run build` / `npx playwright test`（8）/ `node scripts/verify-gardens.cjs`（期望 ERRORS:[]）/ `node scripts/verify-pavilion.cjs`
- 2026-09-09 已完成：全项目 emoji→lucide（icons.ts 已注册全部图标）、3D 渲染修复（vite.config 接入 TresJS template-compiler-options）、茶亭叙事锚点、4 个 commit 已提交

---

## 5. 边界与禁令（执行时守）

- **只写 V3_ROADMAP.md 一个文件**，不顺手改代码、不改 AGENTS.md、不删 V2_UPGRADE.md（保留对照）
- 全文简体中文；**禁 emoji**（包括 🔴🟡🟢 标记，改用"高/中/低"或"P0/P1/P2"文字）
- 不编造数字：项目实际数量必须来自代码核对，标"待核实"的不得写死
- 每个"待做"项必须含：目标 / 验收标准（测试/截图/指标）
- 不确定的（如 Organizer 素材产出细节）标注"待确认"并说明从哪确认
