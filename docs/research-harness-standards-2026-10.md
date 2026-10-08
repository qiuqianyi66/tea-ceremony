---
last_updated: 2026-10-08
status: active
owner: yanha
---

# Harness 工程知名落地标杆对照（2026-10-08）

> 验证目标：对照**有知名度且落地成功**的 harness 工程实践，找出一盏茶流程的真实缺口。
> 选样标准：公开权威源（Linux Foundation 托管标准 / Anthropic 官方文档与自证数据），非自媒体二手解读。
> 已有调研底座：`research-harness-engineering-285-2026-10.md`（总纲）+ `research-harness-alibaba-2026-10.md`（阿里）+ `research-harness-latest-2026-10.md`（OpenAI/Hashimoto 原文 + 2026 新动向）。本文只补标杆实例，不重复原理。

## 1. 结论先行

一盏茶 harness 与行业标杆**同构度高**（地图式 AGENTS.md / 约束机械化 / CI 门禁 / 结构化纠错 / 环境审查 cron 均已落地）。
真实缺口三个：**CI 增量测试**（Anthropic 2026-09 测试影响分析）、**熵管理定时 agent**（OpenAI doc-gardening 模式）、**新栈可观测性连 Agent**（Spring Boot 侧未做）。
agents.md 开放标准：一盏茶已合规，无需动作。

## 2. agents.md 开放标准（Linux Foundation 托管，落地最广）

| 项 | 事实 | 来源 |
|---|---|---|
| 治理 | 2025-12 捐赠给 Agentic AI Foundation（Linux Foundation 下属） | everydev.ai / mer.vin |
| 起源 | OpenAI Codex、Amp、Google Jules、Cursor、Factory 协作产物 | mer.vin |
| 读取工具 | 30+（Codex/Copilot/Cursor/Windsurf/Jules/Devin/Aider/Zed/Warp/Semgrep/VS Code）；Claude Code 2026-09 起无 CLAUDE.md 时也读 AGENTS.md | mer.vin / ai-tldr |
| 加载层级 | global（~/.codex/AGENTS.override.md → AGENTS.md）→ repo root → 当前目录，**nearest wins** | codex.danielvaughan / ssdnodes |
| 截断 | 32 KiB 硬截断（Codex 指令链） | CSDN 原文（2026-06） |
| 格式 | 纯 Markdown，无 schema，无工具依赖 | dev.to 2026-06 |

**一盏茶对照**：
- AGENTS.md 211 行 ≈ 3-4 KiB << 32 KiB 截断，✅ 合规。
- 单仓库单文件即可；nearest-wins 层级与 override 机制在单仓无需求，不引入。
- 不用 CLAUDE.md 私有格式；.claude/agents 已标注豆包等效（expert-reviewer / audit 脚本）。✅
- 隐含建议（已落地）：AGENTS.md 只写规则与索引，细节全部外置到 docs/ —— 与 OpenAI 原文"AGENTS.md 是内容目录"一致。

## 3. Anthropic 官方 best practices（2026-10-06 更新，Claude Code）

关键模式与一盏茶对照：

| 模式 | 官方要点 | 一盏茶现状 |
|---|---|---|
| kitchen sink 会话 | 无关任务之间 /clear，防上下文污染 | HANDOFF 每次新会话接续 + patterns 池 ✅ |
| 纠正循环 | **连续两次纠错失败就重置**，不要第三次硬修 | AGENTS §2 同款（连续两次修正失败就停下）✅ |
| 子代理 | 复杂任务用子代理做验证/调研，省主上下文 | .claude/agents 三子代理 + 豆包等效 ✅ |
| 验证手段 | 给 agent 可跑的验证（测试/构建/截图）；**无法验证就不提交** | verify-*.cjs / eval-harness / CI 门禁 ✅；前端截图闭环缺口（见 §5） |
| think 模式 | 关键问题触发扩展思考 | 已融入（多角色质询/深度批判四法）✅ |

## 4. Anthropic 落地数据（2026 自证，行业引用最广）

- 2026 趋势报告（2026-04，Rakuten/TELUS/Zapier/CRED 案例）：约 60% 开发工作用 AI，**完全委托仅 0-20%**；约 27% AI 辅助工作是"没有 AI 就不会尝试"的；TELUS 13,000+ 自定义 AI 方案、代码交付提速 30%、节省 50 万小时。
- "When AI Builds Itself"（2026-09 披露）：Claude 作者 **>80%** 合并的生产代码；工程师人均合并量约 8x/季度（vs 2024 基线）。
- **CI 承压与对策**（2026-09-14 blog）：agentic coding 让测试量指数膨胀，Anthropic 自建 **test impact analysis（测试影响分析）** 服务扩展 CI——"always plan for the exponential"。这是本文最重要的一条增量。

## 5. 一盏茶差距清单（按价值排序）

| 差距 | 标杆依据 | 建议 | 优先级 |
|---|---|---|---|
| **CI 增量测试** | Anthropic TIA | Vitest 增量/受影响测试先跑，全量保留兜底；缓解 99f265c 那次 perf flaky（tracking.perf 阈值留余量） | P1 |
| **熵管理定时 agent** | OpenAI doc-gardening + Anthropic 熵管理（后台任务扫偏差/发修复 PR） | cron 挂 verify-harness + eval-harness 定时体检（research-latest 已有 P3 立项）；现仅每周环境审查 cron | P2 |
| **新栈可观测性连 Agent** | OpenAI 五原则（可观测性连 Agent） | Spring Boot Actuator + Prometheus + 结构化日志（第三批 request_id/JSON 日志/metrics 是旧 FastAPI 栈，新栈未做） | P2 |
| **前端截图验证闭环** | Anthropic"无法验证就不提交" | P0-2 返工先打通截图脚本（现状"从未成功截图"），视觉批次过设计门禁 | P0（随 P0-2） |
| **模型路由** | Model Router 单线程成本 -64% | P1-R2 复杂度分级（已立项） | P1 |
| **端到端自主门槛** | OpenAI 端到端驱动新功能 | P0-1c 专家注册/会话记忆先行（不依赖 AI key） | P0（已列） |

## 6. 结论

1. agents.md 标准对齐：无需动作，方向已被标准确认（地图式 + docs 记录系统）。
2. 三大真实缺口 = CI 增量 / 熵管理定时 / 新栈可观测性。均 P1-P2，不阻断 P0 主线。
3. 2026 行业拐点：80%+ 代码由 agent 写 → CI 从"人写代码的门禁"变成"agent 产出的流水线"；一盏茶 CI 13 job 全量跑是正确的底座，增量层是下一步。

> 底座更新：本文 + `research-harness-engineering-285-2026-10.md`（总纲）+ `research-harness-alibaba-2026-10.md`（阿里）+ `research-harness-latest-2026-10.md`（原文与动向）+ `research-multiagent-278-2026-10.md`（多智能体）。
