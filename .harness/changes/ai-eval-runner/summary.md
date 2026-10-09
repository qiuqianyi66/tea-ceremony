---
last_updated: 2026-10-09
status: active
owner: yanha
---

# ai-eval-runner 变更记录（T11，F-A3/A4/A5/A6 评测器）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | ai-eval-runner（AI 评测器 + 判分核心） |
| 分支 | 直接落 main（T11 独立 commit b8d38bc） |
| 需求来源 | REQ-ai-project F-A3（考点加权）/F-A4（程序化判分）/F-A5（LLM-as-Judge）/F-A6（pass^k）+ PLAN §142-162 |
| 类型 | feat |
| 涉及范围 | scripts/eval-tea-ai.cjs（IO）+ scripts/eval-core.cjs（纯函数判分）+ scripts/tests/eval-core.node-test.cjs（11 用例） |

## 二、需求与方案

### 需求描述

1. scoreCase = Σ(考点×权重)/Σ权重；veto 命中直接判 0（F-A3）。
2. passK：k 次独立运行全满分才算通过（pass^3，F-A6）。
3. 程序化判分（F-A4）：茶类归属/温度区间/拒绝/降级（502）/健壮性/RAG 命中（sources 非空）。
4. LLM 判分（F-A5）：--judge 分支调 /api/v1/ai/chat（agent=mentor，单维评委输出 0|1）。

### 技术方案

- 判分核心 `eval-core.cjs` 纯函数（无 IO），node --test 11 用例覆盖各考点原语 + veto + 加权 + 中性 judge 跳过 + passK + 聚合。
- 评测器 `eval-tea-ai.cjs`：读 YAML → 逐条 POST 后端（agent=文件基名，与 AgentType 枚举对齐）→ 判分 → pass^3 → 报告 `docs/ai-eval/reports/<date>.json`（四维 + 归因 + 失败详情含 httpStatus/内容快照/sources 计数）。
- 参数：--iterations（默认 1，正式 pass^3 用 3）/--judge/--file/--subset/--dry-run（mock 不调 API）。
- 程序化基准表内置：CATEGORY_EXPECT / TEMP_EXPECT（来源 src/data/teas.ts + teaProcesses.ts，2026-10-09 核验）；REFUSAL_KEYWORDS 兜底。
- 效率成本维度由响应 tokens/latency 回填（T07 Trace 旁路字段）。

## 三、影响分析

- 影响面：新增 3 个 scripts 文件；不改后端/前端代码。
- 承重墙确认：评测走产品链路 POST /api/v1/ai/chat（禁绕过后端直连第三方）；降级用例断言 502 即承重墙生效。
- 环境依赖：后端容器 tea-backend-1（18080）+ .env AI_DASHSCOPE_API_KEY；容器外网当前被 Docker 代理配置阻塞（见四、阻塞项）。
- 回滚：revert commit（纯脚本，无迁移）。

## 四、自检清单与阻塞项

- [x] 单测 11/11 通过（node --test，含 veto 直接 0 / 温度区间边界 / 中性 judge）
- [x] dry-run 全链路 VALID（3 条 librarian + 2 条重跑，判分管道通）
- [x] live 探路：后端容器 18080 可达、契约校验生效（PARAM_INVALID 正常返回）；真实 AI 调用被容器外网阻断
- [ ] 阻塞：宿主代理端口 9674 无监听（Docker daemon 注入 HTTP_PROXY=host.docker.internal:9674），容器直连 DashScope 亦被 RST（TLS handshake terminated）。属环境问题，待用户启动代理/修复 Docker Desktop 网络后重跑 live
- [ ] 待办：网络恢复后跑全量 50 条 live + pass^3 + --judge（T12 校准）
