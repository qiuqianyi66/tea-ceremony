# 回归截图基线（scripts/regression）

固化关键页面渲染状态的回归测试，防止改版/重构后页面静默变坏。

## 覆盖页面

| 页面 | 路由 | 说明 |
|---|---|---|
| Home | `/` | 首页五幕进入体验 |
| Select | `/select` | 选茶页（也是 Brew/Taste 的前置） |
| Brew | `/brew` | 冲泡页（脚本自动选茶解锁守卫） |
| Taste | `/taste` | 品鉴页（脚本自动选茶解锁守卫） |
| Garden | `/garden/hangzhou` | 3D 茶园（默认园） |
| Share | `/share` | 品鉴卡只读页（空态渲染无错即过） |

## 用法

```powershell
# 1. 起 dev（或 preview）
npm run dev

# 2. 首次 / 确认改动后：覆盖基线
node scripts/regression/capture-pages.cjs --baseline

# 3. 日常回归：截 latest 并报告页面错误（有 console/page error 则 exit 1）
node scripts/regression/capture-pages.cjs

# 指定服务器地址（如 preview 的 4173）
$env:REGRESSION_BASE_URL="http://localhost:4173"
node scripts/regression/capture-pages.cjs
```

## 基线维护

- `docs/screenshots/regression/baseline/` 是权威基线，`latest/` 是每次运行快照。
- **只在前端视觉改动被确认后**更新基线（`--baseline`），日常运行不得覆盖。
- 有 console/page error 时脚本 exit 1：3D/WebGL 环境若无 GPU 导致的报错属环境噪音，需人工判断。
- 对比 latest 与 baseline：人工逐张对照，或接入 CI 时用 pixelmatch（未引入依赖，需要时再加）。

## 接入 CI（可选）

GitHub Actions 里：`npm run preview` 后台起服 → `node scripts/regression/capture-pages.cjs` → 对比 latest/baseline 差异（pixelmatch 阈值 ~0.1%），差异超阈值视为回归失败。
