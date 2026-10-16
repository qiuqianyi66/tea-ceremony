---
title: HANDOFF-2026-10-16-context-budget-r5
last_updated: 2026-10-16
status: active
owner: yanha
---

# 交接：常驻层压缩 R5（编码规范 / 开发流程规范 / CONTEXT + AGENTS §6 去重）

> 给下一个会话：**先读这一份，再动手**。本切片已完工且五门禁全绿，**唯一未做的是 git 提交**（受并发会话阻塞，见 §五）。

## 一、目标仓库（别走错）

```
仓库：C:\Users\yanha\Desktop\tea      （一盏茶项目；main 分支，工作区有未提交改动）
备份：%LOCALAPPDATA%\tea-context-backups\2026-10-16\r5\  （三条改造前原文，保留至 2026-10-30）
切片：.harness/changes/r5-context-budget/{summary.md, review.md, ledger.json, removed-context.md}
```
⚠️ 默认会话工作目录可能是 `C:\Users\yanha\Desktop\yg-gateway`（另一个项目，本轮一字未动）。动手前先 `cd`，并对 tea 仓库跑 `git status`。

## 二、现状（实测，2026-10-16）

| 文件 | 前 | 后 | 降幅 |
|---|---|---|---|
| `.harness/rules/编码规范.md` | 10,578 字符 / 4,327 token（303 行） | 8,737 / 3,592（208 行） | −17.0% |
| `.harness/rules/开发流程规范.md` | 7,961 / 3,307（230 行） | 6,883 / 2,926（174 行） | −11.5% |
| `CONTEXT.md` | 4,244 / 1,549（82 行） | 3,363 / 1,295（68 行） | −16.4% |
| `AGENTS.md`（§6 去重） | 15,484 / 6,701（224 行） | 15,167 / 6,599（221 行） | −102 |
| **常驻层合计** | **20,192 token** | **18,728** | **−7.3%**（对 R1 前基线 25,887 → **−27.7%**） |

棘轮：`scripts/audit-context-budget.cjs` 总预算 21,000 → **19,500**，并给三个被压文件加单文件预算（3,900 / 3,200 / 1,400）。

## 三、手段（只有三类是有效的，别重复试第四类）

1. **派生/重复清单外置**：26 项自检清单 → `.harness/skills/main-dev/coding-skill/SKILL.md`（逐行原文）；红线 15 条全文表 → 各域规则行内联 `【R#】`（编号是 audit-redlines/skills 的引用锚，禁重编号）。
2. **同一约束只留一处**：编码规范 §35 回滚表 / §37 分支提交 → `开发流程规范.md` §三/§二；开发流程 §六 技能族计数 → AGENTS §12；§八 三级进化判据 → AGENTS §13；§七 验证矩阵表 → 路由列表（命令唯一来源 `package.json` / `ci.yml`）。
3. **完成态历史移出常驻层**：CONTEXT 7 条 `[x]` 里程碑 → `changes/r5-context-budget/removed-context.md`（原文）。
4. 另：**AGENTS §6 前端规范压成两行指针**（内容全在 `编码规范 §17-26` 与 `DESIGN_SPEC.md`），至此入口与 §7 后端规范模式一致。

## 四、验证（跑过的；期望输出）

```bash
node scripts/audit-context-migration.cjs   # ERRORS: []  kept 6 / moved 5 / dropped 5；锚点 107，未命中 0
node scripts/audit-context-budget.cjs      # ERRORS: []  ≈ 18,728 token ≤ 19,500
node scripts/verify-harness.cjs            # ERRORS: []  AGENTS 221 行 | ADR 20 | CI 13 job | 技能 66/39
node scripts/audit-redlines.cjs            # ERRORS: []
node scripts/audit-wiki-drift.cjs          # ERRORS: []  42 端点双向一致
npm run verify                             # exit 0
```
- `audit-context-migration.cjs` 是本轮新增的「零丢失」门禁：台账（`ledger.json`）记 基线 sha256 + 每条搬运项的锚点在落点逐字命中 + 删除必须写 `why`。**它会真报错**——本轮当场抓到 2 处搬运误写。
- 基线副本保留至 `baselineRetentionUntil: 2026-10-30`：期内缺失 = ERROR；过期后缺失 = WARN（只核对锚点）。两条分支均已实测。

## 五、明天第一件事：提交（现在被阻塞）

**解除条件**：确认另一会话已收口（`.harness/rules/技能规范.md`、`.github/workflows/ci.yml`、`package.json`、`scripts/verify-harness.cjs`、`.harness/skills/main-dev/quality-audit/SKILL.md`、`docs/skills/session-handoff.md`、`docs/plans/{TODO-PRIORITY,patterns,environment-review}.md`、`docs/{PLAN-harness-research-2026-10,agent-eval-baseline}.md` 这些**不是本切片**的改动，要么已提交要么已撤销）。

原因：本切片引用的 `scripts/audit-context-budget.cjs`、`docs/plans/lessons.md`、`docs/token-optimization-guide.md` 是 R1-R4 的产物、**仍未被 git 跟踪**；此刻提交只能二选一——把对方在途工作扫进本 commit（不可评审），或漏带被引用文件（提交树悬空）。命令与路径清单见 `changes/r5-context-budget/summary.md` §五。

```bash
# 提交前必须重跑（并发会话会改门禁输入，绿不能继承）
node scripts/audit-context-migration.cjs && node scripts/audit-context-budget.cjs && \
node scripts/verify-harness.cjs && node scripts/audit-redlines.cjs && node scripts/audit-wiki-drift.cjs
```

## 六、待决策（按优先级，都属治理模型改动，不属机械改写）

1. **是否继续压**：剩下的只有两条路 —— ①删规则（需你点名「哪几条不要」，我不会自己删）②整域外置（如把 `编码规范 §17-26` 前端域移出常驻层到按需文件）。**不开新轮次，默认维持现状**。
2. `docs/promotion/good-first-issues.md` Issue 4 仍按 **Iconify** 起草（实际用 `lucide-vue-next`），且引用已压缩掉的「AGENTS.md 前端设计·工程规范」段名 —— 对外草稿，改内容需你定。
3. `/api/ai/*`（编码规范 §9/audit-redlines R10）与 `/api/v1/ai/*`（CONTEXT 架构关键词/§15 前缀）写法不统一 —— 未擅自动语义。

## 七、本轮顺带修掉的规则-实现漂移（3 处，已按实现对齐）

| 位置 | 原写法 | 实现实测 | 处置 |
|---|---|---|---|
| 编码规范 §25 | 手动 chunk 拆分 + >200KB 告警 | `vite.config.ts` 无 `manualChunks`，`chunkSizeWarningLimit: 1000` | 规则改写为实测口径；**不引入 manualChunks**（配置注释写明是有意决策） |
| `DESIGN_SPEC.md` §五 | 图标库 Iconify | `package.json` = `lucide-vue-next`，代码注释同 | 改为 `lucide-vue-next` |
| 编码规范 §8 / AGENTS §7 / 2 个技能 | `BusinessError` | 代码类名 `BusinessException` | 4 处对齐；台账记录「按代码修正」 |

## 八、交接陷阱（踩过或差点踩）

1. **同仓库有并发会话**：收尾时检测到 3 个文件被另一会话同秒改写；技能规范.md 在 3,862 ↔ 3,974 字符间来回浮动。**任何门禁读数都可能是夹带对方的**，别继承我的绿。
2. **备份 14 天**（至 2026-10-30）：`%LOCALAPPDATA%\tea-context-backups\2026-10-16\r5\` 是回滚唯一来源（另有 git 历史）。
3. **行尾**：tea 仓库全 LF，`core.autocrlf=false`。批量脚本改写前先探测 CR 字节数（历史教训：300 行行尾噪音）。
4. **§ 小节号是长期锚点**，行号不是：本轮已把 `docs/reference/code-standards-checklist-2026-10-12.md` 的 `:NNN` 全部转成 §；**以后引用规则一律用 § + `R#`，禁写行号**。
5. **编码规范 §六 现在是空壳指针**（清单住在 coding-skill）；要改清单去技能文件改，别在规则文件里重抄。
