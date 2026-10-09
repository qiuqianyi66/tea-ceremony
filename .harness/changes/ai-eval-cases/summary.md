---
last_updated: 2026-10-09
status: active
owner: yanha
---

# ai-eval-cases 变更记录（T10，F-A1 评测集）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | ai-eval-cases（AI 评测集 50 条） |
| 分支 | 直接落 main（T10 独立 commit 14b3d07） |
| 需求来源 | REQ-ai-project F-A1（评测集 40-50 条）+ PLAN-final-convergence §125-140 |
| 类型 | feat |
| 涉及范围 | docs/ai-eval/cases/（6 文件）+ scripts/validate-eval-cases.cjs + 依赖 js-yaml |

## 二、需求与方案

### 需求描述

1. 每专家 ≥8 条评测用例，结构借鉴 promptfoo（id/type/input/points/expected）。
2. 分布 typical 60% / edge 25% / adversarial 15%；adversarial 覆盖降级、越权、无信息输入。
3. 考点 points 带 name/weight/veto/check（program|judge），支撑程序化判分与 LLM 判分双轨。

### 技术方案

- 6 文件：advisor/taster/librarian/brewer/mentor + chat（透明代理，F-A1 六类任务口径）。
- 50 条 = typical 30 (60%) / edge 12 (24%) / adversarial 8 (16%)，每文件 8-10 条。
- program 考点基准：茶类归属（铁观音→乌龙茶、君山银针→黄茶等）、温度区间（src/data/teaProcesses.ts）、拒绝关键词、RAG 命中（sources 非空）、健壮性（非 5xx）、降级（502）。
- `scripts/validate-eval-cases.cjs`：YAML 解析 + 计数 + 分布 + points 字段完整性校验（违规 exit 1）。
- 新增依赖 js-yaml（评测器解析必需；npm audit 0 漏洞）。

## 三、影响分析

- 影响面：新增 docs/ai-eval/ 目录与一个 scripts 校验器；package.json +1 依赖（纯 JS 无原生）。
- 契约变化：无（不触碰后端/前端代码）。
- 回滚：revert commit；评测集为纯数据文件，无迁移。

## 四、自检清单

- [x] 校验脚本实跑：50 条 / 分布 60/24/16 / VALID exit=0（两次：48 条不达标 → 补 2 条对抗后达标）
- [x] npm audit：0 vulnerabilities（--registry=https://registry.npmjs.org）
- [x] 对抗样本覆盖：LIB-008 造假指令、LIB-009 编造史实、CHA-009 越权导数据、BRE-008 危险冲泡、MEN-008 极端节食、TAS-008 虚假宣传、ADV-008 诱导高消费
