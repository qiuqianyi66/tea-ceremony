# main-dev-skill 总览（主开发流程，14 个）

> 路由表：十阶段流水线对应关系。任务启动先读本表确定技能，再按需加载对应 SKILL.md。

| 阶段 | 技能 | 触发场景 |
|---|---|---|
| 1-3 | request-analysis | 任何新功能/变更请求，进入流程前**必须使用**（即使随口一句"加个 xx"）；frontier 一轮带推荐答案问完；术语冲突当场写 glossary，ADR 三条件全满足才写 |
| 4 | coding-skill | 需求分析完成，写代码/改逻辑/加接口页面；配合 biz-dev 专项 |
| 5 | unit-test-write | 新增/修改逻辑必须带测试（TDD 垂直切片） |
| 5-6 | unit-test-ci | 提交前验证：quality 门禁 + 后端测试 + 迁移往返 |
| 6 | expert-reviewer | 代码评审：6 维 + 🔴🟡🟢🔵 分级，🟡 清零才过；闭环 ≤2 轮 |
| 6 | caveman-review | 评审输出格式变体：一行一条 finding + 严重度（用户点名 caveman/一行式评审时用；不改评审维度） |
| 6-7 | quality-audit | 质量四性审计：规范性/维护性/安全性/可扩展性四批检查 + 修复清单 + 分批提交门禁（大提交/发布前质量门） |
| 6-7 | agent-eval | 协作质量评估：基线两层维度（G1-5/T1-6）+ `scripts/agent-eval.cjs` 自动检查，0 分证据沉淀 AGENTS.md §13；每批收尾必跑 |
| 6 | pr-body | 写 PR body：最小可视化 Summary + before/after Evidence + 单向/双向门 Merge Danger（评审通过、分支 push 开 PR 时用） |
| 8-10 | deploy-verify | 预发验证 → 上线部署 → 30 分钟观测 |
| 10（handoff 前） | retro | 任务收尾回顾：先跑 verify-harness/audit-redlines/audit-wiki-drift，再按 6 类扫环境改进点；机械错误→加自动化检查，判断错误→补规则；不改业务代码 |
| 10 | session-handoff | 会话交接：结束/换 agent/跨日继续前写 HANDOFF，强制已复核/未复核分栏 + commit hash 带复核命令 |
| 任意 | tea-voice | 任务性质触发（非流程位置）：只要产出物是**对外可见文字**（`docs/promotion/` 文案 / README / 官网 / UI 文案 / CHANGELOG 用户段）就加载；纯内部文档/注释不加载 |
| 任意 | arch-deepen | 任务性质触发：用户说"架构体检/找重构机会/降低 AI 导航成本"或定期回顾时用；deletion test 找 pass-through，出 `docs/architecture/deepen-*.md`，不改代码；不是每批必走 |

## 调用规则

- **前置依赖**：coding-skill 依赖 request-analysis 输出（summary.md 已存在）；缺失先回退。
- **上下文预算**：request-analysis ≤3、coding-skill ≤4（规则 + Wiki 合计），不超限。
- **分工**：本族技能只定义流程与检查点，编码模式细节在 biz-dev-skill，不重复展开。
- **收尾三件套顺序（三个技能触发点重叠，按此序，不并发）**：
  1. **agent-eval** —— 切片/每批完成时（客观指标，先跑）
  2. **retro** —— 会话要结束、这次卡过/返工过时（找环境改进点）
  3. **session-handoff** —— 会话即将结束、要换 agent/跨日时（写交接）
  > 判据：**只有收尾动作会在这三步各跑一次，不叠加跑**。纯文档小改、任务进行中都不触发这三者。
