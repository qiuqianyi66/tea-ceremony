---
name: plan-final-convergence
description: 最终收敛规划（2026-10-09）——合并双线收尾 + 质量四性 + AI 项目化改造（评测体系）三大主线，任务到代码层面。批准后按序执行，禁止跳阶段。
status: draft
owner: yanha
last_updated: 2026-10-09
date: 2026-10-09
---

# PLAN：一盏茶 最终收敛与 AI 项目化改造（2026-10-09）

## Goal

把「一盏茶」打磨成可进简历的 AI 项目：Agent 能力完备 + 完整评测体系 + 质量四性收敛 + 双线收尾落地。产出**真实评测数字**（任务完成率 / pass^3 / 机评一致率 / 迭代记录）。

## Context

- main 基线 `df2879d`；S1 worktree `tea-garden-s1` 5 commits 全绿待合（V4__garden_energy.sql + ADR-015 + garden 域 + 前端）。
- 主仓库迁移 V1__init / V2__culture_seed / V3__agent_memory（S1 V4 合入后新迁移从 V5 起）。
- Spring Boot 已实现 7 域 8 Service（ai/auth/common/culture/record/tea/ware）；ai 域文件齐（AiChatService / AgentOrchestrator / 五专家 / PromptService / ChatMemoryService / AiUsageLogger / CultureSearchTool-MCP）。
- AI 现状：五专家单请求单专家路由 + RAG（pgvector+ILIKE）+ 会话记忆 + prompt 版本化 + 502 降级承重墙 + ai_usage_logs 计量（无消费端）。
- 缺口（实查）：无 AI 评测体系、无 Trace、无运行时 Skill、无长期记忆、效率成本无消费端、文档漂移 3 处。
- 参照物：Leo 方法论（x.com/double_burger_2/status/2106653589804597492）——评测四维、四层归因、考点加权、pass^k、LLM-as-Judge。

## Risk Assessment

```
Risk = Impact + Scope + Uncertainty + Irreversibility
总体: MEDIUM（6-7）——多文件多阶段，但每批独立 commit 可回滚；新表走迁移成对。
```

| 阶段 | 风险 | 缓解 |
|---|---|---|
| Phase 0 收尾 | S1 合 main 冲突 | worktree 基于 ffe807e 全量验证过，合前跑 quality |
| Phase 1 质量 | 批量修引入回归 | 每批独立 commit + 只动审计命中项 + 每批跑 quality |
| Phase 2 能力补强 | Trace 埋点碰承重墙 | 埋点只读不改行为；Skill 加载走 PromptService 版本化 |
| Phase 3 评测 | AI key 费用 | judge 用 qwen-turbo；评测集 ≤50 条；脚本手动跑不进 CI |

## Approach（三阶段主线合并）

```
Phase 0 收尾 ──→ Phase 1 质量收敛 ──→ Phase 2 能力补强 ──→ Phase 3 评测体系 ──→ Phase 4 低优先
T01 S1合main   T04 四性审计四批    T07 Trace埋点      T10 评测集40条    T14 K13/K14/P0-1c
T02 A3 compose T05 漂移修复3处     T08 运行时Skill    T11 评测器         T15 C6甄别
T03 A4 cu桌面  T06 审计修复提交    T09 复杂度路由     T12 LLM-as-Judge
                                                       T13 迭代记录+简历
```

## Tasks（到代码层面）

### Phase 0 收尾

**T01 S1 合 main**
- Action：`cd C:\Users\yanha\Desktop\tea-garden-s1` → `git push origin feature/garden-s1` → GitHub 开 PR → CI 13 job 全绿 → `--admin merge` → 回主仓库 `git pull` → `node scripts/verify-harness.cjs`。
- Output：main 含 V4/ADR-015/garden 域。
- Validation：`npm run quality` 全绿 + `verify-harness` ERRORS: []。

**T02 A3 compose up backend**
- Action：`cd C:\Users\yanha\Desktop\tea` → `docker compose up -d backend`（.env 已含 `AI_DASHSCOPE_API_KEY`）。
- Validation：`curl http://localhost:8080/health` 200；`POST /api/v1/auth/login` 可用。端口冲突（8080 被占）→ 改 `docker-compose.yml` 映射 `18080:8080`。

**T03 A4 cu 虚拟桌面**
- Action：用户处理占用（见 D 清单 Q1）。之后跑 `node scripts/verify-gardens.cjs` + K23 截图链路。
- Validation：截图脚本 ERRORS: []。

### Phase 1 质量收敛（重头）

**T04 四性审计四批**
- 批 1 规范性：`node scripts/audit-redlines.cjs` + `mvn test -Dtest=LayerDependencyTest` + `npx biome check` → ERRORS: []。
- 批 2 维护性：`node scripts/verify-harness.cjs` + `node scripts/audit-wiki-drift.cjs` → ERRORS: []。
- 批 3 安全性：越权用例（sessionId 归属）、`.env*` 不入库、CSP 头、限流配置核对。
- 批 4 可扩展性：api-contract 端点 vs 代码路由双向核对（audit-wiki-drift 已覆盖）+ @Value 配置注入抽查。
- Output：每批修复清单（audit 命中项 → 修复 → 独立 commit）。

**T05 漂移修复三处**
- `biz-dev/README.md` 03 项：`03-caffeine-cache（裁 redis）` → `03-caffeine-cache + Redis L2（ADR-012）`，附 ADR-012 链接。
- `docs/architecture/system-overview.md`：刷新 6 处（S1 能量账本已实现 / AI 走 DashScope / CI 13 job / Docker 现行 / ADR 索引至 015 / 后端 7 域）。
- `CONTEXT.md`：修正"docker 弃用"相反表述 / 删 ADR-013 重复行 / 后端关键词补 Spring Boot。

**T06 审计修复提交**
- 每批 `git commit -m "fix(quality): <scope> — audit hit"`，分开提交；全部修复后跑 `npm run quality` + 后端 pytest + `verify-harness`。

### Phase 2 Agent 能力补强（评测前置）

**T07 Trace 埋点**
- 新文件 `backend/src/main/resources/db/migration/V5__ai_eval_traces.sql`：

```sql
CREATE TABLE ai_eval_traces (
    id            BIGSERIAL PRIMARY KEY,
    session_id    BIGINT NOT NULL REFERENCES ai_chat_sessions(id),
    request_id    UUID NOT NULL DEFAULT gen_random_uuid(),
    agent_type    VARCHAR(32) NOT NULL,
    input_layer   JSONB NOT NULL,      -- 输入：原始问句 + 解析后意图
    context_layer JSONB NOT NULL,      -- 上下文：历史锚定快照 + 检索命中
    plan_layer    JSONB,               -- 规划：路由决策 + 复杂度档位
    exec_layer    JSONB,               -- 执行：工具调用 + 参数 + 返回 + 降级标记
    output        TEXT NOT NULL,
    tokens_in     INT NOT NULL DEFAULT 0,
    tokens_out    INT NOT NULL DEFAULT 0,
    latency_ms    INT NOT NULL DEFAULT 0,
    error_code    VARCHAR(32),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_eval_traces_agent ON ai_eval_traces(agent_type, created_at DESC);
```

- 新建 `backend/src/main/java/com/tea/ai/service/TraceRecorder.java`（接口 `record(AiEvalTrace)`），`AiChatService.chat()` 内埋点：入口记 input_layer → 路由后记 plan_layer → 工具调用记 exec_layer → 输出前记 output/tokens/latency。
- Rollback：`V5__rollback.sql` 删表。
- Validation：一次真实 AI 对话后 `SELECT * FROM ai_eval_traces ORDER BY id DESC LIMIT 1` 四层字段非空；`mvn test` 绿。

**T08 运行时 Skill 第一版**
- `PromptService` 增加 `loadSkill(String agentType, String domain)`：命中领域（茶人/茶器/茶诗/产区）→ 从 `agent_skills` 表（V6 迁移建）取子指令注入上下文。
- `LibrarianAgent` 在 RAG 检索前按 `CULTURE_KEYWORDS` 命中领域加载对应 Skill。
- Validation：文化问题触发 Skill 注入（日志可见）+ 未命中领域不加载（上下文不膨胀）+ `mvn test` 绿。

**T09 P1-2 复杂度路由**
- `AgentOrchestrator` 增加 `complexity(AiChatRequest)`：按 `输入字数 / 轮次 / 意图数` 三档（默认阈值 40 字 / 3 轮 / 200 字，配置化 `application.yml` `tea.ai.complexity.*`）。
- 三档：SIMPLE → 直答；MEDIUM → 专家路由 + RAG；COMPLEX → 专家路由 + RAG + 上下文压缩。
- 模型不可用回退默认（沿用降级承重墙，`teaAI.ts` 不动）。
- Validation：三档边界单测（`AgentOrchestratorTest`）+ `mvn test` 全量绿。

### Phase 3 AI 评测体系（重头）

**T10 评测集（40-50 条）**
- 目录 `docs/ai-eval/cases/`，每专家一文件 `advisor.yaml` / `taster.yaml` / `librarian.yaml` / `brewer.yaml` / `mentor.yaml`，结构（借鉴 promptfoo）：

```yaml
# librarian.yaml 片段
cases:
  - id: LIB-001
    type: typical          # typical | edge | adversarial
    input: 铁观音和武夷岩茶有什么区别？
    points:
      - {name: 茶类归属正确, weight: 1, veto: false, check: program|judge}
      - {name: 引用知识库出处, weight: 1, veto: false, check: judge}
    expected: 至少答出铁观音属乌龙茶、岩茶属乌龙茶系并给出差异点
```

- 分布：typical 60% / edge 25% / adversarial 15%；每专家 ≥8 条；adversarial 覆盖降级、越权、无信息输入。

**T11 评测器 `node scripts/eval-tea-ai.cjs`**
- 核心（考点加权 + pass^k）：

```js
function scoreCase(case, result) {
  let sum = 0, wsum = 0;
  for (const p of case.points) {
    const s = evalPoint(p, result);          // 0|1
    if (p.veto && s === 0) return 0;          // 否决型直接判 0
    sum += s * p.weight; wsum += p.weight;
  }
  return sum / wsum;                          // Σ(考点×权重)/Σ权重
}
function passK(case, results, k = 3) {        // pass^3
  return results.length === k && results.every(r => r.score === 1);
}
```

- 程序化校验 `evalPoint`：茶类归属（`src/data/` 六大茶类表对照）、温度区间（`tea-tasting` 基准表）、降级触发（HTTP 502 断言）、RAG 命中（检索结果非空）。
- LLM 判分 `evalPoint` judge 分支：调 `POST /api/v1/ai/chat`（agent=mentor，judge prompt）。
- 输出 `docs/ai-eval/reports/<date>.json`：四维指标（结果质量 / 过程质量 / 效率成本 / 安全稳定）+ pass^3 + 归因分布。

**T12 LLM-as-Judge（校准 + 单维评委）**
- 评委 Prompt 模板 `docs/ai-eval/judge-prompts/result-quality.md`：

```
你是 AI 茶灵结果质量评委。只评一个维度：回答是否满足任务要求。
给 1 分或 0 分，不写评语。信息不足时输出 UNKNOWN。
要求：{point.name}；回答：{output}；判分：
```

- 校准脚本：`node scripts/calibrate-judge.cjs`——同批样本人工标注 vs 机评，输出一致率（阈值 85%，不达标调 Prompt 重跑）。
- 原则落实：每维独立评委、0/1 选择题、UNKNOWN 选项、A/B 位置交换、每次评测随机抽 10% 人工复核。

**T13 迭代记录 + 简历素材**
- `docs/ai-eval/ITERATIONS.md`：每版记录 version / 改动 / 四维指标 / pass^3 / 归因 Top 失败。
- 跑 2 轮迭代（v1 基线 → 修 Bad Case → v2），产出真实数字。
- 简历 STAR 条目（数字取自 ITERATIONS.md，不编）：

```
AI 茶灵五专家 Agent ｜独立负责
搭建评测体系：40+ 条评测集（典型/边界/对抗）+ 四层归因 Trace + 考点加权评分；
LLM-as-Judge 自动评测与人工标注一致率 ≥85%；pass^3 稳定性；
基于 Bad Case 归因迭代 2 版，任务完成率 X%→Y%。
```

### Phase 4 低优先收尾

**T14 K13 repo map / K14 LLM mocking / P0-1c 向量回填**
- K13：`node scripts/gen-repomap.cjs` → `docs/reference/repo-map.md` ≤300 行，抽查符号命中。
- K14：LLM 调用抽象接口 mock 化，确定性测试不依赖真实 key。
- P0-1c：embedding 回填 teawares/etiquettes/relations 三表向量 → 检索命中 + ILIKE 降级保留。

**T15 C6 低优先四维甄别**
- K17-K22 / P1-5/6/7/9/10 逐项过四维甄别（自由/用户/竞品/伪需求），做/砍/降级三选一，产出决定表。

## Trade-offs

| 取舍 | 选择 | 理由 |
|---|---|---|
| 评测器自建 vs promptfoo/DeepEval | 自建 | 不新增依赖；评测器就是简历故事本身 |
| Judge 模型 | qwen-turbo（DashScope 现有 key） | 成本低；评测集小 |
| 评测脚本挂 CI？ | 不挂 | 要 key 且烧钱；手动/定时跑 |
| 长期记忆（F-B2） | 本轮不做 | 评测体系优先；排下一轮 |
| Redis 四场景（ADR-012） | 只修文档漂移，不落地 | 后端重写 M2/M3 再落地 |

## Rollback Strategy

- 每个 T 独立 commit，可 `git revert <commit>` 单点回滚。
- 迁移成对（V5 + rollback），upgrade/downgrade 往返验证。
- 评测器/评测集/报告目录全是新增文件，删除即回滚，不碰主流程。

## Open Questions（默认已定案，仅 2 项待确认）

| # | 问题 | 默认决定 |
|---|---|---|
| Q1 | 真实用户试用（文章第五步：PWA 部署发同学群） | 建议做（Phase 3 后），不阻塞前 3 阶段；你否就砍 |
| Q2 | 低优先 C6 哪些做（T15 甄别） | T15 处理，不阻塞前面阶段 |

## Not Doing

- 多 agent 接力流水线（H9 判砍延续）：tea 维持单请求单专家路由。
- 模型训练 / SFT / RL：只出一页概念文档（能讲清训练数据长什么样）。
- promptfoo / DeepEval 依赖引入。
- 前端主流程改动；阶段六（简历功能）。
- Redis 落地（本轮只修技能路由表述）。
- 新增付费 AI API（评测用现有 DashScope key + qwen-turbo）。
