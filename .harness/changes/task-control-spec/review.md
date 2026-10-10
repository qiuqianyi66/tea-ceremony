---
last_updated: 2026-10-10
status: active
owner: yanha
---

# task-control-spec 评审记录

## 评审方式

本切片为治理文档改动（L0），按小改动合并场景走简化评审：规则落点自查 + 三步门禁（verify-harness / audit-redlines / audit-wiki-drift）+ 接线边界人工核对。

## Findings

- 无 🔴。
- 🟡 1 条（已修）：初次落笔时 `§13` 学习记录里用反引号写了 `docs/TODO-PRIORITY` 与 `docs/OPTIMIZATION_PLAN`（无 `.md` 后缀），`verify-harness.cjs` 路径存在性检查当即报 `ERRORS: [2]`。已补全后缀，复跑 ERRORS: []。
  - 根因：AGENTS.md 引用路径必须与真实文件名逐字一致，`verify-harness` 会解析反引号内容。
  - 修复：改为 `docs/TODO-PRIORITY.md` / `docs/OPTIMIZATION_PLAN.md`。
- 🟢 2 条：
  - 接线边界守住：技能正文（plan-control 280 行 / request-analysis 69 行）未被抄入 AGENTS.md，仅留路由与落点，符合 §2 token 分工红线与 plan-control §18。
  - ADR-019 与既有 `.harness/rules/开发流程规范.md` §一（十阶段 + L0-L3 分级）为「入口 ↔ 细则」关系，未产生平行体系；已同步 `工程结构.md` L184 与 AGENTS.md §12 的 ADR 声明至 019。

## Verdict

🔴 0 🟡 0

通过。验证证据：`verify-harness.cjs` ERRORS: []（ADR 19 个 / CI 13 job / AGENTS.md 250 行）、`audit-redlines.cjs` ERRORS: []、`audit-wiki-drift.cjs` ERRORS: []（wiki 端点 41 == 代码端点 41）、`add-doc-meta.cjs` 元信息 107/107。
