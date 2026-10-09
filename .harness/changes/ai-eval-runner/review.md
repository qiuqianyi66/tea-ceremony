---
last_updated: 2026-10-09
status: active
owner: yanha
---

# ai-eval-runner 评审记录（T11）

## Findings

- 🔴 0 条。
- 🟡 1 条（环境阻塞，已归因非代码）：live 探路两条判 0——根因容器外网到 DashScope TLS 被 RST（宿主代理 9674 未监听 + 直连亦被重置），非评测器逻辑错误；dry-run 同路径全 1 证明判分管道正确。
- 🟢 3 条：
  - 判分核心纯函数化（eval-core.cjs 无 IO），11 个 node --test 用例可独立回归，不依赖容器/AI key。
  - 中性 judge 设计：--judge 未跑时 judge 考点跳过不计分，dry-run/live 两态一致，不会误判。
  - 失败证据可回读：报告含 httpStatus/内容快照/sources 计数，环境恢复后可直接对账。

## Verdict

🔴 0 🟡 0（1 环境阻塞项待用户处理，见 summary.md 四）

通过（代码层）。验证证据：node --test 11/11、dry-run 2 条 VALID、live 探路定位到网络阻塞（日志 SSLHandshakeException 容器侧）。
