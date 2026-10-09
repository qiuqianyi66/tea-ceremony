---
last_updated: 2026-10-09
status: active
owner: yanha
---

# ai-eval-judge 评审记录（T12）

## Findings

- 🔴 0 条。
- 🟡 2 条（已修复）：① require 时 CLI 主流程误执行导致 node --test 加载失败 → 加 `require.main === module` 守卫；② unstable 明细打印 `[object Object]` → 改 `.map(s => s.id)`。
- 🟢 3 条：
  - evaluate() 纯函数化：非法样本过滤、A/B 不稳定独立上报，5 个单测可独立回归。
  - UNKNOWN 选项内置：信息不足不硬判，减少误伤（评测集 LIB-006 未命中类用例受益）。
  - 模板复用结构（README 说明 process/safety 只改维度段），避免三份重复文档。

## Verdict

🔴 0 🟡 0

通过。验证证据：node --test 5/5、demo PASS 87.5%（含不一致与不稳定明细正确输出）。
