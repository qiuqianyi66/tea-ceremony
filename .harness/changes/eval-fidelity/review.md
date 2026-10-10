---
last_updated: 2026-10-10
status: active
owner: yanha
---

# eval-fidelity 评审记录

## 评审方式

脚本切片（L0/L1），走三步机械门禁（verify-harness / audit-redlines / audit-wiki-drift）+ node --test 单测 + 全量实跑验证 + 代码实读核对（专家路径是否受 system prompt 影响）。

## Findings

- 无 🔴。
- 🟡 2 条（均已修）：
  1. **分账口径写错**：初版把 `chat.yaml` 标为 `backendOnly`，但前端「自动」档 + 非茶问题正好落到 `transparentChat`（`AiChatService.dispatch` L194 实读确认）→ **它属前端可达**。改为按「默认路径 / 专家路径」二分，两段都对且含义清晰。
     - 根因：凭推测判定可达性，未实读路由代码。同 §0 第 6 条（客观执行）要求相悖。
     - 修复：`DEFAULT_PATH_FILES = {librarian, chat}` + 注释写明判定依据与代码行。
  2. **judge 调用被污染**：初版 `callChat` 统一加 system prompt，但 `judgeCase` 复用同一函数 → 评委会带上茶灵人设，违反 F-A5「单维独立评委」原则。
     - 修复：`opts.withSystemPrompt`（被评测调用 `true`，judge `false`）。
- 🟢 2 条：
  - **抽取而非复制**：`extractSystemPrompt()` 从 `teaAI.ts` 读，不抄第二份。理由：v4 的六境基准错误正是「手抄基准」抄出来的——同类问题预先规避。
  - 附带修掉 v4 遗留：六境单测仍用旧词 `行茶/见性/归真` → 改产品实际值 + 加回归锁（断言旧词不再命中）。

## Verdict

🔴 0 🟡 0

通过。验证证据：`node --test eval-core` **29/29**（新增 `extractSystemPrompt` 3 例，含「能抽取真实 teaAI.ts」）、`npm run quality` EXIT 0、`verify-harness.cjs` ERRORS: []、`audit-redlines.cjs` ERRORS: []、`validate-eval-cases.cjs` VALID、v5 全量实跑完成（overall 0.80 / judgeCoverage 0.96 / 默认路径 0.79 / 专家路径 0.81）。
