---
title: r5-context-budget
last_updated: 2026-10-16
status: active
owner: yanhao
---

# R5：常驻层第三批压缩（编码规范 / 开发流程规范 / CONTEXT.md）

> 轨道：L0（治理/文档，无行为变更，无接口/数据模型/迁移变更）。
> 承接 R1-R4（`.harness/changes/` 无 R1-R4 切片，过程与实证见 `docs/token-optimization-guide.md` 附录 A）。

## 一、改了什么

**本切片自身的净效果（稳定读数）**：编码规范 / 开发流程规范 / CONTEXT 三个文件 9,183 → 7,813 token（−14.9%），加 AGENTS.md §6 去重（−102）合计 **−1,472 token/轮**。
常驻层合计 20,192 → **18,728 token**（−7.3%）；相对 R1 前基线 25,887 → 18,728（**−27.7%**）。读数含 CLAUDE.md / 三层语义.md / 技能规范.md；其中 `技能规范.md` 由**另一会话**并发改写，不属本切片，见 §三-0。

| 文件 | 改造前 | 改造后 | 手段 |
|---|---|---|---|
| `.harness/rules/编码规范.md` | 10,578 字符 / 4,327 token（303 行） | 8,650 / 3,563（208 行） | ① 26 项自检清单外置到 `.harness/skills/main-dev/coding-skill/SKILL.md`（按需加载，原文零改动）；② §五 红线 15 条全文表 → 编号索引 + 各域规则行内联 `【R#】`（编号是审计锚，单一维护点）；③ §35 回滚表、§37 分支提交 → 指向 `开发流程规范.md` §三/§二（同一约束只留一处）；④ §28/§30 与 §3/§5/§27 的重复判据合并 |
| `.harness/rules/开发流程规范.md` | 7,961 / 3,307（230 行） | 6,863 / 2,918（174 行） | ① §六 技能族计数表 → 指向 AGENTS.md §12（唯一计数源，verify-harness §4c 校验）；② §八 三级进化判据 → 指向 AGENTS.md §13（唯一权威），保留操作路径；③ §七 验证矩阵表 → 路由列表（命令唯一来源 = package.json / ci.yml，消一处漂移源）；④ §二 去 Example 列、§九 分组，判据全留 |
| `CONTEXT.md` | 4,244 / 1,549（82 行） | 3,363 / 1,295（68 行） | ① ADR 索引 20 行压双列、去 per-row 链接（路径在段首声明）、状态列全 Accepted 折叠为一句；② 7 条已完成里程碑移出常驻层（原文留档，常驻层不写完成态历史——AGENTS §13 写入五问④） |
| `scripts/audit-context-budget.cjs` | 总预算 21,000 | 总预算 19,500 + 三个被压文件单文件预算 | 棘轮收紧（只许收紧）；`AGENTS.md` 7,000 不变 |
| `scripts/audit-context-migration.cjs` | 新增 | — | 台账式零丢失校验（基线 sha256 + 锚点逐字命中 + dropped 必须给理由） |

**引用同步**（改路径/结构前的四处引用排查，实际改动）：

- `.harness/skills/main-dev/coding-skill/SKILL.md`：新增 §自检清单 26 项（原文逐行），收尾条目改为指向本技能。
- `.claude/agents/red-line-auditor.md`、`.claude/agents/code-reviewer.md`：工作流改指「§五 红线编号索引 + 各域 `【R#】`」。
- `docs/reference/code-standards-checklist-2026-10-12.md`：出处由行号（`:29`/`:134`/`:176`…）改为 § 小节号（行号在压缩后失效，§ 号未随压缩变动），并注明该报告局部编号与规范编号 R1-R15 不是同一套。
- 类名漂移清理：`AGENTS.md` §7、`.harness/rules/工程结构.md` §四、`.harness/skills/biz-dev/06-exception-handling/SKILL.md`（3 处）、`.harness/skills/main-dev/coding-skill/SKILL.md` 清单第 2 项：`BusinessError` → `BusinessException`（与代码实际类名对齐，见 `backend/src/main/java/com/tea/common/exception/BusinessException.java`；清单该项因此从「逐字保留」改判为「按代码修正」，台账 dropped 组有记录）。
- `.harness/rules/开发流程规范.md` §四：自检清单落点补注「（清单在 coding-skill 内）」。
- `docs/token-optimization-guide.md` 附录 A：补 R5 行与最终读数；`docs/plans/lessons.md`：追加本轮 2 条 lesson（压缩手段与边界 / 台账锚点校验抓错）。

## 二、怎么验证的（全部为跑过的输出）

```
node scripts/audit-context-migration.cjs   ERRORS: []（基线 sha256 ×3 一致；锚点 107 个，未命中 0；dropped 4 条均带理由）
node scripts/audit-context-budget.cjs      ERRORS: []（45,441 字符 ≈ 18,793 token ≤ 19,500；单文件预算均未超）
node scripts/verify-harness.cjs            ERRORS: []（AGENTS 224 行 | ADR 20 | CI 13 job | 技能 66/39）
node scripts/audit-redlines.cjs            ERRORS: []（人工核对项 R1/3/5/6/13/15 原样保留）
node scripts/audit-wiki-drift.cjs          ERRORS: []（42 端点双向一致）
```

零丢失口径：26 项自检清单 + 7 条里程碑 = 33 条**逐行原文命中**落点；15 条红线编号 + 关键判据 20 条 + 阶段 Gate/调度纪律抽样 = 74 个锚点命中。删除项仅 4 处，均为「同一约束两处维护」或「说明性/重复计数」，逐条带理由（见 `ledger.json`）。

## 三、遗留与发现

0. **并发会话警告**：本轮收尾时（2026-10-16 21:40）检测到 `.harness/rules/技能规范.md`、`.github/workflows/ci.yml`、`docs/plans/lessons.md` 被**另一会话**同时改写（mtime 同一秒，非本切片产物）。因此门禁读数是夹带对方在途改动后的结果；**提交前须重跑门禁**，并把属于对方的改动留在其切片里，别混进本 PR。
1. ~~`vite.config.ts` 与编码规范 §25 漂移~~ **已修（2026-10-16，用户授权按推荐执行）**：§25 原文写「Vite 手动 chunk 拆分（vendors/three/ai）+ 包体积预算 > 200KB 告警」，实测 `vite.config.ts` 无 `manualChunks`、`chunkSizeWarningLimit: 1000`，且配置注释写明"Three 单 chunk 0.8MB 不可再拆、业务 chunk 已靠数据外置 + echarts 按需控制在 500kB"——**实现是有意决策，故改规则对齐实现**（不引入 manualChunks）。新 §25：懒加载 + 数据外置 + echarts 按需 + 阈值 1000 + `VISUALIZE=1` 出 `stats.html`。
2. ~~AGENTS.md §6 与编码规范/DESIGN_SPEC 重复~~ **已修（同批）**：§6 原 6 条（Vue/类型/状态/样式/可访问性/字体图标）全部与 `编码规范.md` §17-26 或 `DESIGN_SPEC.md` 重复，压成两行指针（只列本入口独有的设计门禁 6 步与禁令速查 + 第三方库先查 package.json），AGENTS.md 15,484 → 15,167 字符（−317）、6,701 → 6,599 token（−102）。入口与 §7 后端规范（指针 + 要点）模式一致。
3. **`DESIGN_SPEC.md` 图标库漂移**：写「一个库一个家族（Iconify）」，实测依赖与代码均为 `lucide-vue-next`（`package.json` + `src/views/TeaRoom.vue` 注释）→ 已改 DESIGN_SPEC 为 `lucide-vue-next`。`docs/promotion/good-first-issues.md` Issue 4 仍按 Iconify 起草（对外草稿，改其内容属决策，未动）。
4. **`编码规范 §8` 缺 BCrypt**：AGENTS §7 有「密码哈希用 BCrypt」而权威文件未写 → 已补进 §8（Spring Security + JWT（密码哈希 BCrypt））。
5. `docs/promotion/good-first-issues.md` 引用已不存在的「AGENTS.md 前端设计·工程规范」段名（§6 已压缩为指针）；对外草稿未改。
6. **ADR-011 引用 `开发流程规范 §36`**：该文件只有 §一-§九，引用不存在的小节（历史文档，未改）。
7. **`/api/ai/*` vs `/api/v1/ai/*`** 前缀写法不统一（本轮原样保留，未擅自统一语义）。

## 四、回滚

```powershell
# 改造前副本（保留 14 天）
%LOCALAPPDATA%\tea-context-backups\2026-10-16\r5\{编码规范.md,开发流程规范.md,CONTEXT.md}
# 回滚三条命令
Copy-Item $env:LOCALAPPDATA\tea-context-backups\2026-10-16\r5\编码规范.md     .harness\rules\编码规范.md -Force
Copy-Item $env:LOCALAPPDATA\tea-context-backups\2026-10-16\r5\开发流程规范.md .harness\rules\开发流程规范.md -Force
Copy-Item $env:LOCALAPPDATA\tea-context-backups\2026-10-16\r5\CONTEXT.md      CONTEXT.md -Force
```

引用同步改动（coding-skill / red-line-auditor / reference checklist / AGENTS §7 / 工程结构.md）与预算棘轮一并 `git checkout` 回退；`git log` 是完整备份。回滚后须重跑：`audit-context-budget`（会因预算已收紧而报预算不足，需同时回退预算常量）。

## 五、提交计划（**未执行**，原因见下）

**不要现在提交**。工作区里同时存在另一会话的在途改动（`.harness/rules/技能规范.md`、`.github/workflows/ci.yml`、`package.json`、`scripts/verify-harness.cjs`、`.harness/skills/main-dev/quality-audit/SKILL.md`、`docs/skills/session-handoff.md`、`docs/plans/{TODO-PRIORITY,patterns,environment-review}.md`、`docs/{PLAN-harness-research-2026-10,agent-eval-baseline}.md`），且本切片引用的 `scripts/audit-context-budget.cjs`、`docs/plans/lessons.md`、`docs/token-optimization-guide.md` 是 R1-R4 的产物、仍未被跟踪。此时提交只有两种结果：把对方在途工作扫进本 commit（两件事混在一个不可评审的 diff 里），或漏带被引用文件（提交树里留下悬空引用）。**解除条件**：确认另一会话已收口（其改动或提交或撤销）后执行。

准备就绪的命令（本切片路径已逐条确认，均为本会话产出或本会话改写）：

```bash
git checkout -b chore/context-budget-r5
git add AGENTS.md CONTEXT.md DESIGN_SPEC.md \
        .harness/rules/编码规范.md .harness/rules/开发流程规范.md .harness/rules/工程结构.md \
        .harness/skills/main-dev/coding-skill/SKILL.md \
        .harness/skills/biz-dev/06-exception-handling/SKILL.md \
        .claude/agents/red-line-auditor.md .claude/agents/code-reviewer.md \
        docs/reference/code-standards-checklist-2026-10-12.md \
        .harness/changes/r5-context-budget/ scripts/audit-context-migration.cjs
# R1-R4 的产物必须同批带上（本切片引用它们，否则提交树悬空）：
git add scripts/audit-context-budget.cjs docs/plans/lessons.md docs/token-optimization-guide.md .cursorignore \
        package.json scripts/verify-harness.cjs .harness/rules/技能规范.md
git commit -m "[ai] chore(harness): cut always-on context to 18.7K token (R5: 编码规范/开发流程/CONTEXT) + budget ratchet"
git push -u origin chore/context-budget-r5 && gh pr create --fill
```

> 提交前重跑：`node scripts/audit-context-migration.cjs && node scripts/audit-context-budget.cjs && node scripts/verify-harness.cjs && node scripts/audit-redlines.cjs && node scripts/audit-wiki-drift.cjs`（并发会话会改动门禁输入，本切片的绿不能继承）。
