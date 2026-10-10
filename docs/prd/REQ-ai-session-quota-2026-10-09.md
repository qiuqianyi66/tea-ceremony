---
name: req-ai-session-quota
description: 前端 AI 会话记忆迁移 + 配额生效（2026-10-09）——把前端本地 history 多轮记忆迁移到后端 sessionId，使 F-6 会话配额对登录用户真正生效；游客保留本地 history 不退级。需求已确认（B2）。
status: active
owner: yanha
date: 2026-10-09
last_updated: 2026-10-09
---

# REQ：AI 会话记忆迁移 + 配额生效（B2，2026-10-09）

## 0. 结论先行

1. **目标**：让 F-6 会话配额（`AiCallQuota`，按 sessionId 计数）对登录用户真正生效。
2. **根因**：前端 `teaAI.ts` 走裸 fetch 匿名调用，不带 token 不带 sessionId，后端 `resolveSession` 返回 null，配额 `tryAcquire(null)` 永远放行。
3. **方案 B2**：前端多轮记忆按**登录态分流**——
   - **登录用户**（真 JWT）：带 `Authorization` + `sessionId`，删本地 history 拼装，交给后端 `anchor()` 读 DB 历史前插；配额计数生效。
   - **游客**（无 token / dev-token）：保持现状——不带 sessionId，继续用本地 history 拼装；游客可用性承重墙不变。
4. **不破坏的承重墙**：`teaAI.ts` 降级链（非 2xx → 规则引擎回复）必须保留并回归；`/api/v1/ai/chat` 保持 `permitAll` 游客可调。

## 1. 范围

### 1.1 做

| # | 内容 |
|---|---|
| F-1 | 前端 sessionId 存储（localStorage，仿 authStorage 模式） |
| F-2 | `teaAI.ts` 注入 Authorization（跳过 dev-token）+ 传 sessionId + 读响应 sessionId |
| F-3 | `askTeaMaster` 按登录态分流：登录删 history 拼装走 sessionId；游客保留 history |
| F-4 | 配额超限（429）处理：降级前识别 429，给用户可见提示（不静默） |
| F-5 | 单测回归：登录/游客/429 三条路径 |

### 1.2 不做

- 不改后端（`AiCallQuota`/`QuotaExceededException`/`anchor` 已就位）。
- 不改前端 UI 结构（AIAsk.vue 调用签名不变）。
- 不做「开新会话」UI 按钮（配额超限提示里说明"重新进入页面即开新会话"即可）。
- 不碰 `recommendTea` / `generateTastingNote`（单轮，无 history，不受影响）。

## 2. 关键设计决策

### 2.1 登录态判定

复用 `getAuthToken()`：token 非空且 ≠ `dev-token` → 登录；否则游客。
与 `http.ts:63` 的注入判定一致。

### 2.2 sessionId 生命周期

| 场景 | 行为 |
|---|---|
| 登录，无本地 sessionId | 不带 sessionId 请求 → 后端 `resolveSession` 自动 `createSession` → 响应返回新 sessionId → 前端存 localStorage |
| 登录，有本地 sessionId | 带 sessionId → 后端 anchor 读历史前插 |
| 退出登录 | 清 sessionId（随 auth 清理） |
| 游客 | 不读不写 sessionId，走本地 history |

### 2.3 429 超限处理

配额超限返回 `RATE_LIMITED`(429)。前端降级链须区分：
- 429 → **提示用户**「本轮对话已达上限，重新进入页面开始新对话」+ 清 sessionId + 规则降级回复
- 其它非 2xx / 网络错误 → 现状静默规则降级

> 为何 429 要提示：静默降级会让用户"聊着聊着突然变笨（规则回复）"却不知原因，违反「失败响亮」。

## 3. Given-When-Then 验收

| # | 验收 |
|---|---|
| F-1 | Given 登录用户首次调用 AI；When 后端返回 sessionId；Then localStorage 存下，二次调用带该 sessionId |
| F-2 | Given 登录（真 token）；When 调 askTeaMaster；Then 请求带 `Authorization: Bearer`；dev-token 游客不带 |
| F-3 | Given 登录 + 有 sessionId；When 多轮对话；Then 请求不带本地 history 拼装，依赖后端 anchor；Given 游客；When 多轮；Then 仍拼本地 history.slice(-4) |
| F-4 | Given 配额超限（后端 429）；When 调 askTeaMaster；Then 清 sessionId + 返回规则回复 + 埋点 degraded |
| F-5 | Given 全套改动；When `npm run test`；Then teaAI 单测全绿（含新增 429/登录/游客用例） |

## 4. 影响分析

| 项 | 影响 | 风险 |
|---|---|---|
| teaAI.ts | 核心服务，承重墙 | 降级链改动必须回归（现有 8 个单测锁行为） |
| 登录用户多轮 | 从本地态迁后端态 | 后端 anchor 只对登录生效，游客分支保留本地态防退化 |
| 配额语义 | 10 次/会话 | 超限后提示用户重进页面开新会话（内存态，后端重启也清零） |
| 前端测试 | teaAI.spec.ts | 现有 mock fetch 需适配新请求字段（Authorization/sessionId） |

## 5. 决策确认

- [x] B2 方向（2026-10-09 用户拍板「B2 迁移到后端会话记忆」）
- [x] 不破坏游客可用性（承重墙）
- [x] 429 显式提示（不静默）
