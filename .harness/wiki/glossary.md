---
name: glossary
description: tea 领域术语表——统一业务/技术/状态术语，禁止 AI 造词。编码、评审、写 wiki 前对照，避免同一概念多个叫法。
---

# 领域术语（glossary）

> 来源：CONTEXT.md。AI 与开发者共用同一语言；新增术语先更新此处。

## 业务术语

| 术语 | 定义 | 代码位置 |
|---|---|---|
| 茶席 | 一次完整的茶道体验流程：入席→选茶→备器→煮水→冲泡→品鉴 | `src/views/` |
| 冲泡 | 投茶、注水、浸泡、出汤的交互过程（3D 茶席视觉） | `src/views/BrewView.vue` |
| 品鉴 | 观色、闻香、品味三步评分流程 | `src/views/TasteView.vue` |
| 八维评分 | 汤色、香气、滋味、苦涩、生津、喉韵、耐泡度、协调性 | `src/services/scoring.ts` |
| 工艺系数 | 水温、投茶量、时间、茶器、水源对评分的修正系数（0.8-1.2） | `src/services/scoring.ts` |
| 茶灵 | AI 茶文化助手（RAG + LLM，走后端代理；不可用降级规则回复） | `src/services/teaAI.ts` |
| 茶器 | 泡茶器具（盖碗、紫砂壶、玻璃杯等），影响工艺系数 | `src/data/teawares.ts` |
| 水源 | 冲泡用水（纯净水、矿泉水、山泉水），影响工艺系数 | `src/data/waters.ts` |
| 茶园 | 个人成长系统：品鉴后种植茶树/植物，与经验绑定 | `src/views/GardenView.vue` |

## 技术术语

| 术语 | 定义 |
|---|---|
| 离线优先 | 数据先写 IndexedDB，再异步同步后端（ADR-001） |
| 同步状态 | pending / synced / failed 三态（`src/types/tasting.ts`） |
| 幂等创建 | 品鉴记录 / 茶园种植按 `user_id + client_id` 去重，重复提交返回同一条 |
| 降级链 | AI 不可用时回退规则回复（teaAI.ts 承重墙） |
| 业务异常 | service 层抛出的统一异常（BadRequest 400 / Unauthorized 401 / NotFound 404 / Conflict 409） |

## 状态枚举（禁造新值）

| 概念 | 合法值 |
|---|---|
| 同步状态 | `pending` / `synced` / `failed` |
| 茶叶分类 | 绿茶 / 白茶 / 黄茶 / 青茶 / 红茶 / 黑茶（六大茶类） |
| 茶器稀有度 | 普通 / 稀有 / 传说（按 `src/data/teawares.ts`） |
| 工艺系数范围 | 0.8 - 1.2 |
| 八维评分范围 | 0 - 100 |
| 分享数据版本 | 带版本字段，未知版本拒绝（`share.ts`） |

## 术语规则

- 🔴 同一概念全文统一，禁止中英混用造词（如"茶席"≠"tea ceremony session"）。
- 🔴 新增术语必须先定义再使用；代码命名与术语表一致（如 `tasting_records` 对应"品鉴记录"）。
- 🟢 文化数据不编造：茶名/茶器/历史人物不确定标 "待核实"，优先用 `src/data/` 已有数据。
