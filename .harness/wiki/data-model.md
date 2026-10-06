---
name: data-model
description: tea 数据模型——表结构、关系、幂等键、软删除、迁移规则。动数据库前必读；表结构以本文件 + 迁移脚本为准。
---

# 数据模型（data-model）

> 来源：DATABASE_ER.md + backend/app/models/。后端重写为 Spring Boot + JPA 时，表结构保持兼容，Entity 映射本文件。

## 1. 表清单与关系

```
tea_regions ←── teas ──→ tea_processes
     ↑            |             ↑
     |            |             |
tea_relations ←───┼───→ tea_people
     |            |             |
     ↓            ↓             ↓
tea_poems     teawares    tea_etiquettes

users ──→ tasting_records ──→ teas
users ──→ garden_plants
```

## 2. 表结构

### teas（茶叶主表）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | SERIAL PK | |
| name | VARCHAR(100) | 茶名 |
| category | VARCHAR(20) | 六大茶类 |
| origin | VARCHAR(200) | 产地 |
| region_id | INT FK→regions | 产区 |
| process_id | INT FK→processes | 工艺 |
| season | VARCHAR(20) | 明前/雨前/秋茶等 |
| grade | VARCHAR(50) | 等级 |
| altitude | VARCHAR(50) | 海拔 |
| best_temp | INT | 最佳水温 |
| best_time | INT | 最佳时间 |
| infusions | INT | 可冲泡次数 |
| flavor | JSONB | 风味标签 |
| story | TEXT | 文化故事 |
| description | TEXT | 简介 |
| historical_period | VARCHAR(100) | 历史时期 |
| water_requirement | VARCHAR(100) | 水质要求 |

### tea_regions（茶山产区）
id, name, province, latitude, longitude, altitude, climate, soil, history, famous_for(JSONB)

### tea_processes（制茶工艺）
id, tea_category, name, summary, steps(JSONB `[{order,name,desc,duration,temp}]`)

### tea_people（茶人历史）
id, name, dynasty, title, identity, description, contribution, quote, related_tea_ids(JSONB)

### tea_poems（茶诗词）
id, title, author, dynasty, content, related_tea_ids(JSONB), description

### teawares（茶器）
id, name, ware_type, material, capacity, origin, dynasty, craft, description, culture_story, bonus(JSONB), recommended(JSONB), rarity

### tea_etiquettes（茶礼）
id, name, occasion, description, steps(JSONB)

### tea_relations（知识图谱关系）
id, source_type, source_id, target_type, target_id, relation

### users（用户）
id, username(UNIQUE), display_name, level, xp, preferred_type, preferred_temp, preferred_aroma(JSONB), preferred_ware_id

### tasting_records（品鉴记录）
id, user_id(FK), tea_id, tea_name, brew_temp, brew_time, infusions, dimensions(JSONB 八维), overall_score, process_factor, water_type, ware_id, aroma_type, notes, weather, mood

### garden_plants（茶园种植）
user_id, client_id, 状态（幂等 upsert 键 `user_id + client_id`）

## 3. 数据约束

| 约束 | 规则 |
|---|---|
| 幂等键 | `tasting_records` / `garden_plants`：`user_id + client_id` 唯一 |
| 工艺系数 | 0.8 - 1.2（越界视为数据异常） |
| 八维评分 | 各维度 0 - 100 |
| 软删除 | 引入时统一 `@SQLDelete` + `@SQLRestriction`（JPA）；VO 禁透出 `isDeleted` |
| 审计字段 | 统一 created_at / updated_at / created_by（`@MappedSuperclass`） |
| 金额 | `Integer`（分）；时间 `LocalDateTime` |

## 4. 迁移规则

- 🔴 Schema 变更只走 Flyway（目标）/ Alembic（过渡期），**禁生产 `ddl-auto: update`**。
- 🔴 迁移必须成对可回滚：`changes/{feat-name}/db-migrations.sql`（up）+ `rollback.sql`（down），upgrade/downgrade 往返测试通过才可提交。
- 🔴 禁手改已应用的历史迁移文件；追加新迁移。
- 🟢 大表变更（加列默认值 / 重建索引）评估锁表窗口，走预发验证。
- 🟢 索引命名 `ix_{table}_{col}`、唯一约束 `uk_{table}_{col}`、外键 `fk_{table}_{col}`，显式声明。

## 5. 数据规模目标

teas 200 / tea_regions 50 / tea_processes 6 / tea_people 100 / tea_poems 500 / teawares 50 / tea_etiquettes 20 / tea_relations 1000+

## 6. 文化数据纪律

- 🟢 茶叶分类按六大茶类，冲泡参数符合茶类常识（`tea-tasting` 基准表）。
- 🔴 不编造茶名 / 茶器 / 历史人物；不确定标 "待核实"；优先用 `src/data/` 已有数据。
