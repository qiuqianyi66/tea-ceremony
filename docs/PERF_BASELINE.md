# 性能基线（PERF_BASELINE）

> 记录时间：2026-09-10（V3 P1 深化收尾时建立）
> 测量环境：本地 preview（localhost:4173）+ Playwright Chromium 1280×900，冷加载（无缓存）
> 用途：后续性能优化的对照基准。任何优化改完必须重测本文件指标并更新。

## 1. 构建产物体积（dist/）

| 类别 | 体积 | 说明 |
|---|---|---|
| JS 总量 | 2.29 MB | tres 3D 引擎 0.80MB + MapView echarts 0.46MB 为路由级 chunk（按需加载） |
| CSS | 0.12 MB | 单文件 |
| 图片（非 3D） | ≈2.3 MB | tearoom-bg 0.67 / porcelain 0.62 / hero 0.58 / zisha 0.54 / 茶卡·茶园图 |
| 3D 纹理 | 34.2 MB | 8 张 2K 地形贴图（terrain/*），**不进 precache**，运行时 CacheFirst 按需加载 |
| **离线包（precache）** | ≈4.7 MB | JS + CSS + 非 3D 图片（3D 纹理排除，见 vite.config globIgnores `**/3d/**`） |

## 2. 首页首屏加载（preview 实测）

| 指标 | 值 | 说明 |
|---|---|---|
| load 完成 | 114 ms | 本地 preview 参考值（远程会更高） |
| 总传输 | 1187 KB | 首页首屏全量 |
| 图片 | 716 KB | **最大项**：Hero 图 0.58MB + 首页茶卡图 |
| JS | 367 KB | 首屏按需（tres/echarts 均未进入首屏 ✓） |
| CSS | 99 KB | |
| 请求数 | 23 | |

## 3. 关键结论

- ✅ **JS 按需加载健康**：tres（0.8MB）与 echarts（0.46MB）都是路由 chunk，首屏只加载 367KB JS
- ⚠️ **图片是优化空间**：Hero 图（tea-mountain-hero 0.58MB）可压至 <300KB（compress-assets 脚本群可用）；首屏图片 716KB → 目标 <400KB
- ⚠️ **3D 纹理 34MB 是 dist 部署体积大头**：属设计权衡（2K 贴图质量 vs 体积），已按需加载不影响首屏；若 GitHub Pages 部署空间敏感可降 1K 纹理（代价是 3D 地面细节）
- ℹ️ 离线包 4.7MB 对 PWA 可接受；3D 页首次访问时纹理走运行时缓存（网络可达时）

## 4. 重测命令

```
npm run build                          # 产物体积统计（脚本见下）
node scripts/tmp-perf-shot.cjs         # 首屏加载测量（preview 4173 + Playwright）
```

> 体积统计脚本：`python` 遍历 dist 按扩展名汇总（JS/CSS/图片），见历史对话。
