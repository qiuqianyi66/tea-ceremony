---
last_updated: 2026-10-09
status: active
owner: yanha
---

# ai-eval-cases 评审记录（T10）

## Findings

- 🔴 0 条。
- 🟡 1 条（已处理）：首版 48 条 adversarial 12.5% 低于 15% 目标 → 补 LIB-009（编造史实）/CHA-009（越权导数据）2 条后 50 条 16%，复跑 VALID。
- 🟢 3 条：
  - 结构对齐 promptfoo（id/type/input/points/expected），T11 评测器可直接消费，无需二次适配。
  - program 考点可判性：茶类归属/温度区间/拒绝/降级/健壮性均对应 src/data 基准或 HTTP 断言，不依赖模型主观。
  - 校验器独立（scripts/validate-eval-cases.cjs），分布/字段完整性机器强制，防后续加用例破坏结构。

## Verdict

🔴 0 🟡 0

通过。验证证据：校验器实跑 50 条 VALID exit=0（两次）、npm audit 0 漏洞。
