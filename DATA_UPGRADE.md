# 「一盏茶」V2.0 数据文化底座升级方案

> 从"茶应用"到"中华茶文化知识系统"
> 基于 ChatGPT 深度分析 + 现有项目评估

---

## 一、核心判断

当前项目已完成 **产品骨架（70%）**，但本质仍是"业务数据库"而非"文化数据库"。

### 现状
```
teas（茶叶表，含 story 字段）
  ↓
直接展示
```

### 目标
```
teas → tea_regions → tea_people → tea_poems → tea_processes → tea_etiquette
  ↓        ↓            ↓            ↓            ↓               ↓
                         知识图谱 → 关联查询 → 文化展示
```

---

## 二、数据库结构升级（7 张核心表）

### 现有表（保留并升级）

| 表名 | 现有字段 | 新增字段 |
|------|---------|---------|
| `teas` | id, name, type, origin, story... | region_id, process_id, related_people_ids[], poem_ids[] |
| `teawares` | id, name, type, capacity... | origin, dynasty, craft, culture_story |
| `users` | id, username, level, xp | preferred_type, preferred_temp, preferred_aroma,常用茶器 |

### 新增表

#### 1. tea_regions（茶山产区）
```
id, name, province, latitude, longitude,
altitude_range, climate, soil_type,
famous_for, description, image_url
```
**数据量预估：** 中国 50+ 核心茶产区
**示例数据：** 西湖茶区（杭州，海拔50-200m，湿润气候，酸性土壤，代表：龙井）

#### 2. tea_processes（制茶工艺）
```
id, name, tea_type, steps[]
```
**steps 结构：**
```json
[
  {"step": 1, "name": "采摘", "description": "...", "duration": "2-3天"},
  {"step": 2, "name": "杀青", "description": "...", "temperature": "200°C"}
]
```
**数据量预估：** 6 大茶类 × 3-8 道工序
**用途：** 动态制茶工艺流程动画

#### 3. tea_people（茶人 — 已有，需扩展）
已有 8 位茶人。扩展至 30+ 位，覆盖更全的朝代和领域。

#### 4. tea_poems（茶诗词）— 强烈推荐
```
id, author, dynasty, title, content,
related_tea_ids[], related_person_id
```
**数据量预估：** 100-300 首经典茶诗
**用途：** 品鉴完成后随机推送，首页/茶席氛围展示

#### 5. tea_etiquette（茶礼）
```
id, name, description, steps[],
related_tea_type, occasion
```
**数据量预估：** 15-20 种茶礼
**示例：** 客来敬茶、工夫茶礼、宋代点茶、婚礼茶礼

### 关系表（知识图谱核心）

| 关系表 | 关联 | 示例 |
|--------|------|------|
| `tea_region_relation` | 茶 ↔ 产区 | 龙井↔西湖茶区 |
| `tea_person_relation` | 茶 ↔ 茶人 | 龙井↔乾隆 |
| `tea_poem_relation` | 茶 ↔ 诗词 | 龙井↔苏轼诗 |
| `tea_ware_relation` | 茶 ↔ 推荐茶器 | 龙井↔玻璃杯 |

---

## 三、实施路线（4 个 Sprint）

### Sprint 1：数据结构 + 现有数据升级（1 周）

```
src/data/
├── teas.ts              ← 添加 region_id, process_id 关联
├── teawares.ts          ← 添加 origin, dynasty, craft, culture_story
├── teaMasters.ts        ← 已有，扩展到 30+ 人
├── teaRegions.ts        ← 新增：50+ 核心产区
├── teaProcesses.ts      ← 新增：6 大茶类工艺步骤
├── teaPoems.ts          ← 新增：100 首经典茶诗
└── teaEtiquette.ts      ← 新增：15 种茶礼
```

**纯前端数据文件，不依赖后端。** 全部是 TypeScript 静态数据。

### Sprint 2：知识图谱关联 + 展示层（1 周）

- 建立茶 → 产区 → 茶人 → 诗词的交叉关联
- 茶叶详情页升级：展示产区地图标注（CSS/SVG）、相关茶人卡片、相关诗词、制茶工艺步骤
- 品鉴完成随机推送相关诗词
- 搜索功能（前端过滤）

### Sprint 3：AI+RAG 升级（1 周）

- 将知识库数据作为 prompt 上下文注入 LLM
- AI 茶师回答不再凭空生成，而是基于真实数据
- 示例：用户问"建盏"，AI 检索建盏数据+宋代点茶资料后再回答

### Sprint 4：后端迁移（2 周）

- 将前端数据文件同步为 PostgreSQL 表
- 建立 REST API
- 前端通过 API 获取数据（渐进式，不阻塞）

---

## 四、建议立即开始 Sprint 1

### Sprint 1 具体任务

| # | 任务 | 预估数据量 | 工时 |
|---|------|-----------|------|
| 1 | teaRegions.ts：50+ 核心茶产区 | 50 条 | 2 天 |
| 2 | teaProcesses.ts：6 大茶类工艺 | 6 × 5-8 步 | 1 天 |
| 3 | teaMasters.ts 扩展到 30+ 人 | 30 条 | 1 天 |
| 4 | teaPoems.ts：100 首茶诗 | 100 条 | 2 天 |
| 5 | teaEtiquette.ts：15 种茶礼 | 15 条 | 0.5 天 |
| 6 | 数据关联：茶↔产区↔人↔诗 | 全部 | 1 天 |

**Sprint 1 总计：约 7-8 天**

---

## 五、技术说明

### 为什么不直接上 PostgreSQL？
当前项目无需后端即可运行（前端数据文件 + localStorage）。新增的数据文件全部是静态 TypeScript 数组，零成本维护，未来可平滑迁移到数据库。

### 数据来源建议
- 产区数据：Wikipedia + 中国茶地理书籍
- 诗词数据：全唐诗/全宋词公开数据集
- 茶人数据：中国茶文化史料
- 茶礼数据：茶道典籍

### 架构演进
```
Phase 1: src/data/*.ts（纯前端）
  ↓
Phase 2: src/data/*.ts + API 同步（混合模式）
  ↓
Phase 3: PostgreSQL + API Only（全后端）
```
