---
last_updated: 2026-10-06
status: active
owner: yanha
---

# m1-frontend 前端联调 — 需求分析（PRD 级）

> 阶段 1 产出（开发流程规范：需求分析先行）。批 C 第一片（T10）：前端 auth/teas/records 三域从旧 FastAPI 切换到 Spring Boot 新后端 `/api/v1`。
> 事实来源（均只读核实）：`src/services/http.ts` / `api/auth.ts` / `api/teas.ts` / `api/records.ts` / `stores/auth.ts` / `authStorage.ts` / `teaAI.ts`（AI 承重墙）/ `vite.config.ts`（dev proxy）/ `.harness/wiki/api-contract.md`（契约权威）/ `AuthController` + `TokenVo` + `UserVo`（新后端 auth 实际契约）。日期：2026-10-06。状态：**待用户确认**。

## 1. 背景与目标

批 A/B 已完成 Spring Boot 新后端（auth/teas/records 三域 + compose 编排），前端仍调用旧 FastAPI（`/api` 前缀，dev proxy → 8000）。本切片把前端三域切到新后端 `/api/v1`，M1 闭环真正可用；旧栈仅维护不新增，退役路径打通。

## 2. 范围与边界

| 方向 | 内容 |
|---|---|
| 做（F10-1~5） | auth 注册/登录、teas 目录列表、records 提交/列表/删除 三域前端切新后端；dev proxy 切 8080；api-contract 补登 v1 auth 段 |
| 不做 | AI 切片（teaAI.ts 自动降级，见 F10-4b）；culture 域；teawares（前端本地数据）；garden（离线优先，前端不调后端）；teas 详情接口（前端用本地 `getTeaById`，种子同源一致）；旧 FastAPI 代码改动 |

## 3. 现状事实（已核实，契约差异矩阵）

| 域 | 旧契约（当前前端） | 新契约（Spring Boot） | 差异 |
|---|---|---|---|
| auth | `POST /auth/register\|login` → 直接 `{access_token, user}`；请求体 `display_name` | `POST /api/v1/auth/register\|login` → `ApiResponse{data:{token, expiresInSeconds, user}}`；请求体 `displayName`（camelCase，RegisterRequest 源码确认） | 路径前缀 `/v1`；响应包 `data`；token 字段 `access_token`→`token`；**user.displayName（camelCase，后端无 snake_case 策略）** 前端还原为 `display_name`；登录请求体同构 |
| teas | `GET /teas?type=` → 数组 `TeaResponseDto[]` | `GET /api/v1/teas?category=&origin=&page=&size=` → `ApiResponse{data:{items:[TeaVo], total, page, size}}` | 路径前缀 `/v1`；参数 `type`→`category`；响应分页 `data.items`；TeaVo 全字段（含真实 soup_color_min/max/dry_tea_color——前端现硬编码色值） |
| records | `GET /records` → 数组（skip/limit）；POST `client_id` 可选 | `GET /api/v1/records?page=&size=` → `ApiResponse{data:{items,total,page,size}}`；POST `client_id` 必填（V1 NOT NULL） | 路径前缀 `/v1`；列表分页解包；POST client_id 必填（toRecordDto 已有 client_id 逻辑） |
| AI/culture | teaAI.ts 直接 fetch `/ai/chat`、`/culture/search`（不经 http.ts） | 新后端无此端点 | `!res.ok → null/''` → **规则引擎降级**（承重墙已兼容 404，见 F10-4b） |

**前端调用全景**（grep 核实）：auth.ts `/auth/register|login`；teas.ts `/teas`（仅 list，无详情）；records.ts `/records`（list/create/delete，无详情）；teaAI.ts `/ai/chat`×2 + `/culture/search`（直接 fetch）。**garden/culture/teawares 前端不调后端**（本地数据/离线优先）。

## 4. 功能需求（Given-When-Then）

### F10-1 auth 注册/登录切新后端

- Given 新后端运行，When 前端提交注册（username/password/displayName），Then `POST /api/v1/auth/register` + 解包 `ApiResponse.data` → 登录态建立（token 存 authStorage、user 进 store）
- Given 登录成功，Then `Authorization: Bearer <token>` 注入后续请求（http.ts 现有机制不变——authStorage 存 `{token, user}`，`getAuthToken()` 读取 ✓ 字段名天然兼容）
- Given 登录失败（错误密码），Then 401 不触发全局跳登录（http.ts 对 `/auth/` 路径跳过 ✓ 兼容 `v1/auth`）
- Given 新后端不可用，Then 前端 fallback 本地模式（dev-token）不变（现有降级路径保留）

### F10-2 teas 目录列表切新后端

- Given 新后端运行，When 前端请求茶叶列表（含茶类筛选），Then `GET /api/v1/teas?category=...&page=1&size=20` + 解包 `data.items` → 本地 Tea[]（66 条种子）
- Given TeaVo 返回，Then `toLocalTea` 映射全字段（**真实汤色/干茶色替换硬编码**、infusions/flavor/story/description）
- Given 茶类筛选，Then 前端 `type` 参数映射为新契约 `category`（中文茶类兼容，TeaType 即中文）

### F10-3 records 提交/列表/删除切新后端

- Given 登录后提交品鉴记录，Then `POST /api/v1/records`（client_id 幂等键必填——toRecordDto 已有）+ 解包 `data` → RecordVo（含 client_id，fromRecordDto 靠它还原本地 id）
- Given 登录后请求历史列表，Then `GET /api/v1/records?page=1&size=20` + 解包 `data.items` → 本地 TastingRecord[]（倒序）
- Given 删除记录，Then `DELETE /api/v1/records/{id}` + 解包 `data`（200）
- Given 未登录，Then 401 → 清 token 跳登录（http.ts 现有行为）；游客本地记录走 IndexedDB + 登录后 syncPending（现有流程）

### F10-4 dev proxy 切换 + AI 承重墙

- **F10-4a** Given vite dev，When 启动，Then proxy `/api` → `http://localhost:8080`（新后端；原 8000 旧栈不再使用）
- **F10-4b（承重墙）** Given 新后端无 `/api/ai/*`、`/api/culture/*`，When teaAI.ts 请求，Then `callLLM` `!res.ok → null` → **规则引擎降级**；`fetchRAGContext` `!res.ok → ''` → 无知识库增强——**功能降级但不断链不报错**（与"网络不可用"同路径降级，设计兼容）；AI 完整能力待 AI 切片恢复
- Given 评分透传，Then dimensions/overall_score/process_factor 前端计算（scoring.ts）→ 后端透明存储（ADR-002，联调验证不重算）

### F10-5 契约文档同步

- Given 联调完成，Then api-contract.md 补登 `/api/v1/auth` 段（端点/TokenVo/ApiResponse 包装），三域 v1 契约齐全

## 5. 非功能约束

| 维度 | 约束 |
|---|---|
| 承重墙 | AI 降级链（teaAI.ts `!res.ok` 处理）**不改**；authStorage/http.ts 基础层**不改**（token 注入/401 处理保持）；评分透传不重算 |
| 最小改动 | 只改三域 api 文件 + store 适配点 + vite.config proxy；不顺手重构相邻代码 |
| 兼容 | 前端类型系统（Tea/TastingRecord/UserInfo）结构不变，dto 映射层适配 |
| 验证 | `npm run type-check` + `npm run test`（含 dto 映射新增单测）+ 本地起新后端联调冒烟 |

## 6. 影响分析

| 维度 | 影响 |
|---|---|
| 前端 | 三域 api 层切 `/v1` + 响应解包；teas 色值/字段来自服务端（与本地数据同源，视觉一致）；records client_id 幂等语义强化 |
| AI | 联调后 AI 走规则引擎降级（LLM 不可用路径）——**功能降级接受**，AI 切片（批 C 后续）恢复 |
| 后端 | 零改动（契约已就位）；v1 auth 契约文档补登 |
| 旧栈 | 前端不再调 auth/teas/records 旧端点；`/api/ai`、`/api/culture` 仍被 teaAI 请求（404 降级）；旧后端退役等待 AI 切片 |
| 回滚 | git 回退前端分支；dev proxy 恢复 8000 即回旧栈 |

## 7. 决策点（按推荐执行）

| # | 决策 | 推荐 | 备选 |
|---|---|---|---|
| D10-1 | auth 适配位置 | **authApi 层解包**（返回 `{access_token: token, user}` 兼容现有 store 零改动，改动面最小） | store 层改解包（改动面大） |
| D10-2 | AI/culture 处理 | **接受自动降级**（teaAI.ts 已兼容 404，零改动；AI 切片恢复） | 保留旧栈双代理（dev 分流 /api/ai→8000，过渡复杂） |
| D10-3 | dev proxy | **整段 `/api` → 8080**（新后端；AI 404 降级路径已验证） | 按路径分流（/api/ai 仍 8000，多一跳） |
| D10-4 | teas 详情 | **保持本地数据**（getTeaById，种子同源一致；本次不动） | 切新接口（TeaVo 全字段已够，后续切片） |

## 8. 验收清单（阶段 1 自检）

- [x] F10-1~5 有编号 + Given-When-Then
- [x] 契约差异矩阵基于只读核实（AuthController/TokenVo/UserVo/前端四文件/vite.config）
- [x] 承重墙声明：AI 降级链零改动、http.ts/authStorage 零改动、评分透传
- [x] 决策点 D10-1~4 有推荐
- [x] 不做项明确（AI 切片/teas 详情/garden/culture/teawares/旧栈）
