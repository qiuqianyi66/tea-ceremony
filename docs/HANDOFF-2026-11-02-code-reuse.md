---
name: handoff-2026-11-02-code-reuse
description: 代码复用体系交接（组件库 / utils / 代码块 / 提示词模板技能族）；四件交付物已于 2026-11-08 复核全部落地。
status: archived
date: 2026-11-02
last_updated: 2026-11-08
owner: yanha
---

# HANDOFF-2026-11-02 — 代码复用体系（组件库 / utils / 代码块 / 提示词模板技能）

> **2026-11-08 复核（归档，勿重做）**：四件交付物全部在位 —— `src/utils/`、`.vscode/tea.code-snippets`、`docs/code-blocks/`、`.harness/skills/prompt-templates/` 均存在；`src/components/ui/` 已从 6 个组件增至 12 个。**该交接已消费完毕，以下内容仅作决策依据留档。**

> 交接给 DSH 执行的完整上下文。目标：为「一盏茶」项目建立代码复用体系。
> 所有约束均为本项目 AGENTS.md / DESIGN_SPEC / 技能规范 / verify-harness 门禁的实测结论，DSH 接手后直接按本文件执行，无需再问用户。

---

## 0. 用户原话与任务目标

> 用户指令：「你去做代码复用 比如创建组件库，封装常用函数，建立代码块，提示词模版包括 功能开发 代码审查 调试问题 性能问题」

拆解为四件事：

| # | 事项 | 交付物 |
|---|---|---|
| 1 | 组件库 | 补全 `src/components/ui/`（新增高频组件，复用现有 index.ts 出口） |
| 2 | 常用函数封装 | 新建 `src/utils/`（工具函数 + Vitest 测试） |
| 3 | 代码块 | `.vscode/tea.code-snippets`（VS Code 片段）+ `docs/code-blocks/`（Markdown 代码块库）双形态 |
| 4 | 提示词模板 | `.harness/skills/prompt-templates/` 新技能族（功能开发 / 代码审查 / 调试问题 / 性能问题 四场景） |

## 1. 已确认决策（用户已拍板，勿改）

- **组件库**：补全现有 `src/components/ui/` 目录，不另建独立目录（避免两套并存）。
- **代码块**：两者都要（`.vscode/tea.code-snippets` + `docs/code-blocks/` Markdown 库）。
- **提示词模板**：融入技能体系（`.harness/skills/` 新增第 4 族），不是独立 md 目录。

## 2. 项目现状（已实测，勿重复探查）

**已有（不要重建）**：
- `src/components/ui/`：6 个组件（BaseSpinner / EmptyState / ToastContainer / PageHeader / PillButton / SectionHeader）+ `index.ts` 统一导出
- `src/composables/`：5 个（useAudio / useBrewAnimation / useImgFailed / useParticles / useToast）
- `src/services/`：14 个（http.ts / authStorage.ts / share.ts / errorBuffer.ts / vitals.ts 等）
- `.agents/skills/`：66 个技能（含 vue-component、composition-patterns、javascript-data、vue-composables 等）
- `.harness/skills/`：39 个（main-dev 14 / biz-dev 19 / trouble-shooting 6）
- `claude-code-template/`：Claude Code 工程模板（review/plan/commit）
- `.vscode/`：仅有 extensions.json + settings.json，**无 snippets**
- git 自查：近 10 次提交均为 README/审查/依赖类，**无代码复用相关实现**；当前分支 main

**缺失（本次要建）**：
- `src/utils/` 目录不存在
- `.vscode` 无代码片段
- `docs/code-blocks/` 不存在
- `.harness/skills` 无提示词模板族

## 3. 交付物设计与建议

### 3.1 组件库（src/components/ui/ 新增 6 个 + 更新 index.ts）

建议清单（按 DESIGN_SPEC 高频件，DSH 可微调但须遵守 §4 约束）：

1. `Button.vue` — variant: `primary`（木色底+宣纸白字+印章方角）/ `secondary`（茶汤金边框+透明底）/ `ghost` / `icon`（毛玻璃圆角）；size: sm/md/lg；`loading`/`disabled` 态；`icon` prop 传全局注册图标名
2. `Badge.vue` — tone: `gold` / `cinnabar` / `bamboo` / `neutral`；圆角 sm 印章感
3. `Card.vue` — `glass-panel` 类（src/assets/main.css:185，毛玻璃）+ `rounded-xl` + 柔和阴影；header/default/footer 插槽
4. `Tooltip.vue` — position: top/bottom/left/right；hover/focus 触发
5. `Modal.vue` — Teleport + ESC 关闭 + overlay 点击 + aria-modal + 焦点管理；width: sm/md/lg
6. `Tabs.vue` — `v-model:active` 受控；tabs 数组 `{key, label, icon?}`；面板由父组件渲染

### 3.2 utils（src/utils/ 新建 + 测试）

建议文件（DSH 可微调）：
- `format.ts` — 日期/时间格式化、数字格式化（万/亿）
- `debounce.ts` / `throttle.ts` — 防抖节流（注意：无 vueuse 依赖，勿新增）
- `type-guards.ts` — isString / isObject / isDefined 等
- `url.ts` — 查询参数解析/序列化
- `storage.ts` — localStorage JSON 安全读写（参考 `src/services/authStorage.ts` 风格）
- `array.ts` / `string.ts` — 去重/分组、截断/大小写
- `index.ts` 统一导出
- 每个模块配 Vitest 测试（参考 `src/components/__tests__/PwaUpdateToast.spec.ts` 风格，`@/` 别名导入）

### 3.3 代码块

- `.vscode/tea.code-snippets`：高频片段 — Vue3 script setup 组件骨架 / composable / Pinia store / service / utils 函数 / Vitest 测试 / ECharts 初始化
- `docs/code-blocks/`：`README.md` 索引 + 按场景组织的 md（vue-component.md / utils.md / composables.md / testing.md 等）；**每个 md 必须带 frontmatter**（last_updated/status/owner，否则 verify-harness §7 报 warning）

### 3.4 提示词模板技能族（.harness/skills/prompt-templates/）

4 个 knowledge 型技能，每个 SKILL.md 内含**可直接复制的完整提示词模板**（占位符 `{{...}}`）+ 使用说明：

| 目录 | 内容 |
|---|---|
| `README.md` | 族路由表（标题格式见 §5） |
| `01-feature-dev/SKILL.md` | 功能开发提示词：需求澄清→验收标准→TDD→验证命令链 |
| `02-code-review/SKILL.md` | 代码审查提示词：6 维 + 🔴🟡🟢🔵 分级（对齐 expert-reviewer） |
| `03-debug-issue/SKILL.md` | 调试问题提示词：对齐 00-bug-diagnose 6 阶段（先建 loop） |
| `04-performance/SKILL.md` | 性能问题提示词：基线测量→profile→单变量优化 |

## 4. 硬性约束（每一条都是门禁，违反 = CI 挂）

### 4.1 组件（.agents/skills/vue-component + DESIGN_SPEC）

- `<script setup lang="ts">` + `withDefaults(defineProps<...>(), {...})`；props/emits 必带 TS 类型；禁 `any`
- **颜色/圆角/阴影必须用 DESIGN_SPEC 令牌**（CSS 变量 `var(--color-*)`），禁裸值。核心令牌：
  `cream #FAF6F0` / `ink #3D3225` / `tea-gold #9E8050`（唯一强调色）/ `wood #5D4E37` / `wood-light #7E6A55` / `bamboo #6B7D5A` / `cinnabar #A33B2E` / `paper #F5F0E8`
- 圆角档位：按钮 md、卡片 xl、印章 sm；**触控目标 ≥ 44×44px**；禁圆形按钮（除图标钮）
- 图标用 lucide-vue-next（全局注册 `IconX`，见 `src/plugins/icons.ts`）；禁 emoji / Unicode 符号当图标
- 样式全 Tailwind 类，不写 `<style>` 块；组件 ≤ 200 行
- 状态五态：hover / disabled / loading / error / empty
- 按钮文案写动作（"立即更新"），不写"提交"
- 路径别名 `@` = `src/`（vite.config.ts 已配）
- 现有组件风格参考：`src/components/ui/PillButton.vue`、`BaseSpinner.vue`、`EmptyState.vue`

### 4.2 技能（.harness/rules/技能规范.md）

- 路径：`.harness/skills/<family>/<NN-name>/SKILL.md`，禁自创路径
- frontmatter 必填：`name`（= 目录名 kebab-case，剥 `NN-` 前缀比对）、`description`（触发式：`<职责一句话>。当用户要求 <触发场景> 时触发。`，≤3 句）、`type`
- type 三值：executable | knowledge | flow。**提示词模板用 `knowledge`**（无 verification/last-reviewed 要求；executable 才需要）
- 正文结构：触发条件 → 前置条件 → 规则/流程 → 检查清单；篇幅 ≤ 300 行
- 不写人话开场白（"我会帮你…"）；直接给规则
- 新增流程：检索查重 → 写 SKILL.md → 更新路由表 → `docs/plans/lessons.md` 记一行

### 4.3 治理门禁（scripts/verify-harness.cjs，通过标准 `ERRORS: []`）

**新增第 4 族必须同步以下 5 处（缺一处即 CI 挂）**：

1. `scripts/verify-harness.cjs` 第 102 行：`const families = ['main-dev', 'biz-dev', 'trouble-shooting']` → 加 `'prompt-templates'`
2. `AGENTS.md`：`技能全套 39 个（main-dev 14 / biz-dev 19 / trouble-shooting 6）` → `技能全套 43 个（main-dev 14 / biz-dev 19 / trouble-shooting 6）`（正则匹配格式，只改总数，三族值不动）
3. `.agents/skills/README.md` 第 5 行：`流程族（main-dev / biz-dev / trouble-shooting，39 个）` → `43 个`
4. `.harness/rules/技能规范.md` §1：保留原文 `流程族（main-dev 14 / biz-dev 19 / trouble-shooting 6）`（正则依赖），另起一句说明第 4 族存在
5. 新族 `README.md` 标题格式：`# prompt-templates-skill 总览（提示词模板，4 个）`（正则 `(prompt-templates).*?(\d+) 个[)）]` 匹配）

其他自动检查点：
- **4h 死技能审计**：每个新 SKILL.md 必须被新族 README 以链接形式引用（`[xxx](01-feature-dev/SKILL.md)`）
- **4f/4g**：所有新 SKILL.md 的 name 必须 = 目录名（剥前缀）、description 必填、type 值域合法
- **§10 docs/skills 审查页**：知识型技能不强制人读页（仅"项目规则类"要求）；不配页则无需改 AGENTS.md §12 声明

## 5. 验证门禁（按序全跑，全绿才算完成）

```powershell
node scripts/verify-harness.cjs          # 期望 ERRORS: []（技能治理）
npm run type-check                        # vue-tsc 类型检查
npm run test                              # vitest（新增 utils 测试必须通过）
npm run lint                              # biome check src e2e scripts
npm run build                             # 生产构建
```

注意：`git` 不在 PATH，需用 `C:\Program Files\Git\cmd\git.exe` 或先加入 PATH。

## 6. 边界（不做）

- 不动现有 `src/components/ui/` 6 个组件（只新增 + 更新 index.ts）
- 不动 `.agents/skills/` 现有 66 个技能
- 不引入新依赖（项目已有 lucide-vue-next；**无 vueuse**，utils 自己实现防抖节流）
- 不改业务代码（src/views、stores、services 现有逻辑）
- 不改 AGENTS.md §12 docs/skills 声明（不配人读页）

## 7. git 提交要求（AGENTS.md §10）

- **main 分支有保护，禁直接 push main**；新改动走 `feature/xxx` 分支 → push → 开 PR → CI 全绿 → 合并
- AI 提交 subject 前加 `[ai]` 前缀，conventional commits：`[ai] feat(ui): ...` / `[ai] chore(utils): ...`
- 组件/功能提交与测试分开提交

## 8. 执行顺序建议

1. 组件库（独立，先做）→ 2. utils + 测试 → 3. snippets + code-blocks 文档 → 4. 提示词模板技能族 + 治理同步（改 verify-harness.cjs 需谨慎，改完立即跑 verify-harness）→ 5. 全量验证

## 9. 关键参考文件

- `DESIGN_SPEC.md` — 设计令牌（颜色/圆角/阴影/动效）
- `.agents/skills/vue-component/SKILL.md` — 组件生成规范
- `.harness/rules/技能规范.md` — 技能治理唯一权威
- `scripts/verify-harness.cjs` — 治理门禁检查逻辑（新增技能前必读 4f/4g/4h/4i）
- `.agents/skills/README.md` — 技能路由总表
- `.harness/skills/trouble-shooting/00-bug-diagnose/SKILL.md` — 技能正文结构范本（调试技能可对齐）
- `src/services/authStorage.ts` — localStorage 封装风格参考
- `src/components/__tests__/PwaUpdateToast.spec.ts` — 测试风格参考
- `src/components/ui/*.vue` — 现有组件风格
- `src/assets/main.css:185` — glass-panel 毛玻璃类
- `src/plugins/icons.ts` — 图标全局注册清单
