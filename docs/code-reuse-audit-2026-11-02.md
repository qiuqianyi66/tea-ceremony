---
last_updated: 2026-11-02
status: active
owner: yanha
---

# 代码复用体检报告 — 全项目扫描与收敛（2026-11-02）

> 对 `src/` 全量扫描后做的一次收敛。目标不是"多建几个工具"，而是**把已经在项目里重复三遍以上的东西收敛到单一实现**。
> 扫描脚本：`node <tmp>/recon.cjs`（统计 class 串重复、组件采纳率、内联工具模式），前后各跑一次。

## 一、结论

复用率低的根因不是缺工具，是**已有工具没人用**。改动前 `SectionHeader` 只被 2 个文件引用，而同样的分区标题被手写了 10 处。本次把 21 处手写面板、10 处手写标题、5 处本地化日期、21 处手写数值夹取全部收敛到既有/新增的单一实现，并逐点保持观感与语义不变。

## 二、前后实测数字

| 指标 | 改动前 | 改动后 | 说明 |
|---|---|---|---|
| 重复 class 串（去重后） | 94 种 | 90 种 | `glass-panel rounded-xl p-4` 21 处 → 0；`text-base font-bold … mb-3` 10 处 → 0 |
| `SectionHeader` 采纳 | 2 文件 | 6 文件 | 新增 10 个调用点（图标尺寸逐处保持原值，见 §三.3） |
| 内联 `toLocaleDateString()` | 5 处 / 4 文件 | 1 处 / 1 文件 | 剩余 1 处是 `utils/format.ts` 自身的文档字符串 |
| 手写 `Math.min/max` 夹取 | 21 处 / 13 文件 | 2 处 / 1 文件 | 剩余 2 处是 `utils/math.ts` 自身定义 |
| 重复 `glass-panel rounded-xl p-4` | 21 处 | 0 处 | 全部收敛到 `<Card flat>` |
| 测试规模 | 41 文件 / 350 用例 | 43 文件 / 380 用例 | 新增 `math.spec.ts` 10 条、`formatDateShort` 3 条 |

## 三、本次收敛的四类

### 1. 数值夹取 → `src/utils/math.ts`
`clamp(value, min, max)` / `clamp01(value)` / `lerp(from, to, t)`。21 处替换分布在 12 个文件：composables（useAudio / useBrewAnimation / useParticles / useBrewPourGesture / useBrewPresentation）、services（garden / scoring / telemetry config）、stores/brew、components（TeaDragDrop / TeaBrewSceneInner）、views/TeaBreakView。

等价性不靠推理断言，用数值网格实测了 3 处非标准形状：
- `useBrewAnimation:85` 的 `clamp(drag, targets.pourWater, 1)`：168 个网格点差异 0
- 两处"只有上界"的 `Math.min(1, temp/target)` 改 `clamp01`：差异点 1160 个**全部落在 temp<0**，而 `currentTemp` 唯一写入路径（`brew.ts` 的 `updateTemp`，只做 `Math.min`，初值 20）保证恒 ≥20，负值不可达

### 2. 毛玻璃面板 → `<Card flat>`（`src/components/ui/BaseCard.vue`）
21 处替换分布在 10 个文件。`flat` 去掉阴影以对齐历史面板观感（历史面板本来无阴影）；`padding` 的 `md` 档定为 `p-4` 以精确匹配被替换处的档位，因此替换不改观感。

### 3. 分区标题 → `<SectionHeader>`（`src/components/ui/SectionHeader.vue`）
10 处替换分布在 4 个视图。新增三个 prop 使替换零观感变化：
- `size="base"` → `text-base`（一级分区保持 `text-lg`）
- `:level="3"` → 保持原 `<h3>`，不与 `PageHeader` 的 `<h2>` 跳级
- `iconSize`（`sm` / `md` / `inherit`）→ 默认跟随 `size`（lg→20px、base→16px）。
  **`inherit` 不写尺寸类**，用于原手写处本就没写 `w-N` 的情况——ToolSelect 4 处原本是
  `class="inline-block -mt-1"`（lucide 默认 24px），若强制 16px 会把图标改小（本项回归
  由带状态视觉回归发现并于 PR #203 修复，见 §五）

各视图原手写图标尺寸并不统一，替换前逐处 grep 过：
CollectionView / TeaGraph / TeaProfile 为 `w-4 h-4`（16px），ToolSelect 为无尺寸类（24px）。

### 4. 本地化日期 → `formatDateShort()`（`src/utils/format.ts`）
5 处替换分布在 4 个文件。原 `toLocaleDateString()` 输出随运行时 locale 变，既不可测也不可控；`formatDateShort` 用本地 getter 输出 `2026/11/2`，与 zh-CN 下原输出一致但确定性。

## 四、有意保留不动的（避免"为复用而复用"）

| 位置 | 原因 |
|---|---|
| `text-xs text-[var(--color-wood-light)]` 36 处 | 这是 Tailwind 的常规写法，抽象成组件/类只会多一层跳转，不减认知负担 |
| `rounded-full bg-white/60 px-3 py-1` 10 处（TastingCard / TeaKnowledgeCard 标签胶囊） | `Badge` 是印章 `rounded-sm`，换成它会改形状；胶囊是另一种视觉语义 |
| 手写空态 3 处（TeaProfile 近期茶记等） | `EmptyState` 会加一个叶片图标，结构不同，替换会改观感 |
| `rounded-2xl` 面板 5 处（MapView 茶山卡 / TasteProfileSection / TeaGraph / TeaProfile 当前境界） | `Card` 固定 `rounded-xl`；圆角档不等价 |
| `p-6` / `p-5` 面板 2 处（GrowthView 概览卡 / MapView） | `Card` 的 `padding` 档为 none/p-3/p-4/p-8，无 p-5/p-6 档 |
| 动态条件面板 2 处（CollectionView 茶图鉴卡 / 节气格） | `:class="cond ? 'glass-panel' : 'bg-white/40 …'"`，静态类串不含完整面板模式，替换要动条件逻辑 |
| `clearTimeout` 25 处 | 全部是时序编排（播放排程、请求超时、rAF 帧调度），不是防抖节流；硬套 `debounce` 会改语义 |
| `localStorage` 直用 20 处 / 6 文件 | 这些文件本身就是存储层（authStorage / db / telemetry identity / theme），再包一层只是加跳转 |
| `src/utils/debounce.ts` / `throttle.ts` | 全项目当前无真防抖需求（见上一行）。留作后续可用 API，不为"显得有用"而硬套 |

## 五、已知风险与未覆盖

- **组件采纳：2 有 / 5 无**（实测 grep，排除 `components/ui/` 自身）：`Card`、`SectionHeader` 已被业务引用；`BaseButton` / `BaseBadge` / `BaseTooltip` / `BaseModal` / `BaseTabs` 仍 **0 处引用**，等首个真实调用方。
- **utils 采纳：2 有 / 7 无**（实测 grep，排除 `src/utils/` 自身）：`math` 12 处（clamp / clamp01）、`format` 4 处（formatDateShort）；`debounce` / `throttle` / `storage` / `string` / `array` / `url` / `type-guards` 仍 **0 处引用**。其中 `debounce` / `throttle` 是全项目当前确实没有真防抖需求（§四已论证），不是遗漏。
- **视图层视觉回归已做，且抓到一处真实回归**：改动前（`978ad76`）与当前各构建一套产物，同一 Chromium / 1280 宽 / zh-CN / reduced-motion 下 fullPage 截图逐像素比对。
  - 默认无状态 8 个路由（`/collection` `/growth` `/map` `/taste` `/graph` `/profile` `/tools` `/history`）：全部 `IDENTICAL 0.0000%`
  - 带状态 2 个页面（先选茶再进 `/tools`；`/graph` 下拉选茶让「文化关联」渲染）：全部 `IDENTICAL 0.0000%`
  - **首轮「8 页全绿」是假绿**：`/tools` 有 `requiresTea` 守卫，无茶态被重定向到 `/select`，那 4 个标题根本没渲染。带状态复跑才暴露 ToolSelect 图标 24px→16px 回归，已由 PR #203 修复（SectionHeader 增 `iconSize="inherit"`）
- **仍未覆盖**：条件渲染的空态 / 错误态分支未做视觉对比；`npm run test` 的 4 个 views spec 不覆盖本次改动的视图，`build` 只能证明可编译。
- **`TastingCard.vue` 有混合行尾**（主体 LF 76 行 CRLF + 尾部 `<style>` 块）。本次改动用字节级写入保持最小 diff（3 增 / 6 删）。后续编辑请注意：常规编辑工具会把 CRLF 归一成 LF，产生 78/81 假 diff（判据：`git diff -w --numstat` 只显示 3/6 即为空白噪声）。仓库无 `.gitattributes`，本次未加（全库规范化会产生巨量 diff，需单独决策）。

## 六、后续建议（未做，留给下一轮）

1. `Badge` 增加 `pill` 变体后收掉 10 处标签胶囊（需要先拍板视觉）。
2. `Card` 增加 `radius` 档（`xl` / `2xl`）后收掉 5 处 `rounded-2xl` 面板。
3. 给 `Collection/Growth/Map/Taste/TeaGraph/Profile/Tools/History` 八个视图补最小渲染测试（mount 后断言面板与标题存在），否则这类重构只能靠人眼回归。
