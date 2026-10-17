---
name: plan-asset-slimming-2026-10-17
description: 86MB 仓库资产逐文件去处规划——三档处置（KEEP 跟踪 / UNTRACK 停跟踪保本地 / COMPRESS 压缩替换），每个文件给出处置与依据；UNTRACK 不删本地文件。
status: active
owner: yanha
last_updated: 2026-10-17
---

# 仓库资产瘦身：逐文件去处（2026-10-17 实测）

> 前提（用户要求）：**不盲目删文件**。本文所有 `UNTRACK` 都是 `git rm --cached`（停止跟踪 + 加 `.gitignore`），**本地文件原样保留**——AI 仍可读，只是不再进仓库、不再随 clone 下载。
> 实测口径：`git ls-files`（跟踪体积）vs `Get-ChildItem`（工作区体积）；引用数用 `git grep -l <文件名> -- src/ docs/ README*`。

## 0. 三档处置定义

| 标记 | 动作 | 本地文件 | 进仓库 |
|---|---|---|---|
| **KEEP** | 不动 | 保留 | 是 |
| **UNTRACK** | `git rm --cached` + `.gitignore` 加规则 | **保留** | 否 |
| **COMPRESS** | 重新压缩/转格式后替换 | 替换为新版 | 是（更小） |

总账（2026-10-17 实测修订）：**86MB → 约 36.4MB（−58%）**——UNTRACK 48MB + COMPRESS 1.6MB（仅 home 两张截图）。原估的「COMPRESS 18.9MB」已证伪：地形 jpg 与 hdr 压缩会带来不可验证的视觉劣化，见 §7。

## 1. `public/3d/`（11 文件，22.8MB）——全部运行时资产，一个都不删

| 文件 | 大小 | 处置 | 依据 |
|---|---|---|---|
| `textures/terrain/aerial_grass_rock_diff_2k.ktx2` | 0.79MB | **KEEP** | `TeaGardenSceneInner.vue:528` 主加载路径 |
| `textures/terrain/aerial_grass_rock_nor_gl_2k.ktx2` | 0.83MB | **KEEP** | 同上 |
| `textures/terrain/brown_mud_dry_diff_2k.ktx2` | 0.82MB | **KEEP** | 同上 |
| `textures/terrain/rock_ground_02_diff_2k.ktx2` | 0.84MB | **KEEP** | 同上 |
| `textures/terrain/*.jpg` ×4 | **12.79MB** | **KEEP（压缩已试并撤销，见 §7）** | `:529` `.catch(() => texLoader.loadAsync(...jpg))`——KTX2 解码失败时的**降级兜底**，不能删 |
| `hdri/kloofendal_2k.hdr` | **6.18MB** | **KEEP（不转，见 §7.2）** | `:618` 环境光照，运行时必需 |
| `basis/basis_transcoder.js` | 0.05MB | **KEEP** | KTX2 解码器 |
| `basis/basis_transcoder.wasm` | 0.50MB | **KEEP** | 同上 |

小计：22.8MB → **约 10MB**（省 12.8MB，全部来自压缩，零功能损失）。

> 为什么不能「移出 git」：`public/` 是 Vite 直接映射的静态目录，移出意味着部署时要额外挂载——增加部署复杂度换 22MB，不划算。

## 2. `docs/screenshots/`（84 文件，29.1MB）

| 文件/组 | 数量 | 体积 | 处置 | 依据 |
|---|---|---|---|---|
| `p0-audit/**` | 63 | **20.12MB** | **UNTRACK 全部** | `git grep -l "p0-audit"` = **0 处引用**；P0 打磨期的审计产物，已完成使命 |
| `regression/baseline/*.png` | 6 | 4.37MB | **KEEP** | `e2e/visual-regression.spec.ts` 的 `toHaveScreenshot` 基线，删了视觉回归失效 |
| `brew-3d-done.png` / `brew-3d-steeping.png` | 2 | 0.71MB | **KEEP** | 引用 3 / 4 处 |
| `growth-desktop.png` / `home.jpg` / `og-cover.png` / `select.png` / `share.png` | 5 | 0.96MB | **KEEP** | 引用 4 / 5 / 4 / 3 / 3 处（README 与文档在用） |
| `home-desktop.png` / `home-mobile.png` | 2 | **2.02MB** | **COMPRESS**（目标 ≤0.5MB） | 引用 1 / 1 处，2MB 单图过重 |
| `brew-3d-heating.png` / `brew-setup.png` / `growth-desktop-bottom.png` / `growth-empty.png` / `growth-mobile.png` / `home-drawer.png` | 6 | 0.82MB | **UNTRACK** | 引用 **0** 处；体积小，但同样无读者，留着只会被误当基线 |

小计：29.1MB → **约 5.4MB**（UNTRACK 20.9MB + COMPRESS 1.5MB）。

## 3. `.agents/skills/`（477 个 .md + 素材，跟踪 34MB / 工作区 ~50MB）

| 技能目录 | 跟踪 | 工作区 | 处置 | 依据 |
|---|---|---|---|---|
| `threejs-procedural-materials` | 11.42MB | 11.42MB | **UNTRACK 素材**（`assets/**/*.{jpg,png,exr,hdr,bin}`），正文 `.md` KEEP | 第三方技能包的参考贴图/LUT，AI 执行时读正文与伪代码即可，不读 3.9MB 的 exr |
| `threejs-precipitation-surfaces` | 8.60MB | 8.60MB | 同上 | 同上 |
| `threejs-procedural-vegetation` | 7.55MB | 7.55MB | 同上 | 同上 |
| `threejs-volumetric-clouds` | 1.10MB | 8.06MB | **KEEP**（跟踪部分小；6.9MB 已被 `.gitignore` 忽略） | — |
| `threejs-atmosphere-aerial-perspective` | 0.22MB | 12.28MB | **KEEP**（12MB 未跟踪，无需处理） | — |
| `ui-styling` | 0.33MB | 5.49MB | **KEEP**（5MB 未跟踪） | — |
| 其余 60+ 技能 | ~5MB | ~5MB | **KEEP** | 正文为主，无大素材 |

小计：34MB → **约 6MB**（UNTRACK 27.6MB 素材）。

> 副作用与缓解：素材停跟踪后，本地仍在（AI 仍可读）；换机器/新 clone 后缺素材，但技能正文自带「怎么生成/去哪取」的说明，且可从上游包重取。**如果某技能真需要素材才能执行，就不 UNTRACK**——执行时逐个确认，不搞一刀切。

## 4. 工作区占位但不进仓库（不用处理）

`threejs-atmosphere` 12MB、`threejs-volumetric-clouds` 7MB、`ui-styling` 5MB 等——已被 `.gitignore` 的 `**/*.{bin,exr,hdr,tga,ttf,otf}` 规则忽略，**不占仓库体积**，只占本地磁盘。无需动作。

## 5. 执行顺序与验证

```
步骤 1  UNTRACK p0-audit（63 文件 20.12MB，零风险：引用 0）
        git rm -r --cached docs/screenshots/p0-audit
        .gitignore 加 docs/screenshots/p0-audit/
步骤 2  UNTRACK 无引用截图 6 张（0.82MB）+ skills 素材（27.6MB）
        .gitignore 加 .agents/skills/**/assets/
步骤 3  COMPRESS public/3d 的 4 jpg + hdr（12.8MB → ~6MB）
        用 toktx 转 hdr；jpg 用 sharp/ImageMagick 压到 1K 或 q75
        验证：verify-gardens.cjs / verify-pavilion.cjs 截图无视觉差异
步骤 4  COMPRESS 2 张 home 图（2MB → 0.5MB）+ 确认 README 引用仍可显示
```

每步的验证：
- UNTRACK 后：`git ls-files | wc -l` 下降、`git status` 干净、**本地文件仍在**（`Test-Path` 抽查）
- COMPRESS 后：`npm run build` + `verify-gardens.cjs`（3D 场景可见）+ 截图对比
- 全部完成后：`verify-harness` / `audit-redlines` / `audit-context-budget` 三绿

## 6. 风险与反转

| 风险 | 影响 | 缓解 |
|---|---|---|
| UNTRACK 后新 clone 缺素材 | 技能执行时少参考图 | 正文含取用说明；需要时从上游重取；单技能可 revert 恢复跟踪 |
| 压缩后视觉差异 | 3D 场景观感下降 | 逐文件截图对比；PBR 贴图压到 1K 在有 mipmap 的场景通常不可见，但必须实拍验证 |
| hdr 转 ktx2 后光照变化 | 明暗/色彩偏差 | 保留原 hdr 在本地备份 14 天；`verify-gardens` 四园截图对比 |

## 7. 压缩环节的实测结论（2026-10-17，推翻原计划）

### 7.1 地形 jpg：压了又撤

先按 q75 压（12.79MB → 3.24MB），PR #100 合并后补做像素统计，发现质量不可接受：

| 文件 | q75 MAE | 差>8 通道占比 |
|---|---|---|
| aerial_grass_rock_diff_2k | 4.54/255 | 13.60% |
| aerial_grass_rock_nor_gl_2k（**法线贴图**） | **7.45/255** | **34.02%** |
| brown_mud_dry_diff_2k | 7.26/255 | 33.87% |
| rock_ground_02_diff_2k | 6.78/255 | 30.68% |

提到 q90（法线 q95）后仍不达标：

| 文件 | q90/q95 MAE | 差>8 占比 |
|---|---|---|
| aerial_grass_rock_diff_2k | 3.28/255 | 5.87% |
| aerial_grass_rock_nor_gl_2k（q95） | 5.63/255 | 21.75% |
| brown_mud_dry_diff_2k | 4.76/255 | 15.60% |
| rock_ground_02_diff_2k | 4.47/255 | 13.35% |

判断依据：

1. 原图已是合理压缩（3.6MB / 2048² ≈ 0.86 byte/px），再压是**二次损失**。
2. **法线贴图对压缩最敏感**——RGB 直接编码表面法向量，噪声会变成错误凹凸。
3. 它们只在 **KTX2 兜底路径**加载（现代浏览器全走 ktx2），12.79MB 实际几乎不传输，体积收益不抵质量风险。

→ **撤销压缩，恢复原件**。教训：资产压缩不能只验「体积下降 + 能解码」，必须测像素差异；安全线建议 MAE < 1.5、差>8 占比 < 2%（参照 home 截图实测 MAE 1.24 / <1%）。

### 7.2 hdr：不转 ktx2

- `toktx`（KTX-Software）未安装，需要额外工具链。
- 更关键：hdr 是**环境光照**，转 ktx2 会改变 IBL 采样结果；而当前执行环境**无图像输入能力**，光照变化的「正确性」无法用像素统计判断（MAE 只能测「变了多少」，不能测「变得对不对」）。
- 6.18MB 换一个不可验证的光照变化，风险大于收益 → **保持原样**。

### 7.3 实际完成的瘦身

| 动作 | 收益 |
|---|---|
| UNTRACK p0-audit + 无引用截图 + skills 素材（PR #99） | 48MB |
| 压缩 home-desktop.png / home-mobile.png（MAE 1.24，差>8 <1%） | 1.6MB |
| **合计** | **约 49.6MB（86MB → 36.4MB，−58%）** |
