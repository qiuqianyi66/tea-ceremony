---
name: business-model
description: tea 业务模型——业务闭环、领域实体、核心流程、评分模型、离线同步。AI 编码前了解"业务长什么样"，避免凭直觉造业务逻辑。
---

# 业务模型（wiki）

> 来源：CONTEXT.md + DATABASE_ER.md + docs/architecture/system-overview.md。与代码保持同步，漂移时更新本文件而非改代码记忆。

## 1. 业务定位

「一盏茶」不是泡茶工具，是一座**数字茶室**：沉浸式在线茶道体验，目标用户为茶小白 / 有品茶习惯的人 / 冥想·慢生活人群。

## 2. 业务闭环

```
入席 → 选茶 → 备器 → 煮水 → 冲泡 → 品鉴记录 → 个人成长
```

- 入席：进入茶室（3D 空间），选择茶席
- 选茶：按六大茶类 / 偏好筛选茶叶
- 备器：选择茶器（影响工艺系数）
- 煮水：设定水温（3D 视觉反馈）
- 冲泡：投茶 / 注水 / 浸泡 / 出汤（3D 茶席交互）
- 品鉴记录：观色 → 闻香 → 品味 三步评分（八维）
- 个人成长：茶修等级 / XP / 茶园种植（成长系统）

## 3. 领域实体

| 实体 | 说明 | 关键字段 | 关系 |
|---|---|---|---|
| User | 用户 / 茶修者 | username, display_name, level, xp, preferred_type/temp/aroma/ware | 1-N tasting_records |
| Tea | 茶叶 | name, category(六大茶类), region_id, process_id, best_temp/time, flavor | N-1 region/process；N-N people/poems(经 relations) |
| TeaRegion | 茶山产区 | name, province, latitude/longitude, climate, soil | 1-N teas |
| TeaProcess | 制茶工艺 | tea_category, name, steps[] | 1-N teas |
| TeaPerson | 茶人历史 | name, dynasty, title, contribution, quote | N-N teas |
| TeaPoem | 茶诗词 | title, author, dynasty, content | N-N teas |
| TeaWare | 茶器 | name, ware_type, material, capacity, bonus, rarity | 影响工艺系数 |
| TeaEtiquette | 茶礼 | name, occasion, steps[] | 文化内容 |
| TeaRelation | 知识图谱关系 | source_type/id, target_type/id, relation | 图谱 |
| TastingRecord | 品鉴记录 | tea_id, dimensions, overall_score, process_factor, water_type, ware_id | N-1 user |
| GardenPlant | 茶园植物（种植） | user_id, client_id, 状态 | 1-N user |

## 4. 核心流程

### 4.1 品鉴评分（承重逻辑，保持可解释性）

```
八维口感评分（汤色/香气/滋味/苦涩/生津/喉韵/耐泡度/协调性，各 0-100）
    × 冲泡工艺系数（水温/投茶量/时间/茶器/水源，0.8-1.2）
    = overall_score
```

- 评分模型保持**可解释**：不引入黑盒，前端展示维度明细（见 `src/services/scoring.ts` + ADR-002）。
- 工艺系数范围 0.8-1.2，超出视为数据异常。

### 4.2 品鉴记录提交（幂等承重墙）

```
前端：写 IndexedDB（sync_status=pending）→ 乐观展示
后端：POST /api/records（user_id + client_id 唯一键）
      └─ 重复 client_id → 返回同一条已有记录，不产生重复
同步：网络恢复 → 批量同步 → sync_status 流转 pending→synced/failed
```

- **幂等键**：`user_id + client_id` 唯一索引（ADR-001 离线优先 + 幂等创建）。
- 记录归属校验按 `user_id`，不可访问他人记录（防越权）。

### 4.3 AI 茶灵（降级链承重墙）

```
用户提问 → 前端 /api/ai/chat → 后端代理（RAG 检索文化库 + LLM）
          └─ LLM 不可用(502) → 前端降级规则回复（teaAI.ts，承重墙禁删）
```

- AI 请求**必须走后端代理** `/api/ai/*`，禁止浏览器直连第三方 AI（ADR-003 + ADR-004）。
- 降级逻辑是承重墙：网络不可用时规则回复，改动必须保留并回归。

### 4.4 茶席冲泡（零点击闭环）

- 煮水→温杯→醒茶→出汤**全自动**，仅 READY 拖一次注水。
- 禁止为温杯/醒茶/出汤加回手动确认按钮（用户锁定偏好）。

## 5. 数据规模目标

| 表 | 目标 |
|---|---|
| teas | 200 款 |
| tea_regions | 50 个 |
| tea_processes | 6 类 |
| tea_people | 100 位 |
| tea_poems | 500 首 |
| teawares | 50 件 |
| tea_etiquettes | 20 种 |
| tea_relations | 1000+ 条关系 |

## 6. 业务边界（不做什么）

- 不做电商交易 / 不做社交动态流 / 不做简历与面试材料（用户明确暂缓）。
- 功能取舍以「三类用户能否完成一席完整茶事」为准。
