# project-audit-2026-10-24 变更记录

> 目录：`.harness/changes/project-audit-2026-10-24/`，与分支 `chore/project-audit-2026-10-24` 对应。
> **无数据库迁移**（纯算法与静态资源改动，未触任何表结构），故不建 db-migrations.sql / rollback.sql。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | project-audit-2026-10-24（项目审计 + 算法加深 + 静态资源瘦身） |
| 分支 | `chore/project-audit-2026-10-24`（基于 main ab8a726） |
| 需求来源 | 用户 2026-10-24 会话指令：过项目现状 + 能做的优化 + 算法加深 |
| 类型 | perf / refactor（推荐排序 + RAG 召回 + 地图数据瘦身） |
| 涉及范围 | 前端（推荐服务 / 地图数据）+ 后端（文化检索切词）+ scripts（新增瘦身脚本） |

## 二、变更明细

### 1. 推荐算法：getSimilarTeas 零相似度 → 双因子排序

- 现状（实测）：`src/services/teaRecommend.ts` 同类型过滤后**按数据顺序**取前 3，无相似度计算；
  实测数据下 longjing 的首位推荐是 biluochun（风味零重合），而风味全同的 shifeng_lj 排在后位。
- 改动：风味标签 Jaccard 降序 → 冲泡水温接近度降序（与 scoring.ts 工艺系数同 30°C 刻度）→ 数据顺序（稳定排序）。
- 验证：TDD，`src/services/__tests__/teaRecommend.spec.ts` 8/8（含新增排序契约断言）。

### 2. RAG 召回：splitKeywords 扩表 + bigram 补充

- 现状（实测）："怎样"不在切分表 → "怎样冲泡普洱熟茶" 整句一个 token → ILIKE 必 miss；
  长句切出的 ≥4 字整词（如"冲泡普洱熟茶"）同样易 miss。
- 改动：`CultureSearchService.splitKeywords`（private 实例 → 包级静态，可纯函数单测）：
  ①切分表补 怎样/哪里/多少/请问/介绍/推荐/讲讲/说说；②≥4 字 token 追加非重叠 2 字切片
  （奇数长度补尾部一片），整词在前切片在后；③总量上限 MAX_KEYWORDS=12 约束 OR 子句规模。
- 验证：新增 `CultureSearchKeywordsTest` 纯函数单测 7/7（不依赖容器）；
  `CultureSearch*` 集成测试 25/25（Testcontainers 真 PG）；
  `CultureSearchVectorBranchIntegrationTest` 断言位置无关化（bigram 后 ILIKE 可命中，契约仍为 ILIKE 优先、向量补位）。
- 已知限制：垃圾切片（如"明如"）可能挤占 ILIKE 前 5 位（命中排序/词组优先级未做），ragHitRate 计量口径不受影响。

### 3. china-map.json 瘦身

- 现状（实测）：981KB 原始 GeoJSON，/map 路由访问时全量下载。
- 改动：新增 `scripts/slim-china-map.cjs`（幂等）：坐标精度裁到 3 位小数（~100m，省级缩放级别无损）
  + 相邻重复点合并。产物 981KB → 413KB（-58%），features 35 与几何类型不变。
- 验证：重跑幂等（413KB → 413KB，merged 0）；/map 页改前/改后截图视觉一致（.tmp/tea-audit-1024-2030/）。

## 三、验收标准（Given-When-Then）

- **Given** 用户在茶详情页查看同类型推荐，**When** 当前茶存在风味标签完全相同的同类茶，**Then** 该茶排第一。
- **Given** RAG 检索收到含"怎样/请问"等问句引导词的长问句，**When** splitKeywords 切分，**Then** 产出整词 + bigram 关键词集（≤12 个），ILIKE 可命中实体片段。
- **Given** 访问 /map，**When** 加载 china-map.json，**Then** 下载体积 ≤420KB 且渲染视觉与瘦身前一致。
