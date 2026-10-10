---
name: plan-ai-session-quota
description: AI 会话记忆迁移 + 配额生效方案（2026-10-09）——B2 方向，前端 teaAI 按登录态分流，配额对登录用户生效。任务到代码行，含回滚与验证。
status: active
owner: yanha
date: 2026-10-09
last_updated: 2026-10-09
---

# PLAN：AI 会话记忆迁移 + 配额生效（2026-10-09）

## Goal

登录用户 AI 多轮记忆迁到后端 sessionId，F-6 配额对登录用户生效；游客保留本地 history，降级承重墙不变。

## Context

- 依据：`docs/prd/REQ-ai-session-quota-2026-10-09.md`（B2 已拍板）。
- 后端已就位：`AiCallQuota`（按 sessionId）、`QuotaExceededException`(429)、`resolveSession`（登录自动开会话）、`anchor()`（登录+sessionId 读 DB 历史前插）。
- 前端现状：`teaAI.ts` 裸 fetch 匿名；`askTeaMaster` 本地 history 拼装；`AiChatVo.sessionId` 未接。
- 承重墙：`teaAI.ts` 降级链（8 个单测锁定）。

## Pre-Mortem（假设失败反推）

| # | 失败场景 | 根因 | 对冲 |
|---|---|---|---|
| PM-1 | 登录用户多轮记忆变单轮 | 删了 history 拼装但后端 anchor 没生效（token 没注入成功） | F-2 单测断言请求带 Authorization |
| PM-2 | 游客多轮退化 | 误删游客分支的 history | F-3 单测锁游客仍拼 history |
| PM-3 | 429 后用户卡死 | 清了 sessionId 但没提示，用户不知情 | F-4：429 → 清 sessionId + 提示 + 规则降级 |
| PM-4 | 现有 8 测试全崩 | mock fetch 没适配新字段 | 测试改 mock 返回 + 断言，先跑通再改实现 |
| PM-5 | sessionId 泄漏到游客 | 存储读写在游客分支误触发 | sessionId 读写都包在 `isLoggedIn` 判断内 |

## Tasks

### T01 sessionId 存储（F-1）

- 新建 `src/services/aiSession.ts`（仿 `authStorage.ts`）：

```ts
const KEY = 'tea-ai-session'
export function loadAiSessionId(): number | null { /* localStorage 读 */ }
export function saveAiSessionId(id: number): void { /* localStorage 写 */ }
export function clearAiSessionId(): void { /* localStorage 删 */ }
```

- Validation：`npm run type-check`。

### T02 teaAI 注入登录态 + sessionId（F-2）

- 文件 `src/services/teaAI.ts`，新增 import `getAuthToken` + aiSession。
- 加工具函数：

```ts
function isLoggedIn(): boolean {
  const t = getAuthToken()
  return !!t && t !== 'dev-token'
}
```

- `askTeaMaster` 的 fetch 改：
  - headers 注入 `Authorization: Bearer ${token}`（仅登录）
  - body 带 `sessionId`（登录且有本地 id 时）
- Validation：单测断言请求头/体。

### T03 askTeaMaster 登录态分流（F-3）

- 登录：`messages = [{system}, {user}]`（不拼 history），带 sessionId
- 游客：`messages = [{system}, ...history.slice(-4), {user}]`，不带 sessionId
- 响应后：若 `data.data.sessionId` 非空 → `saveAiSessionId()`
- Validation：单测两条路径。

### T04 429 超限处理（F-4）

- 在 `!res.ok` 分支判断 `res.status === 429`：
  - `clearAiSessionId()` + track degraded + 返回 `ruleBasedReply`（规则降级）
  - 提示文案由调用方（AIAsk.vue）处理？——**否**，teaAI 是纯服务，返回字符串。提示需要在 AIAsk 层。

**决策修正**：teaAI 返回纯字符串，无法带"这是超限"的语义。最小实现：
- teaAI 在 429 时 `clearAiSessionId()`（下次自动开新会话），track `result: 'degraded'`，返回规则回复。
- **提示**交给 AIAsk.vue：但 AIAsk 只拿到字符串，分不清规则降级还是 LLM 回复。

**再决策**：为避免 teaAI 契约爆炸（返回结构从 string 改对象，牵动所有调用方），**429 提示降级为「埋点 + 清 sessionId」**，UI 提示不在本方案做（记入 REQ 的 Not Doing 补充）。

### T05 测试回归（F-5）

- `teaAI.spec.ts`：mock fetch 适配 Authorization/sessionId；新增：
  1. 登录带 sessionId：请求体含 sessionId、无 history
  2. 游客：请求体不含 sessionId、含 history
  3. 429：清 sessionId + 返回规则回复
- Validation：`npm run test`（teaAI 相关）+ `npm run type-check`。

## Not Doing

- AIAsk.vue 的 429 用户可见提示（teaAI 返回 string 契约限制；需 UI 层改造，单独立项）。
- 后端改动（已就位）。
- `recommendTea`/`generateTastingNote`（单轮，无 session）。

## Rollback

- 每个 T 独立 commit；`git revert` 单点回滚。
- 纯前端，无 DB 迁移。
- 降级链承重墙：F-2/F-3/F-4 改动均保留「非 2xx → 规则降级」分支。
