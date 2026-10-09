---
last_updated: 2026-10-09
status: active
owner: yanha
---

# ai-eval-judge 变更记录（T12，F-A5 LLM-as-Judge 骨架）

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | ai-eval-judge（单维评委模板 + 校准脚本） |
| 分支 | 直接落 main（T12 独立 commit） |
| 需求来源 | REQ-ai-project F-A5 + PLAN §164-174 |
| 类型 | feat |
| 涉及范围 | docs/ai-eval/judge-prompts/（result-quality.md + README）+ scripts/calibrate-judge.cjs + 单测 |

## 二、需求与方案

### 需求描述

1. 每维独立评委（结果质量/过程质量/安全稳定），0/1 选择题 + UNKNOWN 选项。
2. A/B 位置交换 + 随机抽 10% 人工复核；校准一致率阈值 85%。
3. 校准脚本：人工标注 vs 机评 → 一致率，不达标调 Prompt 重跑。

### 技术方案

- 主模板 `result-quality.md`：评委维度/输入/给分要求/位置偏差控制/判分示例；README 说明 process-quality/safety-stability 复用同一结构。
- `calibrate-judge.cjs`：evaluate() 纯函数（过滤非法样本/A-B 不稳定独立上报）+ CLI（文件/--demo），`require.main === module` 守卫防 require 时执行 CLI。
- 单测 5 例（一致率/阈值/非法过滤/A-B 标记/空样本），node --test 5/5。
- A/B 不稳定样本打印 id（非对象）。

## 三、影响分析

- 影响面：新增 docs/ai-eval/judge-prompts/ + 1 脚本 + 1 测试；不触碰后端/前端。
- 契约变化：无。校准输出格式（一致率 + PASS/FAIL）供 T13 ITERATIONS.md 直接引用。
- 回滚：revert commit（纯新增文件）。

## 四、自检清单

- [x] 单测 5/5（node --test）
- [x] demo 实跑：87.5% ≥ 85% → PASS；不一致 LIB-008 与 A/B 不稳定 CHA-002 均正确上报
- [x] 修 2 bug：require 时误执行 CLI（加守卫）；unstable 打印对象改 id
