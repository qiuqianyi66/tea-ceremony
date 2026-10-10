---
name: expert-reviewer
description: 代码评审——6 维评审（正确性/性能/安全/一致性/可维护性/架构），问题 🔴🟡🟢🔵 分级，🟡 清零才过。流水线阶段 6。
---

# Expert Reviewer

## 触发
- 阶段 6 代码评审；MR 合入前（配合 .claude/agents/code-reviewer）。

## 工作流
1. 读变更清单（git diff + changes/summary.md），覆盖**全部变更文件**。
2. 6 维评审：正确性 / 性能（N+1/批量/缓存/分页）/ 安全（按下方 OWASP 清单）/ 一致性（wiki 漂移）/ 可维护性 / 架构合规（分层/红线）。
3. 分级输出：🔴 阻断（红线/安全/数据错误，禁降级）、🟡 主要（清零才过）、🟢 次要（记录）、🔵 提示（不阻塞）。
4. **每条 finding 附修复指引与规则出处（Harness 285「错误信息即 prompt」三要素，与 caveman-review 对齐）**：`FIX: <最短解法>` + `See: <红线编号/文档路径>`；🟡 以上必填，🔴 必须给。
5. 收尾：评审记录落盘；🔴🟡 未清 → 回炉（三要素修复）→ 重评；**闭环 ≤2 轮**，第 2 轮仍不过 → 暂停人工介入。

## 安全维度（OWASP 分类，评审时逐项扫描）

- 注入（SQL / 命令 / XPath / LDAP）
- XSS（存储 / 反射 / DOM）
- 认证与会话（JWT 泄露、会话固定、弱哈希）
- 越权（IDOR 水平 / 垂直）
- 敏感数据暴露（脱敏、日志泄密、前端硬编码密钥）
- XXE / SSRF
- 不安全反序列化
- 日志注入（log forging）
- 依赖漏洞（CVE，对应 CI 的 npm/pip audit）

命中任一项 → 按 🔴🟡 分级处理（红线问题禁降级）。

## 红线
- 🔴 红线问题禁止降级；🟡 未清零不过评审；覆盖全部变更文件。

## 自检
- [ ] 6 维全覆盖
- [ ] 🔴 零残留、🟡 清零
- [ ] 每条 finding 含 FIX 与规则出处（🔴 必须）
- [ ] 评审记录已落盘（.harness/changes/{feat}/review.md）

## 下一步

评审通过 → 分支 push 开 PR 时写 `pr-body`（Summary + before/after 证据）→ 合并后 `deploy-verify`（部署验证）。
