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
| `audit-context-budget.cjs` | 常驻上下文预算体检（防 AGENTS.md / 规则层膨胀） |
| `verify-brew-mobile.cjs` | 冲泡页移动端触控验证 |
| `verify-brew-desktop.cjs` | 冲泡页 1440 宽屏 3D 验证（canvas 真挂载 + 无横向滚动） |
| `audit-probe-selectors.cjs` | 探针死选择器审计（探针引用的 class/title 在 `src/` 命中 0 → 红；防「跑得过但验不到」） |

## AI 评测体系

| 脚本 | 用途 |
|---|---|
| `eval-tea-ai.cjs` | 评测主入口（50 条 × pass³，可带 `--judge`） |
| `eval-core.cjs` | 评测判分核心（program + judge 考点） |
| `eval-extract-regression.cjs` | K17：评测 bad case → 回归样本 |
| `eval-baseline-diff.cjs` | K18：评测历史基线自动 diff |
| `calibrate-judge.cjs` | 评委校准 / 人工-评委一致率 |
| `validate-eval-cases.cjs` | 评测用例结构校验 |
| `agent-eval.cjs` | 六 agent 评测切片 |
| `eval-harness.cjs` | harness 七维确定性评测 |
| `measure-ai-commits.cjs` | K20：AI 提交占比度量（`[ai]` 标记） |

## 3D 茶园 / 茶亭验证

| 脚本 | 用途 |
|---|---|
| `verify-gardens.cjs` / `verify-pavilion.cjs` | 四园晴雨 / 茶亭截图验证 |
| `verify-garden-ambient.cjs` | 环境光 / 云影 / 雾 / 雨丝 / 音效（纯观赏氛围层；养成链路已于 T4.1 删除，原 `verify-water-rain.cjs` / `verify-water2.cjs` 随之退役） |
| `verify-controls.cjs` / `verify-field.cjs` | OrbitControls 拖拽缩放 / 茶行地形（茶行实例数 + 全景截图） |
| `screenshot-brew3d.cjs` / `probe-brew.cjs` | 冲泡 3D 截图 / 探针 |

## 截图（UI 视觉验证）

| 脚本 | 用途 |
|---|---|
| `screenshot-home.cjs` / `screenshot-growth.cjs` / `screenshots-home-share.cjs` | 首页 / 成长页 / 首页+分享截图 |
| `verify-brew-skins.cjs` / `verify-final.cjs` | 冲泡皮肤 / 终验 |

## 资源与构建工具

| 脚本 | 用途 |
|---|---|
| `compress-assets.cjs` | 静态图片压缩（mozjpeg） |
| `convert-3d-ktx2.cjs` | 3D 纹理 KTX2 转码（toktx.exe） |
| `dl-textures.cjs` | 纹理下载（一次性） |
| `add-doc-meta.cjs` | docs 元信息头批量补齐 |
| `gen-repomap.cjs` | 仓库地图生成（tree-sitter） |
| `pwa-offline-smoke.cjs` | PWA 离线冒烟 |
## 运维与部署（CI 外，手动执行）

| 脚本 | 用途 |
|---|---|
| `deploy-backend.ps1` / `update-backend.ps1` / `install-windows-service.ps1` | 后端部署 / 更新 / 注册 Windows 服务 |
| `backup-postgres.sh` / `rollback.ps1` | PostgreSQL 备份 / 部署回滚 |
| `https-selfsigned.ps1` / `https-issue-cert.sh` | 本地自签证书 / 签发证书 |
| `verify-nginx-headers.cjs` / `verify-nginx-routes.cjs` / `verify-alert-rules.cjs` / `verify-production.cjs` | nginx 安全头 / 路由白名单 / 告警规则 / 生产环境巡检 |

## AI 评测辅助（一次性）

| 脚本 | 用途 |
|---|---|
| `diagnose-rag.cjs` / `seed-extract.mjs` / `generate-relations.mjs` | RAG 诊断 / 种子抽取 / 关系图生成 |
| `slim-china-map.cjs` / `gen-hero-responsive.cjs` | 地图瘦身 / 响应式 hero 生成 |
| `parse-t09-annotations.py` | T09 人工复核完成版 TXT → 回填 samples-judge-t09.json 的 human 字段 |
| `audit-context-migration.cjs` / `audit-levels-consistency.cjs` | 常驻上下文迁移审计 / 六境跨语言一致审计 |


## 其他

| 脚本 | 用途 |
|---|---|
| `smoke.mjs` | 路由冒烟（默认 `http://localhost:4173`） |
| `backup-postgres.ps1` / `.sh` | PostgreSQL 每日备份（pg_dump\|gzip，保留 14 天） |
