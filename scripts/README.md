# scripts/ 脚本速查（G24 ④）

> 分类登记全部脚本用途。新增脚本时在此登记一行。verify-harness 检查 docs/ 元信息头，本目录脚本不检查。

## 质量门 / 治理（CI 门禁或提交前必跑）

| 脚本 | 用途 |
|---|---|
| `verify-harness.cjs` | 治理一致性体检（ADR/CI job/技能数/路径/wiki/子代理/审查页） |
| `audit-redlines.cjs` | 红线机械化审计（替代 red-line-auditor） |
| `audit-wiki-drift.cjs` | wiki 契约漂移审计（api-contract 端点 vs 代码路由双向核对） |
| `scan-emoji.cjs` | 禁 emoji 扫描 |
| `verify-icons.cjs` | lucide 图标渲染审计 |
| `audit-touch.cjs` | 全局触控目标审计（≥44px） |
| `audit-hex.cjs` / `audit-states.cjs` / `audit-teas.cjs` / `audit-type.cjs` | 十六进制色值 / 状态五态 / 茶叶数据 / 类型一致性审计 |
| `verify-brew-mobile.cjs` | 冲泡页移动端触控验证 |

## AI 评测体系

| 脚本 | 用途 |
|---|---|
| `eval-tea-ai.cjs` | 评测主入口（50 条 × pass³，可带 `--judge`） |
| `eval-core.cjs` | 评测判分核心（program + judge 考点） |
| `eval-extract-regression.cjs` | K17：评测 bad case → 回归样本 |
| `eval-baseline-diff.cjs` | K18：评测历史基线自动 diff |
| `calibrate-judge.cjs` / `compare-judge-agreement.cjs` | 评委校准 / 人工-评委一致率 |
| `gen-judge-checklist.cjs` / `gen-judge-samples.cjs` / `validate-eval-cases.cjs` | 评委清单 / 样本生成 / 用例校验 |
| `agent-eval.cjs` | 六 agent 评测切片 |
| `eval-harness.cjs` | harness 七维确定性评测 |
| `measure-ai-commits.cjs` | K20：AI 提交占比度量（`[ai]` 标记） |

## 3D 茶园 / 茶亭验证

| 脚本 | 用途 |
|---|---|
| `verify-gardens.cjs` / `verify-pavilion.cjs` | 四园晴雨 / 茶亭截图验证 |
| `verify-garden-3d-crop.cjs` / `-interact.cjs` / `-phase4.cjs` / `-phase5.cjs` | 3D 茶园切片验证 |
| `verify-garden-ambient.cjs` / `verify-water-rain.cjs` / `verify-water2.cjs` | 环境光 / 雨水效果验证 |
| `screenshot-brew3d.cjs` / `inspect-brew-corner.cjs` / `probe-brew.cjs` | 冲泡 3D 截图 / 角落检测 / 探针 |
| `diag-glare.cjs` / `diag-glare2.cjs` | 反光诊断（一次性） |

## 截图（UI 视觉验证）

| 脚本 | 用途 |
|---|---|
| `screenshot-home.cjs` / `screenshot-growth.cjs` / `screenshots-home-share.cjs` | 首页 / 成长页 / 首页+分享截图 |
| `verify-brew-skins.cjs` / `verify-controls.cjs` / `verify-field.cjs` / `verify-final.cjs` / `verify-garden-sync-e2e.cjs` | 皮肤 / 控件 / 表单 / 终验 / 同步 E2E |

## 资源与构建工具

| 脚本 | 用途 |
|---|---|
| `compress-assets.cjs` | 静态图片压缩（mozjpeg） |
| `convert-3d-ktx2.cjs` | 3D 纹理 KTX2 转码（toktx.exe） |
| `dl-textures.cjs` | 纹理下载（一次性） |
| `add-doc-meta.cjs` | docs 元信息头批量补齐 |
| `gen-repomap.cjs` | 仓库地图生成（tree-sitter） |
| `pwa-offline-smoke.cjs` | PWA 离线冒烟 |

## 其他

| 脚本 | 用途 |
|---|---|
| `smoke.mjs` | 路由冒烟（默认 `http://localhost:4173`） |
| `backup-postgres.ps1` / `.sh` | PostgreSQL 每日备份（pg_dump\|gzip，保留 14 天） |
