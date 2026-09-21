# Good First Issues 内容包

> 在 GitHub → Issues → New issue 逐条新建。标签建议：`good first issue`、`help wanted`。
> 每条都给了标题和正文模板，复制粘贴即可。

---

## Issue 1：扩充三款中国名茶进茶单

**标题**：`[good first issue] 扩充茶单：加入凤凰单丛 / 君山银针 / 六安瓜片`

**正文**：

```
## 背景

当前 `src/data/teas.ts` 收录 40 款茶，六大茶类基本覆盖，但以下三款名茶长期缺位：

- 凤凰单丛（乌龙茶·广东潮州）
- 君山银针（黄茶·湖南岳阳）
- 六安瓜片（绿茶·安徽六安）

## 要做什么

1. 在 `src/data/teas.ts` 中按现有类型补充三款茶的完整字段：
   - name / pinyin / category（枚举内）
   - origin / flavorNotes / recommendedTeaware
   - brewingParams（水温、投茶量、建议浸泡时间——必须符合茶类常识）
2. 在 `src/data/teaProcesses.ts` 或对应位置补推荐茶器
3. 跑 `npm run test`，如已有茶单快照测试需同步更新
4. 如产区地图 `src/data/teaRegions.ts` 需要新产区，一并补

## 验收

- `npm run type-check` 通过
- `npm run test` 通过
- 三款茶在「选茶」页能正常显示，点进去有完整冲泡参数
- 茶类词 ∈ TeaType 枚举（参考 `src/types/`）

## 参考

现有茶款结构见 `src/data/teas.ts` 任意一条。茶文化事实不确定时标「待核实」，不要编。
```

---

## Issue 2：界面文案 i18n——首批三个页面抽离

**标题**：`[good first issue] i18n：首批把首页/选茶/冲泡页中文文案抽离到语言文件`

**正文**：

```
## 背景

README 已有英文版，但 Vue 组件里的中文文案目前是硬编码。
需要建立 i18n 基建，先选三个页面试点。

## 要做什么

1. 引入 vue-i18n（如未引入），建立 `src/i18n/zh-CN.ts` 和 `src/i18n/en-US.ts`
2. 把以下三个页面的硬编码中文抽出来：
   - `src/views/home/`（沉浸式首页）
   - 选茶页
   - 冲泡页
3. 不要动 3D 场景组件（`src/components/three/` 只做视觉层，见 3D_SPEC.md）

## 验收

- 切换语言后三个页面文案全部正确
- `npm run type-check` 通过
- `npm run build` 通过
- 不引入新依赖之外的其他架构改动

## 参考

AGENTS.md「前端」节：Composition API + `<script setup lang="ts">`，禁 any。
```

---

## Issue 3：评分模型单元测试补边界用例

**标题**：`[good first issue] test：补评分工艺系数的边界用例`

**正文**：

```
## 背景

`src/services/` 里的评分模型（八维口感 × 冲泡工艺系数）是项目核心可解释逻辑，
现有单测覆盖了正常路径，但边界值和异常输入没测。

## 要做什么

1. 阅读现有评分相关 spec（`*.spec.ts`），保持同样风格
2. 补充：
   - 水温 0°C / 100°C 边界
   - 浸泡时间 0 / 极长（如 600s）
   - 投茶量 0 / 远超推荐量
   - 八维评分全 0 / 全满分
   - 非法输入（NaN、负数、字符串）的容错
3. 用 fake-indexeddb，不依赖浏览器 API

## 验收

- 新增用例全部通过
- `npm run test` 全绿
- 测试只走公共接口，不 mock 内部协作者
```

---

## Issue 4：茶器占位图标换成 Iconify

**标题**：`[good first issue] design：茶器图标从占位符换成 Iconify 矢量图标`

**正文**：

```
## 背景

`src/data/teawares.ts` 中部分茶器（盖碗、紫砂壶、品茗杯、煮水壶等）用的是占位图标。
项目图标统一走 Iconify，strokeWidth 一致。

## 要做什么

1. 在 Iconify 找一套风格统一的茶具/器物图标（推荐 `mdi` 或 `ph` 系列）
2. 替换 `src/data/teawares.ts` 中的占位
3. 在茶器选择页和茶席场景确认显示正常
4. 不要手绘 SVG 路径，不要混用多套图标库

## 验收

- 茶器选择页所有图标矢量显示清晰
- 移动端触控目标 ≥ 44px
- `npm run build` 通过

## 参考

AGENTS.md「前端设计·工程规范」：图标一个库一个家族（Iconify 统一 strokeWidth）。
```

---

## Issue 5：PWA 离线 fallback 页

**标题**：`[good first issue] pwa：补充离线 fallback 页和导航失败提示`

**正文**：

```
## 背景

项目是 PWA，离线优先。但当前断网访问未缓存路由时，浏览器会显示默认离线错误。
需要一个友好的 fallback 页，告诉用户「当前离线，已缓存的茶席仍可用」。

## 要做什么

1. 在 vite-plugin-pwa 配置中补充 offline fallback
2. 设计一个简洁的离线提示页：茶杯图标 + 「当前离线，已缓存的内容仍可使用」
3. 保留现有 service worker 缓存策略，不改运行时缓存规则
4. 在手机 Chrome / Safari 真机验证一次

## 验收

- 断网访问未缓存路由不显示浏览器默认错误页
- 已缓存的首页和冲泡流程离线可走通
- `npm run build` 通过

## 参考

vite-plugin-pwa 已配置，见 `vite.config.ts`。
```

---

## Issue 6：补英文 README 中缺失的本地运行截图

**标题**：`[good first issue] docs：补 README 中提到但缺失的截图`

**正文**：

```
## 背景

新 README 引用了以下截图路径，需确认都存在：

- docs/screenshots/home.jpg
- docs/screenshots/brew-3d-steeping.png
- docs/screenshots/share.png
- docs/screenshots/select.png
- docs/screenshots/brew-3d-done.png
- docs/screenshots/growth-desktop.png

## 要做什么

1. 跑 `npm run dev`，按 README 顺序走一遍流程
2. 对缺失的截图重新截图（1200px 宽以内，JPEG 质量 80 左右）
3. 保存到对应路径
4. 本地 `grip README.md` 或直接 push 后在 GitHub 预览确认图都能加载

## 验收

- README 中所有图片链接 200
- 截图不超 500KB/张（首页图已压过，别压成糊图）
- 不修改截图内容（不要在图上加箭头/文字说明）
```

---

## 提交建议

- 6 个 issue 都打上 `good first issue` 和 `help wanted`
- Issue 1、3、6 最适合新手，置顶推荐
- 收到 PR 后按 AGENTS.md 的 CI 门禁走：type-check + test + build
