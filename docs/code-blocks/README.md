---
last_updated: 2026-11-02
status: active
owner: yanha
---

# 代码块库

解决「每次开新文件都要重推项目约定」的问题：把高频骨架固化成可复制的代码块，并在 VS Code 里用前缀直接展开。

## 这是什么

`docs/code-blocks/` 是「一盏茶」的骨架样板库。每个文件对应一类产出物：Vue 组件、composable、Pinia store、service、utils、测试、图表。

代码块里的颜色、圆角、触控尺寸、导入方式都按项目现有实现写，复制后只需替换业务字段。

配套的 `.vscode/tea.code-snippets` 收录同一批骨架，输入前缀即可展开，tabstop 逐项跳转填写。

## 怎么用

**路径一：复制**。打开对应 md，整块复制，改业务名与文案。

**路径二：VS Code 片段**。在 `.vue` / `.ts` 文件里输入前缀，回车展开，`Tab` 逐个跳字段。

| 前缀 | 展开内容 | 适用文件 |
|------|---------|---------|
| `tea-vue` | Vue 组件骨架（props + 令牌类） | `.vue` |
| `tea-vue-ui` | 五态按钮（disabled / loading / error） | `.vue` |
| `tea-composable` | composable 骨架（ref/computed + 清理） | `.ts` |
| `tea-store` | Pinia setup store（三区 + 返回对象） | `.ts` |
| `tea-service` | service 纯函数（显式返回类型） | `.ts` |
| `tea-util` | 工具函数 + JSDoc | `.ts` |
| `tea-test` | Vitest 单测（AAA + 边界 + vi.fn） | `.spec.ts` |
| `tea-test-component` | 组件测试（mount + props 断言） | `.spec.ts` |
| `tea-test-timers` | 假定时器测试（debounce / throttle） | `.spec.ts` |
| `tea-echarts` | ECharts 初始化 + resize + dispose | `.vue` |

片段文件是 JSONC：允许 `//` 注释，VS Code 直接解析。它被 biome 忽略（`biome.json` 的 `files.includes` 排除 `**/.vscode`），不参与 lint。

## 文件清单

| 文件 | 场景 | 关键片段数 |
|------|------|-----------|
| [vue-component.md](vue-component.md) | 新建页面 / 组件、props 与 emits、五态、空态、令牌用法、禁则 | 4 |
| [composables.md](composables.md) | 抽复用逻辑、ref/computed 组合、定时器与监听清理 | 4 |
| [pinia-store.md](pinia-store.md) | 跨页面状态、setup store 分区、`storeToRefs`、异步 action 错误收口 | 3 |
| [services.md](services.md) | 纯函数计算、存储降级、契约抛错、`@/` 别名与类型收窄 | 4 |
| [utils.md](utils.md) | `src/utils/` 落位与 JSDoc 规范、防抖、现有导出清单 | 4 |
| [testing.md](testing.md) | Vitest 单测 AAA、边界与假定时器、组件 mount | 3 |
| [echarts.md](echarts.md) | 图表组件全流程、数据更新、令牌配色、易错点 | 2 |

合计 24 个代码块、10 个 VS Code 片段。

## 与规范的关系

- 设计令牌与组件规则：`DESIGN_SPEC.md` 三 / 五节。
- 改动纪律与前端规范：`AGENTS.md` 第 5 / 6 节。
- 五态按钮的权威实现：`src/components/ui/BaseButton.vue`。
- 测试环境与全局 stub：`vitest.config.ts` + `src/test/setup.ts`。

样板只示范写法，不替代读源码。骨架与真实组件冲突时以源码为准，并回来改本文档。

## 维护约定

1. 每份 md 必须有 frontmatter：`last_updated` / `status` / `owner`，`status` 只取 `active` / `draft` / `deprecated`。
2. 每个 md ≤200 行；超了先拆文件，不删关键示例。
3. 代码块必须可直接运行：不留 TODO、不写伪代码、不编造不存在的模块路径。
4. 新增骨架时同步改两处：本目录的 md + `.vscode/tea.code-snippets`，前缀统一 `tea-` 开头。
5. 改 `src/` 下的约定（令牌、目录、测试命令）后，回来更新对应 md 的 `last_updated`。
