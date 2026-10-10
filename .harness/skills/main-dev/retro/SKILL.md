---
name: retro
description: 任务收尾回顾——按 6 类扫这次什么卡住了，机械错误→加自动化检查，判断错误→补规则。当一个功能/bug/重构收尾、或会话结束前主动触发，目的是改环境不是改代码。
type: flow
---

# Retro（任务收尾回顾）

构建结束后回顾这次会话，找**环境改进点**——不是再改代码。机械错误→加确定性检查（脚本/lint/CI job）；判断失误→补规则/技能。默认"写检查优于写规则"。

## 触发条件

- 一个切片/功能/bug 修复合并后
- 会话结束、要开新会话前
- 这次过程明显卡过、返工过、踩过坑
- 不触发：任务进行中（那是 debug）、纯文档小改、交付前最后验证

## 核心原则

- **实现 agent 上下文压力最大，review agent 最小**。所以编码标准由 review 端强制，不靠实现端自觉。
- **机械错误→确定性检查**（lint 规则/pre-commit/CI job/audit 脚本）；判断失误（跨文件一致/周边风格）→才写编码规范。默认 build the check over writing the rule。
- AGENTS.md 只放导航指针和最高红线；操作细节进技能；文档进 docs/。

## 6 类扫描

按顺序扫，每类问一个问题，命中即列候选：

### 1. Navigation（导航）
这次找文件/找信息花了很久？两个文件间有隐藏依赖？→ 加导航指针（AGENTS.md/路由表/wiki 里指一下路径）。

### 2. Automated checks（自动化检查）
这次犯的错能不能被现有脚本抓到？跑过 `audit-redlines`/`verify-harness`/`audit-wiki-drift` 了吗？
- 已有检查但没挂 CI/没跑 = 发现（接上线）。
- 没检查这个错误类型 = 候选新脚本或 lint 规则。
- repo 连 pre-commit/CI lint 都没有 = 这本身就是发现（不是中立默认，是持续错失机会）。

### 3. Coding standards（编码规范）
review 漏了错？是机械错（固定语法/禁 API/import 形状/文件位置）→ 回第 2 类写确定性检查；是判断错（跨文件一致/风格）→ 补进对应 SKILL.md 或编码规范。

### 4. Global AGENTS.md
AGENTS.md 是不是膨胀了？哪些常驻规则其实可以下沉到技能（按需加载省 token）？哪些 no-op（写了但不改变行为）？

### 5. Tool economy
这次有没有昂贵的 token 浪费？重复读同一文件、绕路调工具？→ 记录下来，下次直接走快路径。

### 6. No-ops / Information access
- 驾驶文件里有没有写了但 agent 行为没变的废话？
- 关键信息当时 agent 拿不到（dev server 日志/只读权限）？→ 加 tee log/只读访问。

## 流程

1. **先跑现有检查**（tea 已有机械化门禁，别重复造）：
   ```
   node scripts/verify-harness.cjs        # 一致性
   node scripts/audit-redlines.cjs       # 红线
   node scripts/audit-wiki-drift.cjs     # 契约漂移
   ```
   这三个抓出来的问题直接列；全绿再往下扫。
2. 读本次会话的主要证据：diff、报错、卡过的地方、`git log`。
3. 按 6 类扫，每类最多列 1-2 个候选。
4. 候选按严重度排序列给用户：
   - 机械错误 → 提议写什么脚本/挂什么 CI
   - 判断错误 → 提议补哪条规则
   - 导航问题 → 提议加哪个指针
5. 用户拍板哪些落地。
6. 落地：
   - 新脚本 → `scripts/` 下，挂 verify-harness 或 CI
   - 新规则 → 对应 SKILL.md，不抄进 AGENTS.md
   - 新指针 → 路由表/wiki
   - 经验证据 ≥3 条才晋升 §13 规则；否则记 `docs/plans/patterns.md` 候选

## 纪律

- **不改业务代码**。本技能只动环境（脚本/规则/导航）。
- 一次 retro 最多落地 3 项；贪多等于没做。
- 新脚本先跑一次证明能抓这次的错，再挂 CI。
- 已有的检查不重复造——先跑 `node scripts/verify-harness.cjs` 和 `audit-redlines.cjs` 确认现状。

## 检查清单

- [ ] 6 类都扫过（哪怕结论是"无"）
- [ ] 机械错误全部提议确定性检查（不是写规则）
- [ ] 候选 ≤3 项，按严重度排序
- [ ] 落地项有 owner（哪个文件/脚本）
- [ ] 未改业务代码
- [ ] 新脚本已跑过一次证明能抓这次的错

## 下一步

- 落地后跑 `node scripts/verify-harness.cjs` 确认治理一致。
- 经验够 3 条真实证据 → 晋升 AGENTS.md §13。
