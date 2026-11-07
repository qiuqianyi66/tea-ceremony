# skill-dynamic-batchG 变更记录

> 目录：`.harness/changes/skill-dynamic-batchG/`。本切片是 F11「真实任务回归」的载体：记录一次真走技能链的过程，并产出全库第一条技能调用留痕。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | skill-dynamic-batchG（给 05-rag-quality 接上确定性入口） |
| 分支 | `fix/skill-dynamic-batchG`（基于 main b9295de） |
| 需求来源 | `docs/plans/PLAN-skill-dynamic-2026-11-07.md`（F11） |
| 类型 | docs |
| 涉及范围 | 技能正文（`.harness/skills/trouble-shooting/05-rag-quality/`） |
| 调用技能 | rag-quality |

## 二、技能链实走记录

这条切片的意义不是「改了哪个文件」，而是把「选技能 → 读正文 → 跑脚本 → 留痕」跑一遍，看机制在真实任务里是否顺手。

| 步骤 | 实际动作 | 结果 |
|---|---|---|
| 1 路由定位 | 读 `.harness/skills/trouble-shooting/README.md` 路由表 | 6 个故障排查技能，选中 `05-rag-quality`（RAG 质量问题正好对上） |
| 2 读正文 | Read `05-rag-quality/SKILL.md`（26 行，四段：触发 / 工作流 / 红线 / 自检） | 发现没有「确定性入口」，属纯文档 |
| 3 找资产 | 在 `scripts/` 里找 RAG 相关脚本 | 命中 `audit-eval-rag.cjs`，且 `quality-audit` 已在点名它 |
| 4 真跑脚本 | `node scripts/audit-eval-rag.cjs` | exit 0，输出 KB 依赖 case 10 条逐条 OK —— 证明它不是空壳 |
| 5 补入口 | 正文加「确定性入口」两行，指向该脚本 | 纯文档 → 可执行 |
| 6 留痕 | 本文件「调用技能」填 `rag-quality` | `audit-skill-usage` 记录数从 0 变 1 |

### 这条链路暴露的真问题

1. **技能自己不知道有哪些脚本可用**：`05-rag-quality` 的工作流第 4 步写「抽查集命中率对比」，但全库有现成的 `audit-eval-rag.cjs` 在做这件事，正文没点名，等于每次都要人手跑。
2. **五个故障排查技能全无「确定性入口」**：01-slow-sql / 02-oom / 03-cpu / 04-ai-exception / 05-rag-quality 都是纯文档，其中至少 05 有明确可接的脚本。
3. **留痕机制此前从未被真实使用**：模板早有「调用技能」行，38 个切片一次都没填。这行不填，升降判据永远没数据。

## 三、影响分析

- 只改技能正文，不动代码、不动脚本行为。
- `05-rag-quality` 从「纯文档」升为「可执行」：全库可执行 17 → 18。
- 回滚：删除新增的两行即可。

## 四、自检清单

- [x] 脚本真跑过（exit 0），不是只写了个路径
- [x] 路径在正文以反引号给出，`verify-harness` §4m 会校验其存在
- [x] 遵守「只动必须动的」：只加「确定性入口」一段，未改工作流与红线
