---
name: design-md-collection
description: 74 个真实网站的 DESIGN.md 设计系统参考库（来自 VoltAgent/awesome-design-md，Google Stitch DESIGN.md 格式）。涵盖 AI 平台 / 开发者工具 / SaaS / 设计工具 / 金融 / 电商 / 媒体 / 汽车 / 复古网页 9 大类，每个品牌含完整配色（hex + 角色）、字体层级、组件样式、布局原则、阴影体系、Do/Don't。当需要参考某品牌设计语言做视觉方向、抄配色/字体/组件规范、对比主流设计系统、为「一盏茶」找反主流参考或竞品 UI 分析时使用；说"像 Stripe 那样"/"参考 Linear 风格"/"Vercel 黑白精度"时按品牌名读 brands/<name>/DESIGN.md。
---

# Design MD Collection（74 个真实网站设计系统）

来源：https://github.com/VoltAgent/awesome-design-md （118k star，MIT）
格式：Google Stitch DESIGN.md —— 纯 Markdown，LLM 直接可读，无 Figma/JSON 依赖。

## 怎么用

1. 按受众和 vibe 选品牌（不要凭名字猜，先读对应 DESIGN.md 的 Visual Theme & Atmosphere 一节确认调性）。
2. 读 `brands/<name>/DESIGN.md`，提取：色板 hex + 角色、字体族 + 层级表、按钮/卡片/输入框样式、间距 scale、阴影、Do/Don't。
3. 在「一盏茶」项目里落地时，按 AGENTS.md 前端设计禁令二次过滤——这个库是参考语料，不是直接复制。尤其注意：
   - 库里 SaaS/科技品牌多为暗色 + 紫/蓝强调色，一盏茶是东方茶文化，**配色必须转译**，不能照抄。
   - 字体以 Geist / Inter / SF Pro 为主，一盏茶用衬线标题时另选。
   - shadcn 类组件规范只借鉴布局与状态，不引入 React 组件。

## 品牌索引（按类别）

### AI 与 LLM 平台
claude / cohere / minimax / mistral / ollama / opencode / replicate / runway / together / voltagent / xai

### 开发者工具与 IDE
cursor / expo / lovable / raycast / superhuman / vercel / warp

### 后端 / 数据库 / DevOps
clickhouse / composio / hashicorp / mongodb / posthog / sanity / sentry / supabase

### 生产力与 SaaS
cal / intercom / linear / mintlify / notion / resend / zapier

### 设计与创意工具
airtable / clay / figma / framer / miro / webflow

### 金融与加密
binance / coinbase / kraken / mastercard / revolut / stripe / wise

### 电商与零售
airbnb / meta / nike / shopify / starbucks

### 媒体与消费电子
apple / hp / ibm / nvidia / pinterest / playstation / spacex / spotify / the-verge / uber / vodafone / wired

### 汽车
bmw / bmw-m / bugatti / ferrari / lamborghini / renault / tesla

### 复古网页（90s-00s 怀旧）
dell-1996 / nintendo-2001

## 每个 DESIGN.md 的固定结构

1. Visual Theme & Atmosphere（氛围、密度、设计哲学）
2. Color Palette & Roles（语义名 + hex + 功能角色）
3. Typography Rules（字体族 + 完整层级表）
4. Component Stylings（按钮/卡片/输入框/导航，含状态）
5. Layout Principles（间距 scale、网格、留白哲学）
6. Depth & Elevation（阴影体系、表面层级）
7. Do's and Don'ts（设计护栏与反模式）
8. Responsive Behavior（断点、触控目标、折叠策略）
9. Agent Prompt Guide（快速色板 + 可直接复用的 prompt）

## 一盏茶场景下最值得读的几个

- **notion**：暖色极简、衬线标题、柔和表面 —— 最接近茶文化"安静温润"的调性。
- **stripe**：紫色渐变 + weight-300 优雅 —— 学精致排版，不抄配色。
- **apple**：大量留白、SF Pro、电影感 imagery —— 学 3D 茶空间的呼吸感。
- **starbucks**：四级大地绿 + 暖米色画布 + 专属字体 —— 同属饮品/大地色系，转译参考价值最高。
- **clay**：有机形状、柔渐变、art-directed 布局 —— 反主流参考。
- **wired**：报纸密度、定制衬线、墨蓝链接 —— 学文化内容排版。
- **runway**：暗黑电影感 hero + 纸白阅读带 + 纯黑 pill CTA —— 学单页节奏。
