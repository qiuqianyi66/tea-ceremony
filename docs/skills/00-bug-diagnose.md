---
name: 00-bug-diagnose
description: 00-bug-diagnose 人读审查页——面向人核对难 bug 诊断的 6 阶段纪律与 tea 特定分诊。机器侧权威在 .harness/skills/trouble-shooting/00-bug-diagnose/SKILL.md。
status: active
owner: yanha
date: 2026-10-11
last_updated: 2026-10-11
---

# 00-bug-diagnose 人读审查页

> 面向人核对。机器侧权威在 `.harness/skills/trouble-shooting/00-bug-diagnose/SKILL.md`，本页只做翻译与核对。

## 它管什么

- 难 bug 诊断的**总入口**：先建 tight feedback loop（一条命令稳定变红），再走 6 阶段（建 loop → 复现最小化 → 排序假设 → 插桩 → 修 + 回归 → 清理）。
- **Phase 0 是 tea 特定分诊**（建 loop 前先过）：环境层 TLS / 数据模型层 NOT NULL / 类型系统层 null enum / 可观测性层旁路静默降级——四层来自本项目真实事故史。
- 定位到具体领域后分派到 01-slow-sql / 02-oom / 03-cpu / 04-ai-exception / 05-rag-quality。

## 为什么建这个技能（而不是在 AGENTS.md 堆规则）

- 三层语义红线：诊断流程是**按需动作**，不进常驻规则；§13 只沉淀四条具体结论（TLS / NOT NULL / null enum / 静默降级）。
- 本技能要防的失败模式是「读代码猜根因」——靠的是「没有变红命令不许进 Phase 2」的纪律，不是一条红绳。
- Phase 0 的四层分诊把 §13 零散教训组织成「先排除已知高频层」的快速路径，降低重复踩坑成本。

## 何时该用 / 不该用

| 该用 | 不该用 |
|---|---|
| 用户报 bug/报错/慢/崩/不对，且不知是哪类 | 已知是 SQL/OOM/CPU/AI/RAG 哪类（直接走 01-05） |
| 间歇性 flake、两个 good 状态间 regression | 纯新功能开发、单点文案错 |

## 审查要点（人怎么核对它生效了）

1. Phase 0 四层是否先过了一遍，再建 loop（别把环境问题当代码问题查半天）。
2. 是否有一条**已跑过的 red-capable 命令**（秒级、确定、无人值守）才进 Phase 2。
3. Phase 3 是否列了 3-5 个**可证伪**假设并排序给用户看，而非单假设锚定。
4. Phase 4 是否一次只改一个变量、日志打标签。
5. Phase 6 是否清干净 `[DEBUG-*]` 日志、commit 写清真假设。

## 怎么知道它在生效

- SKILL.md frontmatter：`type: flow`（判断流程，不跑脚本）。
- trouble-shooting README 已登记一行（难 bug 总入口，定位后分派 01-05）。
- 下次报 bug 时先命中 Phase 0 某层、或先有变红命令再动手，而不是先读代码猜。
