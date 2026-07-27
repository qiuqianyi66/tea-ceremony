# 「一盏茶」V2.0 数据库设计 ER 图

## 核心表结构

### 1. teas（茶叶主表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| name | VARCHAR(100) | 茶名 |
| category | VARCHAR(20) | 茶类（绿茶/白茶/黄茶/青茶/红茶/黑茶）|
| origin | VARCHAR(200) | 产地 |
| region_id | INT FK→regions | 关联产区 |
| process_id | INT FK→processes | 关联工艺 |
| season | VARCHAR(20) | 采摘季节（明前/雨前/秋茶等）|
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

### 2. tea_regions（茶山产区）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| name | VARCHAR(100) | 产区名 |
| province | VARCHAR(50) | 省份 |
| latitude | FLOAT | 纬度 |
| longitude | FLOAT | 经度 |
| altitude | VARCHAR(50) | 海拔范围 |
| climate | VARCHAR(200) | 气候 |
| soil | VARCHAR(200) | 土壤 |
| history | TEXT | 历史 |
| famous_for | JSONB | 代表茶 |

### 3. tea_processes（制茶工艺）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| tea_category | VARCHAR(20) | 适用茶类 |
| name | VARCHAR(100) | 工艺名 |
| summary | TEXT | 概述 |
| steps | JSONB | 步骤数组[{order, name, desc, duration, temp}] |

### 4. tea_people（茶人历史）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| name | VARCHAR(100) | 姓名 |
| dynasty | VARCHAR(50) | 朝代 |
| title | VARCHAR(100) | 称号 |
| identity | VARCHAR(100) | 身份 |
| description | TEXT | 简介 |
| contribution | TEXT | 贡献 |
| quote | TEXT | 名言 |
| related_tea_ids | JSONB | 关联茶 ID |

### 5. tea_poems（茶诗词）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| title | VARCHAR(200) | 作品名 |
| author | VARCHAR(100) | 作者 |
| dynasty | VARCHAR(50) | 朝代 |
| content | TEXT | 内容 |
| related_tea_ids | JSONB | 关联茶 |
| description | TEXT | 文化背景 |

### 6. teawares（茶器 — 升级版）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| name | VARCHAR(100) | 名称 |
| ware_type | VARCHAR(20) | 类型 |
| material | VARCHAR(100) | 材质 |
| capacity | INT | 容量 |
| origin | VARCHAR(100) | 产地 |
| dynasty | VARCHAR(50) | 年代 |
| craft | VARCHAR(200) | 制作工艺 |
| description | TEXT | 描述 |
| culture_story | TEXT | 文化故事 |
| bonus | JSONB | 游戏加成属性 |
| recommended | JSONB | 推荐茶类 |
| rarity | VARCHAR(20) | 稀有度 |

### 7. tea_etiquettes（茶礼）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| name | VARCHAR(100) | 礼名 |
| occasion | VARCHAR(100) | 场合 |
| description | TEXT | 描述 |
| steps | JSONB | 步骤数组 |

### 8. tea_relations（知识图谱关系）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| source_type | VARCHAR(50) | 源类型（tea/person/poem/region）|
| source_id | INT | 源 ID |
| target_type | VARCHAR(50) | 目标类型 |
| target_id | INT | 目标 ID |
| relation | VARCHAR(100) | 关系描述 |

### 9. users（用户 — 升级版）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| username | VARCHAR(50) UNIQUE | |
| display_name | VARCHAR(100) | |
| level | INT | 茶修等级 |
| xp | INT | 经验值 |
| preferred_type | VARCHAR(20) | 偏好茶类 |
| preferred_temp | INT | 偏好水温 |
| preferred_aroma | JSONB | 偏好香型 |
| preferred_ware_id | INT | 常用茶器 |

### 10. tasting_records（品鉴记录 — 升级版）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL PK | |
| user_id | INT FK | |
| tea_id | VARCHAR(50) | |
| tea_name | VARCHAR(100) | |
| brew_temp | INT | |
| brew_time | INT | |
| infusions | INT | |
| dimensions | JSONB | 八维评分 |
| overall_score | FLOAT | |
| process_factor | FLOAT | |
| water_type | VARCHAR(20) | |
| ware_id | INT | |
| aroma_type | VARCHAR(50) | |
| notes | TEXT | |
| weather | VARCHAR(50) | |
| mood | VARCHAR(50) | |

## 表关系图

```
  tea_regions ←── teas ──→ tea_processes
       ↑            |             ↑
       |            |             |
  tea_relations ←───┼───→ tea_people
       |            |             |
       ↓            ↓             ↓
  tea_poems     teawares    tea_etiquettes
  
  users ──→ tasting_records ──→ teas
```

## 数据规模目标

| 表 | 第一版目标 |
|----|-----------|
| teas | 200 款 |
| tea_regions | 50 个 |
| tea_processes | 6 类 |
| tea_people | 100 位 |
| tea_poems | 500 首 |
| teawares | 50 件 |
| tea_etiquettes | 20 种 |
| tea_relations | 1000+ 条关系 |
