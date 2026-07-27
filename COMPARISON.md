# Master Prompt 对比分析：「一盏茶」现有项目 vs V2.0 Agent 调度指令

> 目标：取精华去糟粕，不推倒重做

---

## 一、视觉规范对比

| 维度 | 现有项目 | Master Prompt | 建议 |
|------|---------|---------------|------|
| 主色 | 木色 `#5D4E37`（暖棕）| 沉香暗木 `#1A1917`（深黑） | 🟡 **融合**：保留暖木色系，但可引入深色模式作为可选主题 |
| 背景 | 宣纸色 `#F5F0E8` | 深色 `#1A1917` + 玄武岩 `#24221F` | ⚠️ 现有浅色更符合东方茶室, 深色可做切换 |
| 强调色 | 茶金色 `#C9A96E` | 琥珀清茶 `#9E8050` | ✅ **采纳**：琥珀色更雅，可替换现有金色 |
| 字体 | Noto Serif SC | Noto Serif SC / Songti SC | ✅ **一致**，无需改动 |
| UI 禁忌 | - | 禁用硬边框、禁用 TabBar/Header | ✅ **采纳**：当前已符合 |
| 毛玻璃 | 无 | backdrop-blur-md | ✅ **采纳**：在弹窗/卡片中增加毛玻璃效果 |

**结论：** 配色方向不同（暖浅 vs 冷暗），不直接替换。建议保留现有暖色体系，把暗色调作为可切换主题。

---

## 二、项目结构对比

| Master Prompt 要求 | 现有项目 | 差距 |
|-------------------|---------|------|
| `views/TeaRoom.vue` | `views/HomeView.vue` | ✅ 已有类似，可改名 |
| `views/TeaSelect.vue` | `views/SelectView.vue` | ✅ 已有 |
| `views/ToolSelect.vue` | 内置在 BrewView IDLE 阶段 | 🟡 可拆分出独立页面 |
| `views/Water.vue` | 内置在 BrewView IDLE 阶段 | 🟡 可拆分 |
| `views/Brew.vue` | `views/BrewView.vue` | ✅ 已有 |
| `views/Taste.vue` | `views/TasteView.vue` | ✅ 已有 |
| `views/AI.vue` | ❌ 无 | 🔴 需新建（Phase 3） |
| `views/Diary.vue` | `views/HistoryView.vue` | 🟡 可改造为日记格式（已完成） |
| `components/visual/SteamEffect.vue` | `composables/useParticles.ts` | ✅ 功能已有，形式不同 |
| `components/ui/SoundManager.vue` | `composables/useAudio.ts` | ✅ 功能已有 |
| `components/visual/TeaSoup.vue` | `data/teas.ts` 中 interpolateColor | 🟡 可封装为组件 |
| `mock/data.ts` | 分散在 `data/teas.ts` + `data/teawares.ts` | 🟡 可重构为统一数据文件 |
| `types/index.ts` | 分散在 `types/tea.ts` + `types/teaware.ts` + `types/brewing.ts` + `types/tasting.ts` | ⚠️ 现有更模块化，不合并 |

**结论：** 不重构目录结构。现有结构工作良好，只需：
- 把 BrewView 的 IDLE 阶段拆分为独立页面（ToolSelect + Water 可选）
- 新增 AI.vue（Phase 3 时）
- 新增 Dockerfile（Phase 4 时）

---

## 三、数据模型对比

| Master Prompt 类型 | 现有对应 | 差异 |
|-------------------|---------|------|
| `Tea` (TeaCategory) | `Tea` (TeaType 枚举) | ✅ 类似，现有用中文枚举更直观 |
| `Tool` (zisha/gaiwan/glass) | `TeaWare` (TeaWareType) | ✅ 类似，现有 bonus 系统更丰富 |
| `Water` | 现有 `WATER_TYPES` 常量 | ✅ 现有更简洁 |
| `SensoryRating` (6维) | `TasteDimensions` (6维) | ✅ 一致（现有已加 rhyme=韵）|
| `BrewRecord` | `TastingRecord` | ⚠️ 现有缺 aiComment 字段 |

**采纳：** 在 TastingRecord 中增加 `aiComment` 字段（Phase 3 用）

---

## 四、Phase 1 对比（已有 ✅）

| Master Prompt 要求 | 现有状态 |
|-------------------|---------|
| Vite + Vue 3 + TS + Tailwind | ✅ 已配置 |
| 东方美学 Token 与衬线字体 | ✅ 已在 main.css |
| types/index.ts 接口 | ✅ 分散在 types/ 目录 |
| mock/data.ts 六大茶类数据 | ✅ 7 款茶 + 6 款茶器 |
| Pinia Store (useBrewStore) | ✅ useTeaStore |
| 沉浸首页 TeaRoom.vue | ✅ HomeView 已改造 |
| Canvas 粒子蒸汽特效 | ✅ useParticles.ts |
| Web Audio 音效 | ✅ useAudio.ts |
| 「入席」按钮 | ✅ 已实现 |

**结论：** Phase 1 已全部完成且超出要求。

---

## 五、Phase 2 对比

| Master Prompt 要求 | 现有状态 | 需要补 |
|-------------------|---------|--------|
| TeaSelect.vue 六大茶类 | ✅ SelectView 已有 | - |
| ToolSelect.vue 茶器属性 | ✅ 在 BrewView IDLE 阶段 | 🟡 可拆分独立页面 |
| Water.vue 水质选择 | ✅ 已添加 | - |
| 投茶→烧水→注水→浸泡→出汤 | ✅ 五步都已实现 | - |
| 水温与蒸汽粒子联动 | ✅ 已实装 | - |
| TeaSoup.vue 茶汤颜色演变 | ⚠️ 已有 interpolateColor | 🟡 可封装为组件 |

---

## 六、Phase 3 对比

| Master Prompt 要求 | 现有状态 | 需要补 |
|-------------------|---------|--------|
| 六感品鉴（观闻品韵形神） | ⚠️ 现有观色/闻香/品味/韵，缺"形(叶底)"和"神(心境)" | 🟡 扩展到 6 维 |
| AI 私人茶师诊断 | ❌ 无 | 🔴 需新建 AI.vue |
| 茶日记 Diary.vue | ✅ 已有 HistoryView 改造版 | - |

---

## 七、Phase 4 对比

| Master Prompt 要求 | 现有状态 | 需要补 |
|-------------------|---------|--------|
| 成长体系（4 级） | ✅ 茶修等级系统已完成 | - |
| Docker 容器化 | ❌ 无 | 🔴 需新建 Dockerfile + compose |

---

## 八、精华采纳清单

### ✅ 立即采纳（不需重写，直接融入）

| 采纳项 | 具体做法 | 预估工时 |
|--------|---------|---------|
| 毛玻璃效果 | 在弹窗/卡片中用 `backdrop-blur-md` | 0.5h |
| 琥珀色强调色 | 将 `--color-tea-gold` 从 `#C9A96E` 调为 `#9E8050` | 0.2h |
| 品鉴扩展到六感 | 加「形(叶底)」「神(心境)」2 个维度 | 1h |
| AirComment 字段 | TastingRecord 新增 aiComment | 0.2h |
| 封装 TeaSoup 组件 | 茶汤颜色展示独立为组件 | 1h |
| 封装 ToolSelect 独立页 | 从 BrewView 拆分 | 2h |

### 🟡 后续采纳

| 采纳项 | 时机 |
|--------|------|
| AI.vue 茶师诊断 | Phase 3（需 API Key）|
| Docker 容器化 | Phase 4（上线前）|
| 暗色主题 | 可选功能 |

### ❌ 不采纳

| 拒绝项 | 原因 |
|--------|------|
| 完全重构目录结构 | 现有结构工作良好，推倒重做浪费 |
| 合并所有 type 到 index.ts | 分散更模块化，有利于维护 |
| 深色调取代暖色调 | 茶室氛围需要暖色，非冷色 |
| 用 mock/data.ts 替换现有数据文件 | 现有数据更丰富（含故事、颜色插值等）|

---

## 九、建议继续做的事

按优先级排列：

1. 🟢 **品鉴扩展到六感**（加「形」「神」2 维）— 0.5 天
2. 🟢 **色值微调**（琥珀色替换茶金色）— 0.2 天
3. 🟢 **毛玻璃效果** — 0.5 天
4. 🟡 **封装独立组件**（TeaSoup + ToolSelect）— 2 天
5. 🔴 **AI 茶师**（需 API）— 3 天
6. 🔴 **Docker 部署** — 1 天
