# .agents/skills 路由总表（66 个）

> 技能治理规范见 `.harness/rules/技能规范.md`。任务启动先读本表定位技能，再 Read 对应 SKILL.md。
> 分组：控制协议 / 领域技能（tea 专属）/ 前端设计 / Web 基础（HTML·CSS·JS·TS）/ Vue / Three.js（基础·进阶）/ 辅助。
> 流程族（main-dev / biz-dev / trouble-shooting，43 个）见 `.harness/skills/*/README.md`。
> 核心技能人读审查页见 `docs/skills/`（plan-control / tea-tasting / db-migration / fastapi-endpoint / vue-component）。

## 加载方式（三级，逐级按需）

1. **一级·元数据**：只读本表（技能名 + 说明），按场景定位到 1 个技能。禁按名字猜多个。
2. **二级·正文**：命中后 Read 该技能 `SKILL.md`。一次只读 1 个，读正文即止，不顺手点开邻居技能。
3. **三级·资产**：正文出现 `references/` `assets/` `scripts/` 路径时才读那些文件。**禁预读**——正文没有点名的文件不要打开；正文没点名的资产等于不存在。

> 判据：正文没提 `references/` 就没第三级；只读表就动手（跳过二级）属违约。

## 项目外技能根（不进仓库治理，按绝对路径 Read）

- **reasonix**：本机 `~/.config/reasonix/skills/<name>/SKILL.md`（64 个，仅 reasonix 环境自动加载）。本表与 AGENTS.md §6 引用的 `frontend-design-spec` 在此：`C:\Users\yanha\.config\reasonix\skills\frontend-design-spec\SKILL.md`；其他 agent（Codex / Claude Code / 豆包）不自动发现，需按绝对路径 Read，缺失时回退 [frontend-design](frontend-design/SKILL.md)。
- **Codex**：本机 `.codex/skills/`（20 个 SKILL.md，git 未跟踪，属环境态）。
- 判定：只有 `.agents/skills` 与 `.harness/skills` 进 `verify-harness.cjs` 校验（§4j 只认 git 跟踪的文件），上述两处不参与数量对账。

## 控制协议

| 技能 | 说明 |
|---|---|
| [plan-control](plan-control/SKILL.md) | Agent 控制协议：何时规划/批准/执行/停止、如何证明完成。用户手动触发（`/plan`、先出方案等） |

## 领域技能（tea 专属）

| 技能 | 说明 |
|---|---|
| [tea-tasting](tea-tasting/SKILL.md) | 品鉴评分（八维×工艺系数）与六大茶类冲泡参数规范 |
| [db-migration](db-migration/SKILL.md) | 数据库迁移规范（SQLAlchemy + Alembic，改表必用） |
| [fastapi-endpoint](fastapi-endpoint/SKILL.md) | FastAPI 接口生成规范（过渡期旧后端） |
| [vue-component](vue-component/SKILL.md) | Vue 3 组件生成规范 |

## 前端设计

| 技能 | 说明 |
|---|---|
| [frontend-design](frontend-design/SKILL.md) | 独特视觉设计方向与审美决策指导。当要为界面定视觉方向、选字体配色，或判断"这看起来像模板"时读 |
| [ui-styling](ui-styling/SKILL.md) | shadcn/ui + Tailwind 界面实现规范 |
| [shadcn](shadcn/SKILL.md) | shadcn 组件管理与项目配置。当要加/改 shadcn 组件、用 registry 预设或处理 components.json 时读 |
| [composition-patterns](composition-patterns/SKILL.md) | 组件组合模式（compound/context/render props，来自 vercel 包） |
| [design-md-collection](design-md-collection/SKILL.md) | 74 个真实品牌 DESIGN.md 设计系统参考库。当要参考某品牌配色字体、做竞品 UI 对比，或说"像 Stripe 那样"时读 |

## Web 基础

### HTML / CSS

| 技能 | 说明 |
|---|---|
| [html-a11y](html-a11y/SKILL.md) | HTML 无障碍：ARIA、地标、焦点管理、WCAG |
| [html-forms](html-forms/SKILL.md) | 表单、输入类型、原生校验、FormData |
| [css-layout](css-layout/SKILL.md) | Flexbox/Grid、容器查询、内在尺寸 |
| [css-animations](css-animations/SKILL.md) | CSS 动效：transition、@keyframes、View Transitions |
| [css-responsive](css-responsive/SKILL.md) | 响应式：媒体查询、clamp()、dvh 单位、响应式图片 |

### JavaScript

| 技能 | 说明 |
|---|---|
| [javascript-data](javascript-data/SKILL.md) | 数据处理：日期/Intl 格式化、JSON、正则、集合 |
| [javascript-debug](javascript-debug/SKILL.md) | 运行时错误与语言陷阱调试指南 |
| [javascript-dom](javascript-dom/SKILL.md) | 原生 DOM 操作：选择器、事件委托、安全渲染 |
| [javascript-node](javascript-node/SKILL.md) | Node.js（ESM）最佳实践：fs/path、子进程、流 |
| [javascript-performance](javascript-performance/SKILL.md) | 性能优化：防抖节流、懒加载、Web Worker、内存泄漏 |
| [javascript-testing](javascript-testing/SKILL.md) | Vitest 测试实践（AAA、mock、异步） |

### TypeScript

| 技能 | 说明 |
|---|---|
| [typescript-config](typescript-config/SKILL.md) | tsconfig 配置与严格模式 |
| [typescript-types](typescript-types/SKILL.md) | 类型体操：工具类型、条件类型、泛型 |
| [typescript-debug](typescript-debug/SKILL.md) | TS 编译器报错解码（TS2345 等） |
| [typescript-testing](typescript-testing/SKILL.md) | Vitest 中 TS 类型级测试 |
| [typescript-vue](typescript-vue/SKILL.md) | Vue 3 `<script setup>` 类型化（defineProps/Emits/Model） |

## Vue

| 技能 | 说明 |
|---|---|
| [vue-architecture](vue-architecture/SKILL.md) | 企业级 Vue 3 架构：项目结构、状态/API 策略、路由 |
| [vue-composables](vue-composables/SKILL.md) | 库级 composables 编写（MaybeRef 适配） |
| [vue-axios](vue-axios/SKILL.md) | Axios 实例化、类型化请求、错误处理 |
| [vue-pinia](vue-pinia/SKILL.md) | Pinia 状态管理（setup store、storeToRefs） |
| [vue-router](vue-router/SKILL.md) | Vue Router 4：导航守卫、路由传参 |
| [vue-debug](vue-debug/SKILL.md) | Vue 3 运行时错误与 SSR/hydration 调试 |
| [vue-testing](vue-testing/SKILL.md) | Vue 3 测试：VTU + Vitest + Playwright E2E |
| [vueuse](vueuse/SKILL.md) | VueUse composable 目录（用户点名时加载） |

## Three.js（31 个，分册）

> 明细见 [threejs-INDEX.md](threejs-INDEX.md)，**只在真要动 three.js 底层时读该分册**；tea 日常 3D 走 TresJS + `.harness/skills/biz-dev/18-3d-scene`。
> 基础 13：几何/材质/光照/着色器/纹理/动画/交互/加载/后处理 + 3 个实现细节。进阶 18：大气散射/体积云/过程化生成（地形·植被·VFX）/后处理管线/GTAO/阴影系统/视觉验证。

## 辅助

| 技能 | 说明 |
|---|---|
| [show-me](show-me/SKILL.md) | 用图表/代码草图/HTML 片段直观解释当前主题 |

> 分层（活跃 / 储备）与升降判据见 `docs/reference/skill-layering.md`。
