# 一盏茶 前端产品需求文档 V2（企业级）

> V2 升级：从基线规格化升级为企业级产品需求——用户与场景、功能域拆分、异常/边界路径、非功能矩阵、验收发布标准、多智能体演进衔接。
> 事实来源（只读核实）：`src/router/index.ts`（20 路由）、`src/views/*`（AIAsk/Brew/Map 等现状）、`src/services/*`（teaAI/http/api 层）、`vite.config.ts`（PWA/构建）、`docs/PERF_BASELINE.md`、`DESIGN_SPEC.md`、`PRD-spring-ai-refactor-v2.md`（M5 多智能体）。日期：2026-10-07。版本：V2.0。

## 1. 定位与目标

「一盏茶」是沉浸式在线茶道应用（数字茶室），面向茶道入门者与爱好者，单用户/小团队免费自托管。

企业级目标（重构 PRD 核心目标衍生）：
1. **技术含金量**：Java 企业级 + 阿里云 AI 生态；前端 Vue 3.5 + TS strict 工程化。
2. **AI 升级**：从"代理转发"升级为"茶灵多智能体体系"（M5 主线），前端是专家团队的交互层。
3. **可上线/可展示/可开源**：离线优先 PWA、无外发埋点、可访问性达标。

核心承诺：离线可用 / 零点击冲泡闭环 / AI 茶灵陪伴 / 个人成长沉淀。

## 2. 用户角色与核心场景

| 角色 | 特征 | 核心诉求 |
|---|---|---|
| 茶道入门者 | 第一次来，想学茶 | 选茶不迷茫、冲泡有指引、AI 茶灵随时问 |
| 爱好者 | 有基础，持续记录 | 品鉴评分可解释、成长曲线、复盘建议 |
| 游客（未登录） | 临时体验 | 核心旅程可走（离线优先），记录存本地 |

核心场景（端到端）：
- S1 入门：入席 → 选茶（心情/天气）→ 冲泡（零点击闭环）→ 品鉴 → 茶灵答疑
- S2 成长：历史记录 → 品鉴复盘（M5：taster+mentor 协作）→ 成长建议
- S3 离线：无网络全站可导航，AI 降级规则引擎，记录待同步
- S4 分享：品鉴卡分享（/share 只读防御性校验）

## 3. 信息架构与导航

| 功能域 | 路由 | 页面 | 入口来源 |
|---|---|---|---|
| 入口/氛围 | `/` | HomeView | 全局 |
| 选茶 | `/select` | SelectView | 首页 |
| 冲泡 | `/brew` | BrewView | 首页/选茶 |
| 品鉴 | `/taste` | TasteView | 冲泡完成 |
| 历史/成长 | `/history` `/growth` | HistoryView / GrowthView | 首页 |
| 3D 空间 | `/tearoom` `/garden[/:id]` | TeaRoom / GardenView | 首页 |
| 知识 | `/map` `/graph` `/tea/:id` `/tools` | MapView / TeaGraph / TeaDetailView / ToolSelect | 首页/详情 |
| AI | `/ai` | AIAsk（茶灵） | 全局入口 |
| 账号 | `/login` `/profile` `/collection` | LoginView / TeaProfile / CollectionView | 导航 |
| 分享/健康 | `/share` `/health` `/synesthesia/:id` `/break` | ShareView / HealthView / TeaSynesthesiaView / TeaBreakView | 分享链/设置 |

导航约束：触控目标 ≥44px；全屏 Hero 用 `min-h-[100dvh]`；图标单库单家族（lucide）。

## 4. 功能需求（分域 Given-When-Then）

### 4.1 冲泡域（承重体验）

- **F-B1 零点击闭环**：Given 进入冲泡页，When 流程启动，Then 煮水→温杯→醒茶→出汤自动推进；仅 READY 状态拖拽一次注水。禁止为温杯/醒茶/出汤加手动确认（AGENTS 硬规则）。
- **F-B2 状态机**：Given 流程各阶段，Then 五态齐全（hover/disabled/loading/error/empty）；状态由状态机驱动（3D 只做视觉层，不改状态机）。
- **F-B3 异常**：Given 定时器/动画中断，Then 状态不悬挂（超时容错），可安全重入；Given 移动端，Then 无横向滚动、触控 ≥44px（audit 脚本门禁）。

### 4.2 品鉴域（可解释评分）

- **F-T1 评分模型**：Given 八维口感评分，Then 结果 = 八维口感评分 × 冲泡工艺系数，保持可解释（前端 scoring.ts 计算，后端透明存储，不重算）。
- **F-T2 记录闭环**：Given 登录，Then POST /api/v1/records（client_id 幂等键）；Given 未登录，Then 存 IndexedDB（sync_status=pending），登录后 syncPending。
- **F-T3 删除**：Given 删除记录，Then DELETE /api/v1/records/{id} + 解包 data（200）；本地同步删除。

### 4.3 AI 茶灵域（T11 已激活，M5 演进）

- **F-A1 对话交互**：Given 进入 /ai，Then 空状态（茶灵图标 + "有什么关于茶的问题想问？" + 5 建议词）；消息气泡即时上屏（user 右/ai 左带头像）；回复中三圆点动画、输入与发送禁用。
- **F-A2 RAG 增强**：Given 提问含茶名/茶类/茶器，Then 前端调 /api/v1/culture/search 取知识上下文注入 system prompt 再调 LLM；**引用知识库而非编造**。
- **F-A3 降级承重墙**：Given LLM 不可用（502/404/网络），Then **静默降级规则引擎**（teaAI.ts 承重墙零削弱）：茶名→冲泡参数、茶类→基准参数、茶器→介绍；对话不断链不报错。
- **F-A4 上下文**：Given 多轮对话，Then 最近 6 条消息随请求携带（history 截取）；Given 输入超长，Then maxlength=500 限制。
- **F-A5 埋点**：Given 成功，Then ai_ask success；降级则 ai_ask degraded（本地 IndexedDB，无外发）。
- **F-A6（M5 演进预留）**：Given 用户意图（荐茶/茶记/问答/冲泡/复盘），Then 前端传意图/agent 参数，Orchestrator 路由专家；Given 复杂请求，Then 支持 Supervisor 协作与 Graph 流水线；Given 流式，Then SSE 逐 token 渲染（P-O 系列推进）。

### 4.4 社交分享域

- **F-S1 品鉴卡分享**：Given 生成分享，Then share.ts 纯函数 base64url；/share 只读页防御性校验（数据带版本字段，未知版本拒绝）。
- **F-S2 深链**：Given 离线从 /share/<token> 进入，Then SPA navigateFallback 承接，不白屏 404。

### 4.5 账号与数据域

- **F-U1 认证**：Given 注册/登录，Then POST /api/v1/auth/*（解包 ApiResponse.data）；token 存 authStorage（非 localStorage 明文持久化决策见 §6.1）；未登录 401 → 清 token 跳登录（http.ts 现有行为）。
- **F-U2 数据主权**：Given 用户数据，Then 只落本机（IndexedDB/PWA）+ 用户自托管后端；无第三方外发。

## 5. 非功能需求矩阵（企业级）

| 维度 | 需求 | 验收判据 |
|---|---|---|
| **安全性** | 0 处 v-html/innerHTML（XSS 面）；CSP 补全（object-src/base-uri/frame-ancestors/worker-src）；密钥/Token 禁入日志；AI 请求只走后端代理 | grep 审计 0 命中；nginx.conf 全项；无 .env 提交 |
| **性能** | 首屏 JS ≤367KB 按需（tres/echarts 不进首屏）；LCP ≤2.5s；离线包 ≤4MB；gzip+brotli | PERF_BASELINE 重测对比 |
| **离线优先** | 全站可导航；API 失败各自降级；3D 纹理运行时缓存不 precache | e2e/pwa-offline 绿 |
| **可访问性** | 对比度 ≥4.5:1；键盘导航/焦点环；触控 ≥44px；prefers-reduced-motion | axe 审计 + audit-touch 绿 |
| **可维护性** | 组件 ≤200 行拆；类型严格（noUncheckedIndexedAccess）；单测+E2E 门禁 | type-check/test/e2e 绿 |
| **无外发** | 埋点/错误只落 IndexedDB（ADR-006） | 网络面板无第三方请求 |
| **兼容性** | GitHub Pages base=/tea-ceremony/ 与本地根路径双态；SW scope 正确 | CI 双态构建绿 |
| **国际化（预留）** | 文案抽离（i18n 目录），暂仅 zh-CN | 结构预留即可 |

## 6. 关键架构决策（前端）

### 6.1 Token 存储
- 决策：JWT 存 authStorage（内存 + sessionStorage 权衡，禁 localStorage 明文持久化）；刷新页面可恢复会话，退出即清。
- 理由：localStorage XSS 可读；内存丢失会话体验差；本项目 CSP 严格 + 0 XSS 面，sessionStorage 为折中。

### 6.2 错误处理与降级分层

```
UI 组件 → 业务 store（Pinia）→ 服务层（api.ts 解包 ApiResponse）
   │          │                     │
错误边界    状态五态            降级（网络/AI/401 各自处理）
```

### 6.3 多智能体前端扩展点（M5 预留）
- `teaAI.ts` 增加 `agent`/`intent` 参数（AiChatRequest 已支持可选 agent）；专家路由由后端 Orchestrator 决定，前端只传意图。
- 流式渲染组件 `AiStreamView`（SSE 逐 token）预留；引用来源卡片 `AiCitationCard`（RAG 命中茶/诗展示）见优化 P-O4。

## 7. 验收与发布标准

| 级别 | 标准 |
|---|---|
| 单功能 | GWT 用例过 + 对应单测绿 + type-check 绿 |
| 页面 | 视觉对照 DESIGN_SPEC 审计 9 条 + 设计门禁 6 步 |
| 回归 | `npm run quality`（lint+type-check+test+build+verify）+ 相关 e2e |
| 发布 | CI 12 job 全绿；`main` 稳定；上线后观察 ≥1 周 |

## 8. 验收清单（V2）

- [x] 用户角色与核心场景（S1-S4）定义
- [x] 功能域拆分（冲泡/品鉴/AI/分享/账号）含 GWT + 异常路径
- [x] 非功能矩阵（安全/性能/离线/无障碍/维护/无外发/兼容/i18n 预留）
- [x] 关键架构决策（Token 存储/错误分层/M5 扩展点）
- [x] 验收与发布标准对齐 CI 门禁
- [x] 与 M5 多智能体主线衔接（F-A6）
