# 一盏茶 前端产品需求文档（Frontend Product PRD）

> 产品级 PRD（补齐服务契约层 m1-* 之外缺失的产品/交互定义）。
> 事实来源（只读核实）：`src/router/index.ts`（20 路由）、`src/views/AIAsk.vue`（AI 交互现状）、`src/services/teaAI.ts`（RAG/降级链）、`vite.config.ts`（PWA/构建）、`docs/PERF_BASELINE.md`、AGENTS.md（冲泡零点击闭环/设计禁令）。日期：2026-10-07。状态：基线版（既有功能规格化，后续迭代参照）。

## 1. 定位与目标

一盏茶是沉浸式在线茶道应用，不是泡茶工具，是一座数字茶室。核心承诺：离线可用、零点击冲泡闭环、AI 茶灵陪伴、个人成长沉淀。

目标用户：茶道入门者与爱好者（单用户/小团队自托管）。

## 2. 范围与边界

| 方向 | 内容 |
|---|---|
| 覆盖 | 20 个页面（见 §3）的产品级需求：导航、核心旅程、AI 茶灵交互（含 RAG/降级）、离线体验、触控与无障碍 |
| 不做 | 页面视觉重设计（DESIGN_SPEC 已定义）；后端契约细节（见 m1-* PRD）；新页面新增（判据：不新增页面） |

## 3. 页面与导航（现状核实）

| 路由 | 页面 | 产品角色 |
|---|---|---|
| `/` | HomeView | 入口/氛围引导 |
| `/select` | SelectView | 选茶（按心情/天气/茶类） |
| `/brew` | BrewView | 冲泡（零点击闭环：煮水→温杯→醒茶→出汤，仅 READY 拖一次注水） |
| `/taste` | TasteView | 品鉴记录（八维口感评分 × 冲泡工艺系数） |
| `/history` | HistoryView | 历史记录 |
| `/growth` | GrowthView | 个人成长 |
| `/garden[/:id]` | GardenView | 3D 茶园（四园晴雨） |
| `/map` | MapView | 产区地图（本地数据） |
| `/graph` | TeaGraph | 茶学关系图 |
| `/tearoom` | TeaRoom | 3D 茶室 |
| `/tea/:id` | TeaDetailView | 茶叶详情 |
| `/tools` | ToolSelect | 茶器选择 |
| `/login` / `/profile` / `/collection` | LoginView / TeaProfile / CollectionView | 账号/收藏 |
| `/synesthesia/:id` / `/break` | TeaSynesthesiaView / TeaBreakView | 通感/茶歇 |
| `/share` | ShareView | 品鉴卡分享（只读页防御性校验） |
| `/health` | HealthView | 健康观测 |
| `/ai` | **AIAsk（茶灵）** | AI 对话（T11 激活） |

## 4. 功能需求（Given-When-Then）

### F-P1 导航与旅程

- Given 用户进入首页，Then 可见核心入口（选茶/茶室/茶园/茶灵）且离线可用（PWA precache）
- Given 用户完成冲泡流程，Then 全流程零点击（煮水→温杯→醒茶→出汤自动推进），仅 READY 状态拖拽一次注水
- Given 用户品鉴，Then 八维口感评分 × 冲泡工艺系数生成可解释结果，并沉淀到历史/成长

### F-P2 AI 茶灵（T11，本次规格化）

- Given 用户进入 `/ai`，Then 显示空状态（茶灵图标 + "有什么关于茶的问题想问？" + 5 个建议问题），输入框可用
- Given 用户提问，Then 消息气泡即时上屏（用户右对齐/茶灵左对齐带头像），茶灵回复期间显示三圆点"输入中"动画，输入与发送按钮禁用
- Given 提问含茶名/茶类/茶器，Then 前端先调 RAG（`/api/v1/culture/search`）取知识库上下文注入 system prompt，再调 LLM（`/api/v1/ai/chat`）——**引用知识库而非凭空编造**
- Given LLM 不可用（502/404/网络中断），Then **静默降级规则引擎**（teaAI.ts 承重墙）：按规则回复（含茶名→冲泡参数、茶类→基准参数、茶器→介绍），对话不断链不报错
- Given 回复成功，Then 埋点 `ai_ask success`；降级则 `ai_ask degraded`（本地 IndexedDB，无网络外发）
- Given 对话上下文，Then 最近 6 条消息随请求携带（history 截取），茶灵可续上下文
- Given 输入超长，Then 输入框 maxlength=500 限制

### F-P3 离线与降级

- Given 无网络，Then 全站可导航（SPA navigateFallback），API 请求失败走各自降级（AI→规则引擎、records→IndexedDB 本地）
- Given 品鉴记录未登录，Then 存 IndexedDB（sync_status=pending），登录后同步

### F-P4 触控与无障碍

- Given 移动端，Then 触控目标 ≥44px、无横向滚动（已建 audit 脚本）
- Given 键盘/读屏用户，Then 按钮有 aria-label、焦点环可见（e2e/a11y CI 门禁）

## 5. 非功能约束

| 维度 | 约束 |
|---|---|
| 离线优先 | PWA precache ≈4MB；3D 纹理运行时缓存；离线深链不白屏（navigateFallback 已配） |
| 无外发 | 埋点/错误只落 IndexedDB，不破 ADR-006 |
| AI 红线 | AI 请求必须走后端代理（禁浏览器直连第三方）；降级链（teaAI.ts 承重墙）零削弱 |
| 性能 | 首屏 JS 367KB 按需（基线）；任何优化不得推高首屏 LCP |
| 设计 | DESIGN_SPEC 令牌/组件规则；设计禁令速查遵守（AGENTS.md §6） |

## 6. 影响分析

| 维度 | 影响 |
|---|---|
| 现有功能 | 本 PRD 为规格化基线，不改行为；后续迭代以 F-P 编号引用 |
| AI | RAG + 降级链已激活（T11）；流式输出/引用展示为后续增强（见优化研究） |
| 验收 | 前端优化/新功能须对照本 PRD 的功能编号与 §5 约束 |

## 7. 验收清单（基线）

- [x] 页面清单与路由核验（20 路由，`src/router/index.ts` 实证）
- [x] AI 茶灵交互现状核实（AIAsk.vue：空状态/气泡/输入中/建议词/降级链）
- [x] 核心旅程与离线/触控约束与 AGENTS.md/PERF_BASELINE 对齐
- [x] 承重墙声明（降级链不改逻辑）
