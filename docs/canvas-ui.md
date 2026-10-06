# Canvas UI — 技术评估与使用前提

> 2026-10-06 评估（用户引入认知，先学习后判断可用性）。来源：`C:\Users\yanha\Desktop\canvas-ui`（github.com/DavidHDev/canvas-ui，v0.1.0，MIT + Commons Clause）。状态：**候选可用，未立项**——引入须过四维甄别 + 设计门禁（AGENTS.md §2）。

## 1. 是什么

开源 **canvas 特效组件库**（25 个）：流体模拟 / 着色器 / 3D 场景，跑在实时交互页面上。核心基于实验性 **HTML-in-canvas API**——WebGL 读取并重绘活动 DOM（文字可选中、链接可点击、整页变纹理被 fire/fluid/glass 实时扭曲）；不支持时自动降级纯 WebGL overlay。

## 2. 与一盏茶的兼容性（已核实）

| 维度 | 一盏茶 | Canvas UI | 结论 |
|---|---|---|---|
| 框架 | Vue 3.5 | 每组件 6 构建含 **Vue** | ✅ |
| 样式 | Tailwind 4 | Tailwind 4 | ✅ |
| 3D | Three 0.185（TresJS 5.8） | three ^0.185.1（GLB 组件） | ✅ 同版本 |
| 交付 | — | shadcn registry 源码即组件（`npx shadcn@latest add @canvas-ui/liquid-vue`），非安装依赖 | ✅ 可编辑 |
| 离线/PWA | 离线优先（Dexie） | 组件源码进项目，无运行时 CDN | ✅ 可控 |

## 3. 使用前提（不满足则降级体验）

- **HTML-in-canvas**：需 Chrome/Edge 140+，开发开 `chrome://flags/#canvas-draw-element`，生产用 origin trial token；其他浏览器/移动端自动降级 overlay（特效在但页面不"活"）——一盏茶 PWA 离线降级链不受影响，但特效分级体验需在产品层明确
- **License（Commons Clause）**：免费用于自身产品（含商业），**禁止转售/再分发组件本身**；茶室项目引入合规
- **依赖**：3D 类组件引 three.js（版本已对齐）；非 3D 组件多为零依赖
- **性能**：特效层对低端机/长页面有成本，引入需按页面评估（触控 44px/五态等茶室规范不受影响）

## 4. 潜在契合点（观察，未承诺）

Liquid（茶汤流体）、Clouds（山间雾）、Frost（霜）、Ripple（涟漪）与"数字茶室"沉浸方向天然契合；Glass Object/Particle Object（GLB）可服务 3D 茶空间。引入任何组件前：四维甄别（自由/用户/竞品/伪需求）→ 设计门禁 6 步 → 按 Canvas UI 仓库模式取 Vue 版源码落地。

## 5. 参考

- 仓库：`C:\Users\yanha\Desktop\canvas-ui`（src/lib 组件源码、src/app 文档站、scripts/build-registry.mts 注册表生成）
- 官网：https://canvasui.dev ；组件清单/安装/MCP：见其 `public/llms.txt`
