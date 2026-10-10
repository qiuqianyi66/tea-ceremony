---
name: handoff-2026-10-10c
description: 会话交接总结（2026-10-10 晚）——AI 能力建设立项：v5 评测暴露安全风险 + RAG 表全空 + 缓存吃不到；出 REQ/PLAN/ADR-020。含新对话恢复指针与预算决策点。
status: active
date: 2026-10-10
last_updated: 2026-10-10
owner: yanha
---

# HANDOFF · 2026-10-10c（会话交接 · AI 能力建设立项）

> 本文件为最新交接，**取代 `docs/HANDOFF-2026-10-10b-execution.md`**（10-10b 记录了 A4 证伪与 v3/v4 评测修复）。
> 跨会话主力文档 = `docs/plans/TODO-PRIORITY.md`（活文档）+ **`docs/plans/PLAN-ai-capability-2026-10-10.md`（当前执行母本）**。

## 一句话现状

**无硬阻塞（除预算决策）。** A4 已证伪；评测做到 v5（overall 0.80）；**B + A 阶段（前端专家可达 + 评测保真度）已合并**。当前立项 **AI 能力建设**（五阶段 20 任务），**Phase 1 安全边界待开工（P0，真风险）**；Phase 4 微调**等预算数字**。

## 仓库状态（2026-10-10 已核实）

- **main** = `5981126`（PR #41-#48 全 merged；工作区干净）
- ADR **020** 个 / CI 13 job / `.agents/skills` 66 / `.harness/skills` 33
- 后端容器 `tea-backend-1` healthy（18080→8080）/ DB healthy / AI key 生效
- 分支保护：`required_status_checks` 13 context ✅（2026-10-10 本会话补回）

## 本轮会话交付（PR #43-#48）

| PR | 内容 |
|---|---|
| #43 | 修 TraceRecorder 静默丢 Trace 真 bug（null token → NOT NULL insert 失败 → librarian Trace 0 行）+ A4 证伪 + v3 全量分 |
| #44 | 三条教训沉淀（A4 前提 / 旁路静默丢数据 / 分支保护 PUT） |
| #45 | **规范上收**：§0「客观执行」+「先拆解再动手」，§4 三轨道（Fast/Guided/Controlled）+ ADR-019 |
| #46 | 判分器四项修复（逐考点落盘 / 六境基准 / 茶名反查 / judge verdict 严格解析） |
| #47 | **B 阶段**：前端专家选择（F-M5-7），四专家真实可达 |
| #48 | **A 阶段**：评测对齐真实调用（带 system prompt + 路径分账） |

## 评测当前数字（v5，唯一可引用）

```
overall 0.80 | 结果质量 0.77 | 过程质量 0.83 | 安全稳定 0.88
judgeCoverage 0.96 | pass^1 35/50
路径分账：默认路径（自动档即命中）18 条 → 0.79 | 专家路径（需主动选）32 条 → 0.81
```
> ⚠️ **v1/v2 的 0.82/0.96 是 program-only 口径，禁止引用**。v3/v4 与 v5 不可直接比（调用方式已改）。

## 立项依据（都是实测，不是推测）

1. **v5 失败 15 条 → 11 条是 prompt/产品逻辑问题，0 条「模型知识不够」**
2. **`culture_chunks = 0`**（RAG 向量表空）→ 这才是「知识库未命中」的根因
3. **缓存吃不到**：平均输入 225 / 输出 105 token；隐式缓存需 **≥1024** 才命中，当前 <1024
4. **ADR-012 已规划语义缓存但未落地**（`grep cache` 在 ai 域零命中）
5. **DB 快照**：teas 66 / people 21 / regions 19 / poems 25 / teawares 6 / processes 6 / etiquettes 14 —— 但 `culture_chunks` `tea_relations` `agent_prompts` 全为 **0**
6. 调用量：704 次 / 输入 158,712 token / 输出 73,638 token / **4 个用户 / tasting_records 1 条**

## 新对话恢复指针

1. 读 `docs/plans/TODO-PRIORITY.md`（活文档）+ **`docs/plans/PLAN-ai-capability-2026-10-10.md`（执行母本）** + 本文件
2. **不要再等 A4**——已证伪
3. **`docs/plans/PLAN-ai-capability-2026-10-10.md` 的 Phase 1 可直接开工**（P0 安全风险，L0 级）
4. 决策点待确认（`REQ-ai-capability` §五）：
   - **D-1 顺序**：建议 A→B→C→D→E
   - **D-2 微调范围**：建议单专家（mentor）
   - **D-3**：ADR-020 已写 ✅
   - **D-4 缓存**：建议先 E1（前缀扩容，零成本）
   - **D-5 预算上限**：⚠️ **待用户给数字**（阻塞 Phase 4）

## 关键设计决策（防重做）

- **默认档「自动」必须不传 `agent` 字段**——显式传 `agent=chat` 会改掉隐式路由（文化词不再走 librarian），是承重墙回归
- **评测 system prompt 抽取而非复制**（`extractSystemPrompt()` 从 `teaAI.ts` 读），杜绝两份漂移
- **评委调用不带茶灵 prompt**（独立裁判带人设会污染判分）
- **专家路径忽略前端 messages**（`BaseExpertAgent` 只用 `lastUserMessage` + 自己 `SYSTEM_PROMPT`）——故 system prompt 只影响透明代理路径
- **推翻既有决策必须写 ADR**（ADR-020 推翻 `PLAN-final-convergence` L224 / `REQ-ai-project` L117，两处原文已同步）

## 本会话两次自查更正（记录在案，非掩盖）

1. 「评测不带 prompt 影响**所有**考点」→ 实测**只影响透明代理路径**
2. 「41 条测不可达路径」→ 分账口径写错（`chat.yaml` 属可达，是「自动」档回落）→ 改为「默认/专家」二分

## 下一轮建议（延续 PLAN）

- **立刻可做**：Phase 1 安全边界（P0，L0，半天）——修 `AI_SYSTEM_PROMPT` 安全红线 + 单测锁 + 五专家 prompt 同步
- **随后**：Phase 2 知识注入（`culture_chunks` 回填，注意 embedding 产生费用）
- **等预算**：Phase 4 SFT（单专家 mentor）
