---
title: r5-context-budget-review
last_updated: 2026-10-16
status: active
owner: yanhao
---

# R5 评审记录（L0 快评，阶段 6）

> 范围：`.harness/rules/编码规范.md`、`.harness/rules/开发流程规范.md`、`CONTEXT.md` 的压缩 + 引用同步 + 门禁棘轮。
> 性质：治理/文档改动，无代码行为变更。评审依据：`编码规范.md` §五 红线 R1-R15、`开发流程规范.md` §五 六维。

## 六维核对

| 维度 | 结论 |
|---|---|
| 正确性 | ✅ 判据零丢失（`ledger.json` 107 锚点全命中；32 条为逐行原文命中）；§ 小节号保持稳定，历史 § 引用（§1/§5/§7/§9/§27 等 20+ 处）无需改动即仍有效 |
| 性能 | ✅ 常驻层每轮省 1,464 token（20,192 → 18,728）；单文件预算 + 总预算双棘轮防反弹 |
| 安全 | ✅ 未触碰任何密钥/凭据路径；`.env*` 相关表述（红线 R9）原文保留 |
| 一致性 | ✅ 四处引用同步已改（coding-skill / red-line-auditor / reference checklist / AGENTS §7 + 工程结构.md）；`BusinessException` 与代码类名对齐 |
| 可维护性 | ✅ 每个约束只留一个维护点：红线编号内联、命令指向 package.json/ci.yml、技能数指向 AGENTS §12、经验判据指向 AGENTS §13 |
| 架构合规 | ✅ 无红线违反（`audit-redlines.cjs` ERRORS: []）；文档分层未变（rules/skills/changes 各归其位） |

## 红线核对（R1-R15）

零违反 —— 本轮只改文档与门禁脚本，无源码改动：`go`/`mvn`/前端源码、迁移、探针、CI job 数（13）均未动。`audit-redlines.cjs` 人工核对项（R1/3/5/6/13/15）在压缩稿中逐条保留（见台账 kept 组）。

## 问题分级与风险（未解决项，已入 summary §三）

| 级别 | 问题 | 处理 |
|---|---|---|
| 🟢 次要 | ~~`vite.config.ts` 与编码规范 §25 漂移~~ | **已修**：实现是有意决策（配置注释写明 Three chunk 不可再拆），故改规则对齐实现——§25 改为「懒加载 + 数据外置 + echarts 按需 + 阈值 1000 + `VISUALIZE=1` 出 stats.html」 |
| 🟢 次要 | ~~AGENTS.md §6 与编码规范/DESIGN_SPEC 重复~~ | **已修**：压成两行指针（保留设计门禁 6 步 / 禁令速查 / 第三方库先查 package.json），AGENTS.md −317 字符 / −102 token |
| 🟢 次要 | ~~DESIGN_SPEC 图标库 Iconify~~、~~编码规范 §8 缺 BCrypt~~ | **已修**：DESIGN_SPEC → `lucide-vue-next`（实测依赖与代码）；§8 补 BCrypt |
| 🔵 提示 | `/api/ai/*` 与 `/api/v1/ai/*` 前缀写法不统一 | 原样保留，未擅自统一语义 |
| 🔵 提示 | ADR-011 引用不存在的「开发流程规范 §36」；`docs/promotion/good-first-issues.md` 仍按 Iconify 起草并引用已压缩的 AGENTS 段名 | 历史文档 / 对外草稿，未改 |

## 结论

**CLEAN** —— 🔴 0 🟡 0（🟢 次要 0 遗留 + 🔵 提示 2 记录在案，不阻塞）：五项确定性门禁全绿、零丢失校验通过、预算棘轮已收紧、3 处规则-实现漂移已按实现对齐。

## 验证证据（原样输出）

```
audit-context-migration  ERRORS: []   条目 kept 6 / moved 5 / dropped 5；锚点 107，未命中 0
audit-context-budget     ERRORS: []   常驻层合计 45,231 字符 ≈ 18,728 token（总预算 19,500）
verify-harness           ERRORS: []   AGENTS.md 221 行 | ADR 20 个 | CI 13 job | .agents/skills 66 个 | .harness/skills 39 个
audit-redlines           ERRORS: []   人工核对 R1/3/5/6/13/15 保留
audit-wiki-drift         ERRORS: []   wiki 42 端点 ↔ 代码 42 端点
npm run verify           exit 0       （CI 同源路径）
```
