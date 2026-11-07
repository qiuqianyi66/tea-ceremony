---
last_updated: 2026-11-06
status: active
owner: yanha
---

# 技能分层契约（活跃层 / 储备层）

> 本文只定「谁优先进上下文」与「怎么升降」。技能全量与触发条件看两份 README（`.agents/skills/README.md` + 四族 README），可执行化现状看 `docs/reference/skill-tooling-audit.md`。

## 为什么分两层

客户端每会话把每条 `description` 的元数据常量级注入，模型只在这些元数据里选技能。tea 实测（2026-11-07）：活跃层 20 条 ≈ 930 token，全库 108 条 ≈ 6220 token，而可用预算约 2K token。**全量摊开 = 每条都变薄**，所以分两层：活跃层争取被选中，储备层按需响应。

## 活跃层（20 个）

| 族 | 技能 |
|---|---|
| main-dev（10） | request-analysis、coding-skill、agent-eval、quality-audit、session-handoff、arch-deepen、retro、unit-test-ci、tea-voice、caveman-review |
| 通用（8） | db-migration、plan-control、frontend-design、fastapi-endpoint、vue-component、tea-tasting、shadcn、design-md-collection |
| biz-dev / prompt-templates（2） | 18-3d-scene、01-feature-dev |

## 储备层（其余 89 个）

储备 ≠ 废弃。它们的 `description` 仍是元数据的一部分，能被模型按需选中；差别只在**没有专门的入口段和踩坑段**，激活与否取决于真实任务是否点到它。

## 升降判据

| 方向 | 条件 | 动作 |
|---|---|---|
| 升 | 储备技能被真实任务点名 ≥ 3 次（`npm run audit:skill-usage` 切片记录可查） | 进活跃层，补「确定性入口」与「踩坑」 |
| 降 | 活跃技能连续 3 个切片零调用，且有同类技能覆盖 | 退储备层，删入口段 |
| 不升 | 技能无可对应脚本，且属纯流程 / 纯参考 | 标 N/A，不硬凑入口 |

**判据必须是记录，不是印象。** `audit-skill-usage` 当前统计 39 个切片、1 条技能记录（2026-11-07 批 G 产出首条：`rag-quality`）——剩下 38 条是「未留痕」，不是「88 个没用」。降判据的最小样本是 3 个有留痕切片，现在只有 1 个，所以本轮不动名单。

体检命令：`node scripts/audit-skill-layering.cjs`（读本文活跃层名单 + 切片留痕，输出升降候选；样本不足时显式报「未测」而非按 0 计）。

## 当前实测（2026-11-06）

| 指标 | 值 |
|---|---|
| 活跃层元数据 | 20 条 ≈ **930 token**（预算 ≤ 2000） |
| 活跃层确定性入口 | **16 / 20**（N/A 4：request-analysis、caveman-review、design-md-collection 无脚本可挂；shadcn 用 `npx`，不计入 `scripts/` 口径） |
| 活跃层踩坑段 | **14 / 20**（N/A 6：`lessons.md` 未点名，不编造） |
| 全库 | 109 技能 / 58 脚本；可执行 21、半可执行 12、纯文档 76；孤儿 0 |

## 维护

- 改活跃层名单 = 改本表 + 对应技能的入口段，两处必须一起改。
- 四族 README 与 `.agents/skills/README.md` 保持全量列出（README 不列 = 技能不存在，`verify-harness` §4h 会报错），**分层只标在本文，不在 README 逐行打标**，避免两份清单漂移。
- 本文不进常驻层。`AGENTS.md` 只指向技能路由表，不复制名单。
