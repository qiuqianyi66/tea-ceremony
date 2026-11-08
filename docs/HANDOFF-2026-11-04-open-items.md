---
name: handoff-2026-11-04-open-items
description: 待办总规划（A8 RAG 召回 + 外部条件阻塞 + 已知限制）；A8 仍卡上游网关 key，外部条件三条未解。
status: archived
date: 2026-11-04
last_updated: 2026-11-08
owner: yanha
---

# 任务交接：一盏茶待办规划（A8 RAG 命中率 + 等外部条件 + 已知限制）
> 生成于 2026-11-04，基于当时磁盘状态。接手先读本文件；前 40 行是必需区。

> **2026-11-08 复核（仍未闭合的两条）**：① P1 A8 卡点未变 —— 网关 key 仍不可用，`LIB-005 君山银针` 语料有数据却 miss 且无法归因；验收口径 `ragRecallK ≥ 0.80` 与 `scripts/diagnose-rag.cjs` 流程不变。② P2 外部条件未解：DashScope 充值、SFT 训练预算、体积目录存储形态；其中体积实测已从 86 MB 降到 60.5 MB（`.agents/skills` 31.1 / `docs/screenshots` 6.6 / `public/3d` 22.8，screenshots 已不成问题）。权威清单仍在 `docs/plans/PLAN-open-items-2026-10-17.md`。

## 一、这是什么
一盏茶仓库（`C:\Users\yanha\Desktop\tea`）**待办总规划**：把散在 `PLAN-open-items-2026-10-17.md` / `TODO-PRIORITY.md` 的剩余事项逐条实测后汇成可执行清单（PR #215–#218 已合并）。

## 二、文件
待办清单（权威源）：`docs/plans/PLAN-open-items-2026-10-17.md`（仅 A8 未完成）+ `docs/plans/TODO-PRIORITY.md`。
过程记录：`docs/HANDOFF-2026-11-04-gate-reliability.md`；对账快照属派生物（`对账清单.py snapshot` 生成），2026-11-08 复核后已过期，未入库。

## 三、已拍板口径
1. main 只走 PR（`fix/*`/`feat/*` → push → PR → 14 job CI 绿 → squash merge），禁直推 main。
2. 门禁修完必须自带回归锁并进 CI；证据不许只活在 `.tmp/`。
3. 产品按 T4.1 已删种植/浇水链路，不为它恢复探针（属新需求 + ADR）。
4. A8 验收（2026-11-04 换轨）：主指标 `ragRecallK` ≥ 0.80（KB 依赖 case 中 sources>0 占比）、全量分不降、每条 miss 可归因；`ragHitRate` 降为观测、不进验收。

## 四、约束
中文、结论先行、结论附实测输出；commit `[ai] type(scope): desc`；E2E 用真实等待。

## 五、当前状态
- **已完成**：PR #219 已 squash 合并 main（`08dd68c`，14 job 全绿）：验收换 `ragRecallK`（`ragHitRate` 降观测）、语料对齐 + 指纹漂移审计进 CI、KB case 3→10、`culture_query` 记 keyword/各表命中数进 trace。
- **进行中**：A8 活体归因**卡在上游 key**（详见附录「活体评测现场」）：评测 profile 跑通，但 `.env` 的网关 key 被 7863 拒绝（401）→ 后端降级本地规则库 → 工具路径不执行 → 拿不到 `rag_*`。
- **待用户决策**：SFT T13 训练预算；三大体积目录（86 MB）存储形态；是否补 `茶寿` 语料。
- **已否决**：见附录（3 条）。

## 六、编辑纪律
改门禁脚本必须同步 `scripts/tests/` 回归锁；新增 `docs/` 文档带 frontmatter；`.harness/changes/` 只追加不回改；删文件前先 Read 并 grep 引用；A8 改动配单测并区分「口径变化/质量提升」。

## 七、坑
- `node --test scripts/tests/`（传目录）在 node 25 报 MODULE_NOT_FOUND，用 glob/显式列表。
- git 取文件清单需 `-c core.quotePath=false -z`，否则中文路径被转义。
- E2E 茶园读路径探针在 preview 模式不稳定（`isLoggedIn` 时序 + `basePath` 差异），只验「页面不崩」。
- 其余坑（ADR 归属精度、探针 VERIFIED 边界）见附录「坑（补）」。

---
接手先读本文件。

接手口令（复制下面一行到新任务输入框即可启动）：
（原口令 `接手 一盏茶待办规划_任务交接.md` 已失效：待办权威清单在 `docs/plans/PLAN-open-items-2026-10-17.md`，未闭合项见本文件顶部复核。）

## 附录

### 待办规划（按价值序，每条可独立执行）

#### P1：A8 RAG 命中率（唯一真未完成项）
- **现状（2026-11-04 口径更正）**：`ragHitRate 0.16` 是错口径（分母含 44 条按设计不该检索的 case）；子集口径 `ragRecallK` 已上线。真问题剩 `LIB-005 君山银针`（语料有数据却 miss）。
- **假设**：H1（chunks 无数据/无 embedding）已**实测排除**（327/327 ready+embedded）；H2（阈值 0.55、只补空位）与 H3（语料覆盖）待验。
- **步骤**：
  1. `node scripts/diagnose-rag.cjs --db`（需 Spring DB `tea` + pgvector；本机原生 PG 17.7 无 vector，实测报 `culture_chunks 不存在`）
  2. `--api` 逐条打 `/api/v1/culture/search` 出未命中清单 → 标注「应有知识点」定性 H2/H3
  3. 改一处、同口径重跑对比
- **验收**：`ragRecallK` ≥ 0.80（KB 依赖 case 中 sources>0 占比）、全量分不降、每条 miss 可归因；`ragHitRate` 只作观测。
- **风险**：为提命中而提命中会污染质量基线——每处改动配单测锁死，报告区分「口径变化」与「质量提升」。

#### P2：等外部条件（不是没人做，是做不了）
1. **评测 live 批 / 正式基线**：等 DashScope 充值（¥50 量级）→ 解锁 T08 pass³、T09 judge 校准、v6 live 批、A3 缓存验证。
2. **SFT T13 训练**：等用户给预算上限 → 241 条语料直接训练 LoRA（单专家 mentor）。
3. **三大体积目录 86 MB**（`.agents/skills` 34 / `docs/screenshots` 29.2 / `public/3d` 22.8）：等存储形态决策 → 仓库瘦身。

#### P3：已知限制（边界，不是待办）
1. **E2E 茶园读路径探针在 CI preview 模式不稳定**（`isLoggedIn` 时序 + `basePath` 差异）：只验「页面不崩」；读路径同步的 API 层覆盖在 `scripts/tests/garden-api-sync.node-test.cjs`（静态验 URL 契约 + 调用链）。
2. **`eval-harness` SQL 关键词正则**捕不到「service 层调 ORM 改列语义但无 SQL 字面量」（需 AST，YAGNI）。

### 已否决（跑过并测过）
1. water 探针「元素缺席即判红」→ 干净 profile 下常态缺席 → 永久红灯 → 弃，改 `VERIFIED:` 披露。
2. 只扩 R2 类型不加豁免 → 立刻 2 处误报 → 逼人写假处理 → 弃，改显式豁免 + 预算。
3. 手补评测报告元信息头 → 下次重跑必被覆盖 → 弃，改为生成器写入。

### 活体评测现场（2026-11-04 晚，未闭合）
- **环境**：Docker 已起，`tea-db-1` 健康，`culture_chunks` **327/327 ready 且有 embedding**（H1 排除）；`tea-backend-1` 旧镜像健康跑 18080；frontend 起不来（`certs/` 空，nginx fail-closed）。
- **评测 profile 事实**：`application-gateway.yml` 的 `spring.ai.model.embedding: none` —— 评测**显式关掉向量分支**，`ragRecallK` 量的是纯 ILIKE 召回。- **卡点**：.env 的 `AI_GATEWAY_API_KEY` 打 7863 返回 **401** → 后端 502 → 规则库兜底（直调实测 0ms 模板答案）；`ai_eval_traces` 近 40 分钟仅 6 条全 BAD_GATEWAY，`rag_calls` 0 条。匿名跑另受 429 限（需 ≥40000ms）。
- **已跑一次**（噪声大，**不作基线**）：librarian 14 条 → ragRecallK 3/10；报告 `docs/ai-eval/reports/2026-11-04.json`。
- **下一步**：拿到可用网关 key（compose 的 `./yg-gateway` build context 不在本仓库）→ `--delay 40000` 全量 → 读 `exec_layer.rag_*` 定位 LIB-005。
### 坑（补）
- ADR 判据只看文件路径；批量 commit（>50 文件）与 squash 削弱归属精度，已跳过并留痕。
- 探针 `VERIFIED:` 行必须写清覆盖边界，别让「没验到」读成「通过」。

### 回补记录（读侧追加；写侧修订时消费并清空，≤5 行）
> 只记「因交接件缺失而真出错」的项：`[YYYY-MM-DD] 漏：<什么> → 错：<后果> → 处置：进必需区 / 进清单卡`
`[2026-11-04] 漏：A8 步骤① 的运行前置（Spring 栈 DB `tea` + pgvector）→ 错：按「可直接跑」直跑报 `关系 "culture_chunks" 不存在`，白跑一轮 → 处置：进必需区（已在 P1 步骤①就地修）`
