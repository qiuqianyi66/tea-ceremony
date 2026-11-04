# eval-probe-selfcheck Review

> 评审对象：`scripts/eval-harness.cjs`（报告元信息头 + ADR 判据文件化）、`scripts/tests/eval-harness.node-test.cjs`（+7 例）、
> `.github/workflows/ci.yml`（1 步改全量）、删除 `scripts/verify-water-rain.cjs` / `scripts/verify-water2.cjs`、
> `scripts/verify-garden-ambient.cjs`（删死播种分支 + 改 VERIFIED 措辞）、`scripts/README.md`（索引同步）。
> 分支 `fix/eval-probe-selfcheck`，基于 main `a9afd28`。评审日期 2026-11-04。
> 评审方式：逐条跑命令取证据（`node --test` / `node scripts/verify-harness.cjs` / `node scripts/eval-harness.cjs` /
> `git show --name-only` / `git grep`），不转抄 summary 结论。
> 结论：**通过（有条件）**，🔴 1（已由本文件闭合）／🟡 7 ／🟢 6 ／🔵 3。

## 一、🔴 阻断项

### R1. 分支当前 `verify-harness` 为红：缺 `review.md`（本文件即闭合）

```
$ node scripts/verify-harness.cjs
❌ ❌ .harness/changes/eval-probe-selfcheck/review.md 缺失（每切片必须 review）
ERRORS: [1]   exit 1
```

CI `harness-consistency` job 第一步就是 `node scripts/verify-harness.cjs`，故本分支进 PR 必红；
summary 的验收项 **F1-b「`ERRORS: []`」在评审开始时为不实断言**。
**处置**：本 review.md 落盘后复跑为 `ERRORS: []`（见 §四）。

## 二、🟡 主要项（清零后才可合并）

### Y1. 注释证据不实：`.empty-hint` 在 `src/` 并非 0 命中

`scripts/verify-garden-ambient.cjs:30-32` 新增注释写「`.plant-btn-3d` / `.empty-hint`，两个选择器在 src/ 已 0 命中」。
实测：

```
$ git grep -n -E "plant-btn-3d|empty-hint" -- src
src/components/brewing/TeaDragDrop.vue:341:  <div v-else class="empty-hint …
src/views/SelectView.vue:164:      <p v-else class="empty-hint">该分类暂无茶…
src/views/SelectView.vue:326:.empty-hint, .loading-hint {
```

`.plant-btn-3d` 确为 0 命中 ✓；`.empty-hint` 3 处命中（在其他页面）。
结论（garden 页无该节点、播种分支永不执行）仍成立——`GardenView.vue` 与 `components/three/` 内均无 `.empty-hint`；
但**证据句是错的**，后续 agent 会照抄。
**FIX**：注释改为「`.plant-btn-3d` 在 `src/` 0 命中；`.empty-hint` 仅存于 `SelectView` / `TeaDragDrop`，garden 页已无此节点」。

### Y2. summary 的「全仓 grep 确认仅 `scripts/README.md` 提及」不实

```
$ git grep -n -E "verify-water-rain|verify-water2" -- . ':!scripts/README.md'
.harness/changes/gate-reliability/review.md:63,64,122
.harness/changes/gate-reliability/summary.md:27
```

历史切片记录可以不改（已归档的评审证据），但声明必须如实。
**FIX**：summary §三「删除物」改为「除 `.harness/changes/gate-reliability/` 的历史记录外，仅 `scripts/README.md` 提及（历史记录免改）」。

### Y3. `noMigrate` 豁免仍是措辞驱动，与相邻的 ADR 判据口径相反

本次把 ADR 判据从「匹配 summary 措辞」改成「文件证据」，同一个代码块往下 20 行处，
`db-migrations.sql` / `rollback.sql` 两项仍由 summary 措辞豁免（`eval-harness.cjs:76,87-90`），
且**已经采集好的 `changedFiles` 没有被复用**。实测口径冲突：

```
m1-ai  summary.md:4  「本变更**无数据库迁移**（ai_usage_logs 表 V1 已建 …）」
       同一 commit 含 backend/src/main/java/com/tea/ai/entity/AiUsageLog.java
       → 两个不存在的迁移文件被计 ✓（豁免），无人校验该声明
m1-auth summary.md:4 同上，commit 含 …/auth/entity/User.java
```

即：**同一个函数里现在并存两种口径**（ADR 看文件、迁移看措辞），而文件的真相就在手边。
**FIX**：用 `changedFiles` 派生 `noMigrate`——文件证据显示未触 `db-migrations.sql`/`migration/`/`entity/` 时才豁免；
措辞与文件冲突时按文件判定，并在 note 里打印「声明与文件证据冲突」。

### Y4. 文件证据口径 ≠ 切片边界：批量提交串味、反向漏判

`git log --format=%H -- .harness/changes/<切片>` 只列**碰过切片目录**的 commit，再取这些 commit 的**整份文件清单**。
两个方向都实测到了偏差（对 38 个存量切片全量回放）：

| 偏差 | 实例 | 证据 |
|---|---|---|
| 串味（假阳性） | `ab-experiments` / `ai-resilience` / `telemetry-stability` 三者 ADR 全判 OK | 三者共享同一 151 文件提交，union 里互相带入对方 `db-migrations.sql` 与 `docs/ADR` |
| 追认扣分（假阴性） | 7 个切片由 OK 翻 MISS：`m1-ai` `m1-auth` `m1-compose` `m1-frontend` `m1-record` `m1-tea` `phase2-knowledge` | ADR 若落在**没碰**切片目录的独立 commit，就永远采不到 |

`m1-*` 属 ADR 制度之前（切片 commit 2026-10-06，ADR-001…005 于 2026-10-07 才补写），
「当时确实没有 ADR」可辩护；但口径本身与「切片归属」不对齐，属结构性问题，不是历史个例。
**FIX**：采集口径限定「切片 summary 声明的范围表 ∩ commit 时间窗」；或对 `docs/ADR/` 放宽为
「切片时间窗内新增/修改的 ADR」，并在 note 打印依据 commit 短哈希。

### Y5. CI 与本地两套结果：`core.quotePath` 默认值不同

CI 是 fresh clone，`core.quotePath` 用默认 `true`，非 ASCII 路径会被转义加引号：

```
$ git -c core.quotePath=true show --name-only --format= a9afd28
".harness/rules/\347\274\226\347\240\201\350\247\204\350\214\203.md"     ← CI 视角
$ git -c core.quotePath=false show --name-only --format= a9afd28
.harness/rules/编码规范.md                                              ← 本地视角（本仓已设 false）
```

`adrVerdict` 的 `f.startsWith('docs/ADR/')` 遇到 `"docs/ADR/…"`（前导引号）必然失配。
存量 ADR 全为 ASCII 文件名，故今天无影响；但「同一判据两种结果」正是本切片要消灭的问题类型，
而这个解析层是本次新写的。
**FIX**：`execFileSync('git', ['-c', 'core.quotePath=false', 'show', '--name-only', '--format=', c])`，
或加 `-z` 并按 NUL 切分。

### Y6. 新增两处 `execSync` 把 `slice` 直接拼进 shell 命令

`eval-harness.cjs:94`、`:103` 均为模板串拼 shell。CI 里 `slice` 来自
`ls -1dt .harness/changes/*/ | … | xargs basename`，即 **PR 可控的目录名**，含 `;`/`$( )`/反引号即可注入。
实测边界（**本地 Windows 未复现**，`cmd.exe` 不把 `;` 当分隔符：`out: ""`；
POSIX `/bin/sh` 下成立，本机无可用的 `bash` 作证 → **此段为未复核断言**）。
该模式在存量行（`eval-harness.cjs:165`）已存在，本轮又复制两次。
**FIX**：本次新增的两处改用 `execFileSync('git', ['log', '--format=%H', '--', relPath])`，不改评测口径。

### Y7. 数据模型盲区：前端 IndexedDB 与「只改 service 层」结构性不可判

`src/services/storage/db.ts` 是 Dexie schema（`version(1)`…`version(8).stores()`），按 AGENTS.md §8 属 L3（新增表须 ADR），
但路径不含 `entity/`、`migration/`、`db-migrations.sql` → `touchesSchema` 为假 → **恒判 n/a 不计分**。
同理「只改 service 层改持久化语义」按路径原理不可见；summary 只把这条反转条件写在切片文档里，
代码注释与规则层都没有，下个切片不会读到。
**FIX**：`touchesSchema` 增加 `src/services/storage/db.ts`（Dexie `version(` 递增）；
`adrVerdict` 注释写明「语义级数据模型变更不可检测」这一残留盲区。

## 三、🟢 / 🔵

| # | 级别 | 内容 | FIX / 处置 |
|---|---|---|---|
| G1 | 🟢 | 元信息头的测试是**复制**了 verify-harness 的正则，不是复用（`verify-harness.cjs` 无 `module.exports`）→ 门禁改正则时锁不响 | 抽 `scripts/lib/doc-meta.cjs` 导出 `hasDocMeta()`，两边同源 |
| G2 | 🟢 | `effective.map(([n, ok, d]) => …)` 丢弃了第三列 `d`：豁免项显示 ✓，读者会误以为 `db-migrations.sql` 存在（实测本切片报告就是 `db-migrations.sql:✓` 而文件不存在） | 打印 `ok ? '✓' : '✗'` 之外带上 `d`（`零迁移豁免`） |
| G3 | 🟢 | `.slice(0, 20)` 静默截断：切片 commit > 20 时文件清单不全，无提示 | 截断时 note 里打「已截断，依据 N/总 commit」 |
| G4 | 🟢 | 每次评测最多 20 次 `execSync`（实测 `git show` ~30-60ms/次） | 合并为一次 `git show -z --name-only` + NUL 切分（非瓶颈，仅提示） |
| G5 | 🟢 | `verify-garden-ambient.cjs:10` `const fs = require('fs')` 未使用（存量，非本次引入，不要求在本次删） | 记录 |
| G6 | 🟢 | `metaHeader` 用 `toISOString()`（UTC）：Asia/Shanghai 00:00–08:00 会写前一天日期，与 `add-doc-meta.cjs`（用 commit 日期）口径不同 | 用本地日期（`toLocaleDateString('sv-SE')`） |
| B1 | 🔵 | CI `eval-harness` 步骤用 `ls -1dt` 挑最新切片；checkout 后所有目录 mtime 近似同批，选中项不稳定（存量，不在本次范围） | 记录 |
| B2 | 🔵 | `docs/agent-eval/` 现有 7 份报告都是手补头（本次之前），今后不应再手改 | 记录 |
| B3 | 🔵 | 本次新增的 4 项断言只锁纯函数，未锁「报告文件头」端到端（fixture 目录 + 真写盘） | 可选加 1 例：临时目录跑一次生成器断言首行 |

## 四、四项重点实测复核

### 4.1 ADR 新判据是否真的消掉假阳性、是否漏判「动了数据模型却只改 service 层」

- **假阳性（措辞命中）已消除** ✓：`gate-reliability/summary.md:4` 写「**无**数据库迁移」（旧正则 `/迁移/` 命中）→ 新判据输出
  `ADR:n/a（本切片未触数据模型/迁移）`（`node scripts/eval-harness.cjs eval-probe-selfcheck` 同款输出可见判据生效）。
  旧实现第二个缺陷（`git log --name-only -- .harness/changes/<切片>` 里 `names.includes('docs/ADR/')` 恒假）也一并修掉 ✓。
- **没有新造假阳性**：`scripts/`+`docs/` 切片 → n/a；只改 `service/*.java` → n/a（测试用例已锁）。✓
- **新增了两类偏差**：批量提交串味（Y4，实测 3 个切片）、`core.quotePath` 本地/CI 分叉（Y5）。
- **数据模型盲区仍在**：只改 service 层改持久化语义 → 路径证据原理上不可见（Y7）；
  前端 Dexie schema 变更完全不覆盖（Y7）。**结论：假阳性消除了，假阴性换了位置，未真正闭合。**

### 4.2 分母 `(passed + ok) / (effective.length + adrWeight)`

三种情形逐一验算（`effective.length` 恒为 4）：

| 情形 | adrWeight | 分子 | 分母 | 例 |
|---|---|---|---|---|
| 不适用 | 0 | passed | 4 | 本切片：3/4 = 75（实测报告 75 ✓） |
| 适用且满足 | 1 | passed+1 | 5 | 有 `docs/ADR` 的切片：5/5 = 100 |
| 适用未满足 | 1 | passed | 5 | 触 schema 无 ADR：4/5 = 80 |

`applicable=false` 时 `adr.ok` 必为 `false`（`ok = hasAdr`，而 `applicable = hasAdr || touchesSchema`），
故分子不会凭空 +1，分母正确排除。**数学正确 ✓**。
唯一口径提醒：不适用时**降分母等于涨分**（60→50 类切片的流程维实测变低是因为 `effective` 里其他项缺失，非本式），
且 git 不可用时 `catch` 静默退回 n/a（`adrWeight=0`）——**git 挂掉是零成本通过**，属 fail-open，
建议在 `catch` 里写 note「git 不可用，ADR 判据降级为 n/a」使降级可见。

### 4.3 报告元信息头：自带且重跑不丢；满足 verify-harness 判定

```
$ node scripts/eval-harness.cjs eval-probe-selfcheck
✅ 流程完整性: 75/100 — summary.md:✓ … ADR:n/a（本切片未触数据模型/迁移）
$ head -6 docs/agent-eval/eval-probe-selfcheck-eval.md
---
last_updated: 2026-11-04
status: active
owner: yanha
---

$ node scripts/eval-harness.cjs eval-probe-selfcheck   # 重跑
$ head -3 docs/agent-eval/eval-probe-selfcheck-eval.md
---
last_updated: 2026-11-04
status: active
$ node scripts/verify-harness.cjs → 无「docs/ 缺元信息头」警告 ✓
```

判定正则 `verify-harness.cjs:309` `/^---[\s\S]*?---/` + `includes('last_updated')` 满足 ✓；
`status: active` 在 `VALID_STATUS`（`active|draft|deprecated`）内 ✓（`:318`）；
字段与 `add-doc-meta.cjs:54` 模板逐字一致（`last_updated`/`status`/`owner: yanha`）✓。
**结论：成立。**（重跑不丢由生成器保证，已实测两次。）

### 4.4 删除两个探针的覆盖缺口

| 正交价值 | `verify-water-rain` | `verify-water2` | `verify-garden-ambient`（保留） |
|---|---|---|---|
| 雨天截图 | ✓ `verify_3d_rain2.png` | ✓ `verify_3d_rain3.png` | ✓ `verify_3d_rain.png`（`:48-50`） |
| console/pageerror 捕获 | ✓ | ✓ | ✓ 两者都监听（`:22-27`） |
| telemetry 204 拦截 | ✓ | ✓ | ✓（`:20`） |
| 浇水粒子状态 / 茶树 hitbox | 只截图 | ✓ `Points` 采样 | 不覆盖 → **功能已被 T4.1 删除**，无需覆盖 |
| 元素存在性守卫 | 只 `isVisible()` 后跳过 | 同 | **更严**：`page.click()` 直接抛错 |

前两项正交价值确实被 garden-ambient 覆盖，且 garden-ambient 的选择器当前有效
（`GardenView.vue:150-157` 渲染 `title="切换到雨天"/"切换到晴天"/"开启环境音"/"关闭环境音"`，与探针点击序列一致）✓。
**结论：无覆盖缺口**（被删的只剩已删产品的验收面）。
残留引用见 Y2（历史切片记录 4 处），garden-ambient 的 `fs` 未用见 G5。

### 4.5 CI 全量 `node --test` 的展开与环境依赖

- 4 个文件：`calibrate-judge` / `eval-core` / `eval-harness` / `swallow-catch`，**本地 67 例全绿**：
  `node --test scripts/tests/*.node-test.cjs` → `pass 67 / fail 0`。
- **glob 展开成立** ✓：`run:` 在 ubuntu-latest 用 `bash -e`，shell 先展开；即使不展开，Node 22 的 `--test` 也支持
  模式匹配（本地 node v25.8.0 用引号模式实测 67 例通过）→ 双保险。文件名无空格/无中文，展开安全。
- **环境依赖风险：无**。4 个文件只 `require` `node:test` / `node:assert/strict` + 仓内相对模块；
  被引入的 `eval-core.cjs` / `lib/swallow-catch.cjs` **零 `require`**，`calibrate-judge.cjs` / `eval-harness.cjs` 有
  `require.main === module` 守卫、`require('child_process')` 在导入期不执行 → job 不跑 `npm ci` 也安全 ✓。
- 唯一未复核项：本地 node 25 vs CI node 22 差异；4 个文件未用 22 之后新增的 API（无 `Object.groupBy` /
  `findLast` / `withResolvers` / `toSorted`）→ **低风险**。

## 五、结论与放行条件

**本次 diff 的核心意图成立**：报告头从「手补」变成「生成」，ADR 从「猜措辞」变成「看文件」，两个验已删功能的探针退役，
CI 从单文件扩成全量（67 例进闸）。四项重点均有实测支撑（§四）。

**放行条件（🟡 清零）**：Y1、Y2 属「证据句不实」，改一两行即可；Y3、Y5、Y6 是一到六行的口径/解析修法；
Y4、Y7 若不改代码，至少要把口径写进 summary 的「不做什么」与代码注释，不许只留在切片文档里。

**本轮引入项 🔴 0 🟡 7**

## 六、处置（评审后逐条修复，2026-11-04）

| # | 处置 | 落点 | 实测 |
|---|---|---|---|
| 🔴 R1 | `review.md` 缺失导致 `verify-harness` 首步即红 → 由本文件闭合 | `.harness/changes/eval-probe-selfcheck/review.md` | `node scripts/verify-harness.cjs` → `ERRORS: []` |
| 🟡 Y1 | 证据句改为可复核的事实：`.plant-btn-3d` 全仓 0 命中；`.empty-hint` 仅存于 SelectView/TeaDragDrop，茶园页无此节点 | `scripts/verify-garden-ambient.cjs:30-33` | `Get-ChildItem src -Recurse -Include *.vue,*.ts \| Select-String plant-btn-3d` → 0 |
| 🟡 Y2 | summary 的 grep 口径改为「脚本索引 + 历史切片留痕，后者不回改」 | `summary.md` 自检清单 | 与前文一致 |
| 🟡 Y3 | 新增 `deriveNoMigrate(changedFiles, summaryText)`：文件证据优先，冲突时按文件判并打印冲突句 | `scripts/eval-harness.cjs`（`noMigrateInfo`） | 新单测 3 例：声明「无迁移」+ 文件含 `db-migrations.sql` → `{value:false, conflict:true}` |
| 🟡 Y4 | 批量提交（单 commit 改 >50 文件）不再计入 ADR 证据，跳过并在报告 note 留痕；口径写进 summary「不做什么」 | `scripts/eval-harness.cjs`（`BATCH_COMMIT_FILE_LIMIT`） | 本切片 16 文件未触发；`gate-reliability` squash commit 16 文件 → 正常判定 `ADR:n/a` |
| 🟡 Y5 | git 调用改 `execFileSync` + `-c core.quotePath=false` + `-z`，中文/空格路径不再被引号转义或拆分 | `scripts/eval-harness.cjs`（`gitOut`/`splitNul`） | 实测 `git show --name-only -z` 解析出 16 个路径，首项 `.github/workflows/ci.yml` |
| 🟡 Y6 | 两处把 `slice` 拼进 shell 的调用改为参数数组传参，不再经 shell | 同上 | 全文件已无 `` `...${slice}` `` 形式的 git 调用 |
| 🟡 Y7 | `touchesSchemaPath` 纳入 `src/services/storage/db.ts`（Dexie 表结构，AGENTS §8 的 L3），并在注释写明语义级变更不可检测 | `scripts/eval-harness.cjs` | 新单测：`db.ts` → true，`swallow-catch.cjs` → false |
| 🟢 | 报告里豁免标记改为可见（`db-migrations.sql:✓(零迁移豁免)`）；`slice(0,20)` 截断打印提示；日期改用本地时区（不再用 UTC 写前一天） | `scripts/eval-harness.cjs` 报告段 | 见下方重跑输出 |
| 🟢 G5 | `verify-garden-ambient.cjs` 里未使用的 `fs` 属存量，不在本切片范围，未动 | — | 保持原样 |
| 🔵 | `docs/agent-eval/` 旧报告按旧口径产出，不回填；切片的 squash 归并会让 commit 粒度不可还原，同属留痕限制 | summary「不做什么」 | 已写明 |

**残留限制（写清而非掩盖）**：① 语义级数据变更（只改 repository SQL / service 内表语义）看不到；
② 批量提交与 squash 归并会削弱「按 commit 归属」的精度，实现选择跳过并留痕；
③ 单测复制了 `verify-harness` 的元信息头正则（该脚本无 exports），非同源，正则变更需同步两处。

### 重跑实测

```
$ node --test scripts/tests/eval-harness.node-test.cjs      → 17/17 pass
$ node --test scripts/tests/*.node-test.cjs                → 71/71 pass（4 个文件）
$ node scripts/eval-harness.cjs eval-probe-selfcheck --verify → 见 docs/agent-eval/eval-probe-selfcheck-eval.md
$ npm run verify                                            → ERRORS: [] ×4 段
```

**结论：🔴 0 / 🟡 0 — 清零通过**（Y1-Y7 已修，🟢/🔵 已留痕，残留限制写入代码注释与 summary）
