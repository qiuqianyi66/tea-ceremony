---
last_updated: 2026-10-10
status: active
owner: yanha
---

# agent-picker 变更记录

> 目录：`.harness/changes/agent-picker/`。本切片无数据库迁移，故无 db-migrations.sql / rollback.sql（按 m1-ai 惯例在顶部注明）。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | agent-picker（前端专家选择，F-M5-7 前端适配） |
| 分支 | `feat/agent-picker`（基于 main `3fa2096`） |
| 需求来源 | `docs/prd/m5-agent-product-prd.md` §F-M5-7（原文「前端适配（S2 后置）」）；用户 2026-10-10 拍板选项 C（先 B 后 A） |
| 类型 | feat |
| 涉及范围 | 前端（AIAsk.vue + teaAI.ts）；无后端、无部署、无数据 |

## 二、需求与方案

### 需求描述

1. **F-B1 专家可选**：用户在 `/ai` 页可点选专家；选中后请求带 `agent=<值>`。
2. **F-B2 零回归**：不选（默认「自动」）时行为与改动前**完全一致**——不传 `agent` 字段，保留隐式路由（文化意图→librarian，其余透明代理）。

### 验收标准（Given-When-Then）

- **Given** 用户未选专家（默认 auto），**When** 提问，**Then** body 不含 `agent` 字段，路由行为与改动前一致。
- **Given** 用户选「品鉴」（taster），**When** 提问，**Then** body 带 `agent: 'taster'`，且 `messages[0].role === 'system'`（system prompt 仍在）。
- **Given** 传入 `'auto'`，**When** 提问，**Then** 等同于不传（不改变路由语义）。
- **Given** 后端 502 降级，**When** 选了专家，**Then** 仍走 `ruleBasedReply` 规则回复（承重墙不受影响）。

### 技术方案

- `teaAI.ts`：`askTeaMaster(question, history, agent: TeaAgent = 'auto')` 加可选第三参；`agent !== 'auto'` 时才写入 body。**降级链、429 清会话、sessionId 逻辑一行未动**（承重墙保留）。
- 新增 `TeaAgent` 类型 + `TEA_AGENTS` 常量（label 与后端 `SYSTEM_PROMPT` 自称一致：荐茶/品鉴/冲泡/文化/成长）。
- `AIAsk.vue`：输入框上方加 chip 行（`role="radiogroup"` + `aria-checked`），默认「自动」。

### 设计门禁（AGENTS §6 六步）

1. **Design Read**：app UI / 茶道入门者 / 清雅克制东方茶室 / 倾向既有「暗色茶席+茶汤金」体系。
2. **三拨盘**：`VARIANCE 6 / MOTION 4 / DENSITY 4`（增量改动，对齐现状）。
3. **令牌**：全取自 `DESIGN_SPEC` §一（`tea-gold-dark` 唯一强调色 / `wood-light-dark` 未选中 / `wood-dark` 正文），**零裸值**。
4. **实现**：lucide 图标（既有 `plugins/icons.ts` 注册表，无新增依赖）。
5. **critique**：层级——chip 行在输入框上方，不抢对话区；勇气只花在选中态点亮。
6. **audit**：见下「自检清单」。

## 三、影响分析

- **影响面**：仅 `/ai` 页 + `askTeaMaster` 签名（向后兼容，第三参可选）。
- **兼容性**：`askTeaMaster` 既有调用方（`AIAsk.vue` 唯一）不传第三参时行为不变；单测 16/16 全绿（含承重墙降级 4 例）。
- **回滚路径**：`git revert` 单 commit（纯前端）。
- **契约变化**：无——`agent` 参数早已登记于 `.harness/wiki/api-contract.md` L144，本次只是让前端用起来。
- **承重墙确认**：`teaAI.ts` 降级链（网络不可用/502/无内容 → `ruleBasedReply`）**未动**；429 清 sessionId 未动；system prompt 仍在（有单测断言）。

## 四、自检清单

- [x] 十阶段 Gate：L1 前端（type-check + build + 单测）
- [x] 编码规范红线 15 条零违反（`audit-redlines.cjs` ERRORS: []）
- [x] 组件规范：`<script setup lang="ts">`、无 `any`、Props/Emits 无新增、组件行数 250 < 上限
- [x] 触控目标 ≥ 44px（实测 6 个 chip 全 44px；`audit-touch.cjs` `/ai` 零违规）
- [x] 状态五态：hover / selected / focus-visible 已做；disabled/loading 由既有输入框承担
- [x] 一键令牌零裸值；无第二个强调色；无 emoji（`scan-emoji.cjs` NO EMOJI FOUND）
- [x] 移动端无页面横向溢出（实测 `docOverflow: false`；chip 行内横滑为有意设计）
- [x] 测试全绿（`vitest teaAI.spec` 16/16）；`npm run quality` EXIT 0
- [x] 数据库迁移：无（本切片不涉库，已在顶部注明）
- [x] 观测期：前端改动，CI E2E 覆盖
