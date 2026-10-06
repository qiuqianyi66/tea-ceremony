# main-dev-skill 总览（主开发流程，6 个）

> 路由表：十阶段流水线对应关系。任务启动先读本表确定技能，再按需加载对应 SKILL.md。

| 阶段 | 技能 | 触发场景 |
|---|---|---|
| 1-3 | request-analysis | 任何新功能/变更请求，进入流程前**必须使用**（即使随口一句"加个 xx"） |
| 4 | coding-skill | 需求分析完成，写代码/改逻辑/加接口页面；配合 biz-dev 专项 |
| 5 | unit-test-write | 新增/修改逻辑必须带测试（TDD 垂直切片） |
| 5-6 | unit-test-ci | 提交前验证：quality 门禁 + 后端测试 + 迁移往返 |
| 6 | expert-reviewer | 代码评审：6 维 + 🔴🟡🟢🔵 分级，🟡 清零才过 |
| 6-7 | agent-eval | 协作质量评估：基线两层维度（G1-5/T1-6）+ `scripts/agent-eval.cjs` 自动检查，0 分证据沉淀 AGENTS.md §13；每批收尾必跑 |
| 8-10 | deploy-verify | 预发验证 → 上线部署 → 30 分钟观测 |

## 调用规则

- **前置依赖**：coding-skill 依赖 request-analysis 输出（summary.md 已存在）；缺失先回退。
- **上下文预算**：request-analysis ≤3、coding-skill ≤4（规则 + Wiki 合计），不超限。
- **分工**：本族技能只定义流程与检查点，编码模式细节在 biz-dev-skill，不重复展开。
