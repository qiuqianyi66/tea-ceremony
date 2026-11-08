# Three.js 技能分册（31 个）

> 二级索引：`.agents/skills/README.md` 主表只留族指针，明细搬到这里。
> **只在真要动 three.js 底层时读本册**。tea 的 3D 日常走 TresJS + `.harness/skills/biz-dev/18-3d-scene`，不走这里。
> 登记校验：`verify-harness.cjs` §4n 会顺着主表的 md 链接查本册，技能名必须在本册出现。

## 基础（13）

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

## 进阶（18）

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
