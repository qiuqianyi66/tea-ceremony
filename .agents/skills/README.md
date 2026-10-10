# .agents/skills 路由总表（66 个）

> 技能治理规范见 `.harness/rules/技能规范.md`。任务启动先读本表定位技能，再 Read 对应 SKILL.md。
> 分组：控制协议 / 领域技能（tea 专属）/ 前端设计 / Web 基础（HTML·CSS·JS·TS）/ Vue / Three.js（基础·进阶）/ 辅助。
> 流程族（main-dev / biz-dev / trouble-shooting，39 个）见 `.harness/skills/*/README.md`。
> 核心技能人读审查页见 `docs/skills/`（plan-control / tea-tasting / db-migration / fastapi-endpoint / vue-component）。

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
| [frontend-design](frontend-design/SKILL.md) | 独特视觉设计方向与审美决策指导 |
| [ui-styling](ui-styling/SKILL.md) | shadcn/ui + Tailwind 界面实现规范 |
| [shadcn](shadcn/SKILL.md) | shadcn 组件管理与项目配置 |
| [composition-patterns](composition-patterns/SKILL.md) | 组件组合模式（compound/context/render props，来自 vercel 包） |
| [design-md-collection](design-md-collection/SKILL.md) | 74 个真实品牌 DESIGN.md 设计系统参考库 |

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

## Three.js

### 基础（13）

| 技能 | 说明 |
|---|---|
| [threejs-geometry](threejs-geometry/SKILL.md) | 几何创建：内置形状、BufferGeometry、实例化 |
| [threejs-materials](threejs-materials/SKILL.md) | 材质：PBR/basic/phong/shader |
| [threejs-lighting](threejs-lighting/SKILL.md) | 光照：光源类型、阴影、IBL |
| [threejs-shaders](threejs-shaders/SKILL.md) | 着色器：GLSL、ShaderMaterial、uniform |
| [threejs-textures](threejs-textures/SKILL.md) | 纹理：UV、环境贴图、贴图设置 |
| [threejs-animation](threejs-animation/SKILL.md) | 动画：关键帧、骨骼、morph、混合 |
| [threejs-interaction](threejs-interaction/SKILL.md) | 交互：raycasting、控制器、鼠标/触控 |
| [threejs-loaders](threejs-loaders/SKILL.md) | 资源加载：GLTF、纹理、模型、异步 |
| [threejs-postprocessing](threejs-postprocessing/SKILL.md) | 后处理：EffectComposer、bloom、景深 |
| [threejs-syntax-loaders](threejs-syntax-loaders/SKILL.md) | 模型/纹理加载器细节：DRACO、KTX2、LoadingManager |
| [threejs-impl-lighting](threejs-impl-lighting/SKILL.md) | 光照实现细节：7 类光源、PMREM、HDR、物理强度 |
| [threejs-impl-post-processing](threejs-impl-post-processing/SKILL.md) | 后处理实现细节 |
| [threejs-impl-shadows](threejs-impl-shadows/SKILL.md) | 阴影实现细节 |

### 进阶（18）

| 技能 | 说明 |
|---|---|
| [threejs-atmosphere-aerial-perspective](threejs-atmosphere-aerial-perspective/SKILL.md) | 大气与空中透视：瑞利/米氏散射、预计算 LUT |
| [threejs-bloom](threejs-bloom/SKILL.md) | 生产级 bloom：HDR 信号序、选择性 bloom |
| [threejs-camera-direction](threejs-camera-direction/SKILL.md) | 进阶相机系统：追击/轨道/四元数交接 |
| [threejs-exposure-color-grading](threejs-exposure-color-grading/SKILL.md) | 曝光与调色：亮度计、对数曝光、3D LUT |
| [threejs-image-pipeline](threejs-image-pipeline/SKILL.md) | 最终图像管线：GTAO、bloom、自适应曝光、调色 |
| [threejs-parallax-occlusion-mapping](threejs-parallax-occlusion-mapping/SKILL.md) | 视差遮挡贴图（WebGPU/TSL） |
| [threejs-precipitation-surfaces](threejs-precipitation-surfaces/SKILL.md) | 降雪与受雪表面耦合 |
| [threejs-procedural-animation](threejs-procedural-animation/SKILL.md) | 过程化动画：发射运动学、重力转向、自旋对接 |
| [threejs-procedural-fields](threejs-procedural-fields/SKILL.md) | 过程化标量/向量场：地形、云、风 |
| [threejs-procedural-geometry](threejs-procedural-geometry/SKILL.md) | 生产级过程化网格 |
| [threejs-procedural-materials](threejs-procedural-materials/SKILL.md) | 生产级过程化材质（纹理混合 PBR） |
| [threejs-procedural-vegetation](threejs-procedural-vegetation/SKILL.md) | 过程化植被：树、草、藤蔓、花 |
| [threejs-procedural-vfx](threejs-procedural-vfx/SKILL.md) | 生产级实时 VFX：镜头光晕、高光衍生 |
| [threejs-screen-space-ambient-occlusion](threejs-screen-space-ambient-occlusion/SKILL.md) | GTAO：半分辨率采样、反向深度恢复 |
| [threejs-shadow-systems](threejs-shadow-systems/SKILL.md) | 可伸缩方向光阴影系统 |
| [threejs-temporal-surfaces](threejs-temporal-surfaces/SKILL.md) | 视图对齐/屏幕空间表面效果（霜、水纹） |
| [threejs-visual-validation](threejs-visual-validation/SKILL.md) | 图形学视觉验证（固定视点逐项比对，非主观截图） |
| [threejs-volumetric-clouds](threejs-volumetric-clouds/SKILL.md) | 体积云：天气驱动密度、边界光线步进 |

## 辅助

| 技能 | 说明 |
|---|---|
| [show-me](show-me/SKILL.md) | 用图表/代码草图/HTML 片段直观解释当前主题 |
