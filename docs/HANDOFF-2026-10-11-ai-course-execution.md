---
name: handoff-2026-10-11-ai-course-execution
description: 四份 AI 工程化课程学习完成交接——可吸收结论 + tea 未做清单 + 仓库状态（取代 docs/HANDOFF-2026-10-10c-execution.md）
status: active
date: 2026-10-11
last_updated: 2026-10-11
owner: yanha
---

# HANDOFF-2026-10-11-ai-course-execution

## 1. 一句话现状

四份课程（Spring AI Alibaba Graph 语雀 + Harness/Skill/Openrouter 三回放）已深度学完，实现级总结在 `AI工程化课程学习总结.md`（913 行）；与 tea 比对结论：**治理已对齐无增量，边际价值 2 项（SSE 流式、Graph 触发判据）**；tea 活跃工作 = `PLAN-ai-capability` Phase 2 起（Phase 1 已完成，勿按 TODO 旧状态开工）。

## 2. 仓库状态（复核时间 2026-10-11）

- main = `06c25c9`（工作区干净：`git status --short` 空）
- **TODO-PRIORITY.md 滞后**：写 `fe1ec02`，实际已到 `06c25c9`（多 #49 cb1b51e / #50 d6dddec / #51 867ef71 / 06c25c9 共 4 commit）
- 后端 211 tests（`cd backend && mvn -q test`）；`node scripts/verify-harness.cjs` 期望 ERRORS: []；CI 13 job

## 3. 已复核 vs 未复核

| 已复核（怎么验的） | 未复核（下次先验） |
|---|---|
| main=06c25c9 工作区干净 — git log/status 实跑 | PLAN-final-convergence L224 / REQ-ai-project L117 的 no-SFT 措辞是否被 cb1b51e 更新 — 转抄，下次 grep「SFT」 |
| Phase 1 安全边界 T01-T03 已完成 — #50 d6dddec 已合 main | Phase 2（T04-T07）是否开工 — git log 未见，以仓库为准 |
| ADR-020 已存在 — docs/ADR/ADR-020.md Test-Path True | ADR-020 正文是否含 D-5 预算护栏 — 未读 |
| tea 有慢SQL/OOM 技能（trouble-shooting 6 个含 01-slow-sql/02-oom）— 目录实测 | tea 前后端均无 SSE 流式 — 上轮 Grep（后端无 SseEmitter、teaAI.ts 无 getReader），下次重 grep 确认 |
| 四份课程内容已学 — AI工程化课程学习总结.md 913 行 | 课程总结中代码均来自 OCR/原文 — 未逐帧复核（证据在 frames_A2|B2|C2|D2） |

## 4. 下次第一步

1. 跑：`node scripts/verify-harness.cjs`（期望 ERRORS: []）
2. 读：`docs/plans/PLAN-ai-capability-2026-10-10.md`（Phase 2 T04 起，勿重做 Phase 1）
3. 改：`docs/plans/TODO-PRIORITY.md` 状态速览（main 06c25c9、Phase 1 ✅、ADR-020 ✅）
4. 决策点（用户拍板）：**OQ-1 微调预算上限**（卡 Phase 4）；是否立项 **SSE 流式输出**

## 5. 关键设计决策（防重做）

- **ADR-018 Graph 暂缓保持**：无多步有状态 AI 编排；HITL 与冲泡零点击闭环冲突（禁回手动确认）
- **ADR-020 SFT 已立**：LoRA 单专家 mentor，等预算；训练费不可退
- **承重墙**：`src/services/teaAI.ts` 降级逻辑（AI 请求走后端代理 /api/ai/*，禁浏览器直连第三方 AI）；改动必须保留并回归
- **顺序理由**：Phase 1/2 产物同时是 Phase 4 语料；Phase 3 基线是 Phase 4 对比前提（非串行堆叠）

## 6. 四份课程可吸收结论

- **已对齐无增量**：异常体系（tea 6 子类 > 课程 4 类）、Skill 三族（39 个）、流程三轨道、Graph 决策、慢SQL/OOM 技能、埋点可观测（TraceRecorder 已修静默丢数据 #43）
- **可吸收 ① SSE 流式**（课程 D 方案：SseEmitter 每事件推 → `data: [DONE]` → 流结束结算）：tea 前后端均无流式；五专家长文本打字机体验；改动量 Controller + 前端消费（Spring AI 原生支持）；**独立于 PLAN-ai-capability，属新增功能，须 request-analysis 立项**
- **可吸收 ② ADR-018 补触发判据**：重评条件加「一次请求内 AI 自主完成多步有状态决策链 + 需人工确认」（课程 Graph 价值印证），5 分钟文档级改动
- **课程印证 tea 方向**：AI prompt 安全红线（Phase 1 刚完成 #50）、旁路埋点必须可观测（#43 教训同课程观点）
- **无关**：聚合计费 / 小红书·量化·爆文 Skill / Redis 缓存模板（Caffeine 已实证 0-1% 命中）/ EasyExcel / 多 Agent 并行（单人项目）

## 7. tea 未做清单（实测）

- **PLAN-ai-capability**：Phase 2 知识注入 T04-T07（P0）、Phase 3 评测基线 T08-T10（P1）、Phase 4 SFT T11-T15（等 OQ-1）、Phase 5 缓存 T16-T18（P2）、收尾 T19 已由 cb1b51e 部分做 / T20 未做
- **Q1 真实用户试用**：PWA 部署发同学群（v3 全量真实分 0.81 / judgeCoverage 1，已达标可做）
- **低优先**：K17-K22、P1-5~P1-10、D 系列、技术债（mcp 双版本共存、启动 WARN）
- **活文档**：TODO-PRIORITY 滞后 4 commit（见 §2）

*细节证据与代码全量在 `AI工程化课程学习总结.md`；视频/抽帧在 `C:\Users\yanha\AppData\Local\Temp\course_videos\` 与 `frames_A2|B2|C2|D2\`。*
