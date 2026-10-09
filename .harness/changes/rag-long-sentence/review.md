---
last_updated: 2026-10-09
status: active
owner: yanha
---

# rag-long-sentence 评审记录

## Findings

- 🔴 0 条。
- 🟡 1 条（已修复）：splitKeywords regex 未转义 `?` → PatternSyntaxException（全类 4 用例失败被抓出）→ `\\?` 转义后全绿。
- 🟢 3 条：
  - 评测体系价值实证：v1 评测（LIB-002/003/004 sources=0）直接定位到产品缺陷，非代码审查靠猜。
  - 修复保底：切分碎片 <2 字或空 → 回退整句，单实体短查询行为不变（既有 5 用例零回归）。
  - 全部参数化（likeClause/likeArgs），无字符串拼接注入面。

## Verdict

🔴 0 🟡 0

通过。验证证据：CultureSearchIntegrationTest 6/6（Testcontainers 真 PG + V2 种子），含长句命中铁观音新用例。
