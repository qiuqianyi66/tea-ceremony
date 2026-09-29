# Engines 详细规格（Plan Mode V4）

本文档为 SKILL.md 第 4 节各引擎的执行细节。仅在需要逐项执行规格时读取。

## 1. Intent Engine 输出格式

```text
intent:
  goal:              一句话目标
  expected_output:   期望产物
  constraints:       已知限制
  success_definition:成功标准
  unknowns:          未知项
```

禁止：猜测用户隐藏需求、扩大目标范围。歧义先问，不猜。

## 2. Context Engine 分类规则

| 类别 | 定义 | 处理 |
|---|---|---|
| Known | 已从输入/文件/资料确认的事实 | 可直接依赖 |
| Assumption | 合理但未确认的推断 | 必须显式标注，重大处需向用户确认 |
| Unknown | 无法确定的信息 | 不得伪装成 Known；列入 Open Questions 或先调研 |

## 3. Risk Engine 评分表

| 维度 | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| Impact | 无影响 | 局部影响 | 影响现有功能/数据 | 系统级影响 |
| Scope | 单文件 | 多文件 | 跨模块 | 系统级 |
| Uncertainty | 完全明确 | 少量未知 | 存在方案选择 | 需求不清 |
| Reversibility | 完全可逆 | 可回滚 | 需手动恢复 | 不可逆/生产风险 |

Risk Score = Impact + Scope + Uncertainty + Reversibility（0-12）。
等级：0-3 LOW / 4-7 MEDIUM / 8-12 HIGH。

## 4. Confidence Engine 阈值

`confidence: understanding / solution / execution / risk_estimate`（各 0-100%）

| 区间 | 动作 |
|---|---|
| ≥90% | 直接推进 |
| 70-90% | 推进，必须声明假设 |
| <70% | 调研 / 提问 / 降低范围 |

置信度是自评，不替代验证：高置信仍走 VALIDATION 与 REVIEW。

## 5. Strategy Engine 选择矩阵

| Risk | Confidence | 策略 | 流程 |
|---|---|---|---|
| LOW | 任意 | Fast | Explain → Execute → Validate → Deliver |
| MEDIUM | ≥70% | Guided | Mini Plan → 确认 → Execute → Validate → Deliver |
| MEDIUM | <70% | Guided + 调研 | 先澄清/调研，再出 Mini Plan |
| HIGH | 任意 | Controlled | 完整 PLAN → Approval → Execute → Validate → Review → Learning |

零规划任务（纯问答/只读咨询/用户已给步骤）→ Fast，不做任何规划开销。
评分变化（调研后）→ 重评换轨道，向用户说明。

## 6. Planning Engine 规格

文件：`PLAN-YYYY-MM-DD-name.md`，保存到任务工作目录。

Task 条目必须满足：
- File：精确路径
- Change：具体改动内容（含代码/文本要点，不写“适当处理”）
- Verification：可执行的验证方法（命令/回读/渲染检查）
- Rollback：有风险任务给出恢复方式

自审清单：覆盖度（每个需求点映射到 Task）/ 占位符扫描 / 一致性（路径命名接口）/ Rollback 完整 / 边界验证（需求没写清的输入是否有验证）。

## 7. DECISION_LOG.md 格式

```markdown
## Decision <ID>
- Context:    背景
- Options:    候选方案
- Selected:   选定方案
- Reason:     选择理由
- Trade-off:  权衡（放弃什么）
- Validation: 事后如何验证该决策
```

## 8. EXECUTION_LOG.md 格式

| Task | Action | Result | Verification | Issue |
|---|---|---|---|---|
| 任务标识 | 实际动作 | 结果 | 验证方式/结果 | 遇到的问题 |

## 9. RETROSPECTIVE.md 格式

```markdown
# Retrospective
## Result          任务结果与交付
## What Worked     有效做法
## What Failed     失败点与原因
## New Knowledge   新经验（待验证）
## Future Improvement  未来改进
```

写入 Memory 条件：Reusable + Verified + Stable，三者缺一不入。

## 10. Verification Engine 四层检查

1. Functional：功能是否正确（产物是否符合预期）
2. Technical：技术是否正确（可运行、无明显错误、符合规范）
3. Regression：是否破坏已有能力（回归检查）
4. Requirement：是否满足用户目标（回到 intent 对照）

全部通过才进入 REVIEW；REVIEW 独立复核后 PASS 才算完成。
