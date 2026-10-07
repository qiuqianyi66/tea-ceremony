---
name: expert-reviewer
description: 代码评审——6 维评审（正确性/性能/安全/一致性/可维护性/架构），问题 🔴🟡🟢🔵 分级，🟡 清零才过。流水线阶段 6。
---

# Expert Reviewer

## 触发
- 阶段 6 代码评审；MR 合入前（配合 .claude/agents/code-reviewer）。

## 工作流
1. 读变更清单（git diff + changes/summary.md），覆盖**全部变更文件**。
2. 6 维评审：正确性 / 性能（N+1/批量/缓存/分页）/ 安全（注入/XSS/越权/脱敏）/ 一致性（wiki 漂移）/ 可维护性 / 架构合规（分层/红线）。
3. 分级输出：🔴 阻断（红线/安全/数据错误，禁降级）、🟡 主要（清零才过）、🟢 次要（记录）、🔵 提示（不阻塞）。
4. **每条 finding 附修复指引与规则出处（Harness 285「错误信息即 prompt」三要素，与 caveman-review 对齐）**：`FIX: <最短解法>` + `See: <红线编号/文档路径>`；🟡 以上必填，🔴 必须给。
5. 收尾：评审记录落盘；🔴🟡 未清 → 回炉 → 重评。

## 红线
- 🔴 红线问题禁止降级；🟡 未清零不过评审；覆盖全部变更文件。

## 自检
- [ ] 6 维全覆盖
- [ ] 🔴 零残留、🟡 清零
- [ ] 每条 finding 含 FIX 与规则出处（🔴 必须）
- [ ] 评审记录已落盘（.harness/changes/{feat}/review.md）

## 下一步

评审通过 → `unit-test-ci`（CI 与质量门禁）→ `deploy-verify`（部署验证）。
