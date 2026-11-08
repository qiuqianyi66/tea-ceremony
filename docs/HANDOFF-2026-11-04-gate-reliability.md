---
name: handoff-2026-11-04-gate-reliability
description: harness 门禁可靠性四批修复（PR #215–#218）：R2 空 catch、评测器自查、探针审计；含三条已否决方案与后续候选。
status: archived
date: 2026-11-04
last_updated: 2026-11-08
owner: yanha
---

# 任务交接：harness 门禁可靠性 + 评测器自查 + 探针审计 + 三件待办
> 生成于 2026-11-04，基于当时磁盘状态。接手先读本文件；前 40 行是必需区。

> **2026-11-08 复核（归档）**：#215–#218 已在 main；该交接自述「待决策：无」。附录 3 条后续候选（E2E 茶园读路径探针在 preview 模式不稳定、eval-harness SQL 正则捕不到 ORM 语义改动、脚本登记）都属已知边界，未做亦非缺陷。**无遗留待办。**

## 一、这是什么
仓库 `C:\Users\yanha\Desktop\tea`（一盏茶）四批门禁修复，均已合并 main：PR #215 / #216 / #217 / #218。main = `ea09d56`，工作区干净。

## 二、文件
交付物：`scripts/audit-redlines.cjs`、`scripts/lib/swallow-catch.cjs`、`scripts/eval-harness.cjs`、`scripts/verify-garden-ambient.cjs`、`scripts/audit-probe-selectors.cjs`、`.github/workflows/ci.yml`；回归锁：`scripts/tests/*.node-test.cjs`。
权威源（勿手改）：`.harness/changes/gate-reliability/`、`.harness/changes/eval-probe-selfcheck/`、`.harness/changes/probe-selector-audit/`。对账清单：`HANDOFF-2026-11-04_对账.json`（派生件）。

## 三、已拍板口径
1. main 只走 PR：`fix/*` → push → PR → 14 job CI 绿 → squash merge；禁直推 main。
2. R2 = 任意异常类型的空 catch（含仅注释）报红；豁免写块内 `// R2-allow: <≥8字且≥6文字/数字>`，全库 ≤3、同因 <3，每次打印理由正文。
3. 门禁修完必须自带回归锁并进 CI；证据不许只活在 `.tmp/`。
4. 产品按 T4.1 已删种植/浇水链路，不为它恢复探针（属新需求 + ADR）。
5. 冲突以磁盘最新版为准。

## 四、约束
中文、结论先行、每条结论附实测输出；commit `[ai] type(scope): desc`。

## 五、当前状态
- 已完成：PR #215 / #216 / #217 / #218；CI 93 例全绿，四次 main CI 均 success。
- 进行中：无。
- 待决策：无（三件待办全部完成）。
- 已否决：见附录（3 条）。

## 六、编辑纪律
改门禁脚本必须同步 `scripts/tests/` 回归锁；新增 `docs/` 文档必须带 frontmatter；`.harness/changes/` 历史切片只追加不回改；删文件前先 Read 并 grep 引用。

## 七、坑
- `node --test scripts/tests/`（传目录）在 node 25 报 MODULE_NOT_FOUND，用 glob 或显式列表。
- git 取文件清单需 `-c core.quotePath=false -z`，否则中文路径被转义。
- ADR 判据只看文件路径；批量 commit（>50 文件）与 squash 削弱归属精度，已跳过并留痕。
- 探针 `VERIFIED:` 行必须写清覆盖边界，别让「没验到」读起来像「通过」。

---
接手先读本文件。

接手口令（复制下面一行到新任务输入框即可启动）：
（原口令 `接手 HANDOFF-2026-11-04_任务交接.md` 已失效：文件已归档为本文件，无待办，不必接手。）

## 附录

### 已否决（跑过并测过）
1. 让 water 探针「元素缺席即判红」→ 本机干净 profile 下常态缺席 → 永久红灯，没人看 → 弃，改为 `VERIFIED:` 披露。
2. 只扩 R2 类型、不加豁免机制 → 立刻 2 处误报 → 逼人删注释或写假处理 → 弃，改为显式豁免 + 预算。
3. 手补评测报告元信息头 → 下次重跑必被覆盖 → 弃，改为生成器写入。

### 后续候选（按价值序）
1. **E2E 茶园读路径探针在 CI preview 模式下不稳定**（`isLoggedIn` 时序 + `basePath` 路由差异）：当前只验证「页面不崩」，「读路径同步」的 API 层覆盖见 `garden-api-sync.node-test.cjs`（静态验证 URL 契约 + GardenView 调用链）。要真验证读路径同步，需解决 preview 模式下的登录态注入与路由匹配，属 E2E 工程。
2. `eval-harness` 语义级盲区残留：SQL 关键词正则是启发式，不能捕「service 层调 ORM 改列语义但无 SQL 字面量」的场景（需 AST，YAGNI）。
3. 67 个脚本已全部登记 README（20 行补齐后 0 未登记）。

### 回补记录（读侧追加；写侧修订时消费并清空，≤5 行）
> 只记「因交接件缺失而真出错」的项：`[YYYY-MM-DD] 漏：<什么> → 错：<后果> → 处置：进必需区 / 进清单卡`
> **本轮无。**
