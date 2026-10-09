---
last_updated: 2026-10-09
status: active
owner: yanha
---

# rag-long-sentence 变更记录（T11 评测抓出的真 bug 修复）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | rag-long-sentence（文化检索长句召回修复） |
| 分支 | 直接落 main（独立 commit） |
| 需求来源 | T11 v1 评测 LIB-002/003/004 失败归因：RAG sources=0（AI 答对但无知识库出处） |
| 类型 | fix |
| 涉及范围 | backend CultureSearchService（整句 ILIKE → 连接词切分 OR 参数化）+ 集成测试 +1 |

## 二、需求与方案

### 缺陷复现

- curl `culture/search?q=铁观音` → teas 命中；`?q=铁观音和武夷岩茶有什么区别？` → 8 表全空。
- 根因：`search()` 用整句拼 `%q%` ILIKE，长句无整句匹配字段 → 必 miss。

### 修复方案

- `splitKeywords`：按中文连接词（和/与/以及/还有/或/、/，/,/？/!/。/\s）切分；碎片 <2 字或切分失败回退整句（保持原行为）。
- 8 表查询改 `likeClause(fields, n)` + `likeArgs(fields, patterns)`：每列 × 每关键词 OR ILIKE，全部参数化（防注入）。
- regex 注意：`?` 是 Java regex 元字符，必须 `\\?` 转义（首版未转义 → PatternSyntaxException，测试抓出）。

## 三、影响分析

- 影响面：后端 culture 域单 Service（JDBC 查询改造）；无表结构变化、无迁移。
- 契约变化：无（culture/search 响应结构与语义不变，召回变准）。
- 性能：关键词数 = 连接词切分数（实测 ≤3），8 表查询参数略增，量级不变。
- 回滚：revert commit；无迁移。

## 四、自检清单

- [x] TDD：先写失败测试 `longSentenceQueryHitsTeas`（长句须命中铁观音）→ 红（AssertionError line 101）→ 修复 → 绿
- [x] CultureSearchIntegrationTest 全类 6/6（含既有 5 用例回归）
- [x] 二次修复：regex 转义 `\\?`（首版 PatternSyntaxException 被测试抓出）
