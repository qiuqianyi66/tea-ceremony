---
name: hygiene-audit-2026-10-17
description: tea 仓库「反屎山」盘点报告（2026-10-17）——按类别给出检查方法、实测结论与处置，附待决策项与复现命令。
last_updated: 2026-10-17
status: active
owner: yanha
---

# 反屎山盘点（2026-10-17）

> 目的：把「仓库脏不脏」从感觉变成可复现的数字，并记下每一项的处置。
> 复现：本文每节的命令都可直接跑；结论列是 2026-10-17 现场实测值。

## 0. 一句话结论

**没有想象中脏**：仓库根目录的调试产物一个都没被跟踪（35 个 / 21.8 MB 全在 `.gitignore` 覆盖下）；真正的债是「重复定义」和「历史文档与现行入口混在一层」，本轮已清。剩下需要拍板的是三个大体积目录。

## 1. 被跟踪的可再生文件 / 凭据文件

```powershell
git -c core.quotepath=false ls-files | Measure-Object -Line
git ls-files --error-unmatch gateway-config.b64.txt .env deploy-gateway.tar.gz yg-gateway-src.tar.gz
Get-ChildItem . -File | Where-Object { $_.Extension -in '.log','.txt','.png','.gz','.zip' }
```

| 检查 | 实测 | 处置 |
|---|---|---|
| 根目录调试产物（`pr69-*`、`mvn-*.log`、`verify_*.png` 16 张、`*.tar.gz`） | 35 个 / 21.8 MB，**全部未跟踪**且被 `.gitignore` 覆盖 | 无需入库动作；本地占盘可自行删 |
| 凭据类（`.env`、`gateway-config.b64.txt`、`deploy-gateway/`、`yg-gateway-secrets/`） | 全部 `git check-ignore` 命中，未被跟踪 | 无需动作（若曾进过历史，需轮换密钥，属安全事件另议） |

## 2. 被跟踪体积分布

```powershell
git ls-files | ForEach-Object { ... } # 按目录汇总字节数
```

| 目录 | 文件数 | 体积 |
|---|---|---|
| `.agents/skills` | 881 | **34.0 MB** |
| `docs/screenshots` | 84 | **29.2 MB** |
| `public/3d` | 11 | **22.8 MB** |
| `src` | 177 | 4.3 MB |
| `backend` | 222 | 0.7 MB |
| `.harness/skills` | 42 | 0.1 MB |

**待决策**：前三者合计 86 MB，占仓库 pack 的一半以上。可选路线：① `docs/screenshots` 只留基线图、审计截图移出 git；② 纹理/HDR 走 Git LFS 或 CDN；③ 维持现状但写进 `.gitattributes` 标注。**本轮不动**（改存储形态属不可逆决策）。

## 3. 重复定义（代码层）

```powershell
git grep -n "interface ApiResponse" -- src
git grep -n "const API_BASE" -- src
```

| 重复项 | 原状 | 处置 |
|---|---|---|
| `ApiResponse<T>` | 4 处逐字相同（`auth`/`garden`/`records`/`teas`） | → `src/services/api/types.ts` 单一来源（PR #79） |
| `API_BASE` | 3 处同一行（`http.ts` / `teaAI.ts` / `HealthView.vue`） | → `src/services/apiBase.ts` 单一来源（PR #79 + #81） |

现状核对：两处定义各只剩 1 个。

## 4. 死脚本 / 孤儿文档

```powershell
# 孤儿脚本：scripts/*.cjs 中未被 package.json / CI / 其他脚本 / 文档引用的
# 孤儿文档：根目录 *.md 在其他文件中引用数为 0
```

| 类别 | 实测 | 处置 |
|---|---|---|
| 无引用验证脚本 | 3 个（`verify-garden-3d-interact` / `-phase4` / `-phase5`，共 396 行） | 删除，技术结论搬进 `docs/plans/lessons.md`（PR #81） |
| 过期规划/调研文档 | 7 份（引用数 0–3，基本只互相引用） | 归档到 `docs/plans/archive/`，补元信息头 + 「已归档」提示（PR #82） |

根目录 `.md`：**22 → 15 个**。`PLAN.md`（11 处引用，含 `plan-control` skill）与 `V3_ROADMAP.md`（7 处，含 ADR-009）仍在根目录。

## 5. 规则漂移

| 问题 | 结论 |
|---|---|
| 编码规范 §15 `/api/v1/{resource}` vs 实际前缀 | tea 是**双栈并存**：新栈 Spring Boot `/api/v1/*`、旧 FastAPI `/api/*`（仅维护）。§15 已改成双栈并列写法（PR #80），并沉淀「判前缀要三处对齐」lesson |
| `AGENTS.md §6` 与编码规范 §17–26 重复约 600 字符 | **已不成立**：现行 §6 只有两行指针 + 设计门禁 6 步 + 设计禁令速查，无重复条文 |

## 6. 待决策 / 未做

1. 三大体积目录（86 MB）走 LFS / 移出 git / 维持现状 —— 需拍板。
2. 超大单文件拆分：`TeaBrewSceneInner.vue` 1322 行、`BrewView.vue` 812、`useAudio.ts` 789 —— 有 CI E2E 兜底，但属结构性改动，单独一轮做。
3. `.codex/skills` 与 `.agents/skills` 是否重复：`.codex/` 未入库（本地目录），无仓库层重复问题。
