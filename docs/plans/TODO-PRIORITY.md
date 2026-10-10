---
last_updated: 2026-10-10
status: active
owner: yanha
---

# TODO-PRIORITY — 一盏茶 待办与跨会话状态总览（活文档）

> 用途：跨会话状态交接，替代压缩摘要的不确定性。新会话先读本文件，再开工。
> 维护规则：状态变化当场更新 `last_updated`；完成一项划一项；过期内容移入对应 PLAN/ADR/学习记录（AGENTS.md §13），不留死行。

## 状态速览（2026-10-10 上午）

- main：**`7f3e6cc`**（远端已同步，工作区干净）。含 4 新 commit（ADR-018 Graph 暂缓 / 前端会话记忆迁移 / F-6 每会话 AI 配额 / 判分口径修正）+ `137b3a5` TODO 同步 + `7f3e6cc` PR #41 合并。
- **推送流程变更（2026-10-10，用户拍板）**：main 走 **PR-only**。新改动一律 `feature/xxx` / `fix/xxx` 分支 → push → 开 PR → **CI 13 job 全绿** → 合并。**禁再直推 main（bypass）**。PR #41 已按此流程走通（首次成功）。
- **分支保护现状（⚠️ 待补）**：`required_approving_review_count: 0`（死锁已解，用户改的）+ **`required_status_checks` 段缺失**——CI 门禁在改规则时被一并取消。**建议补回 CI 状态检查**（13 个 job 名见 `gh pr checks <PR>`），否则 PR 可带着红灯合并。
- **判分口径修正（重大，勿用旧数字）**：v1 0.82 / v2 0.96 均为 **program-only 口径**（judge off，未回填 judge 考点计中性 1）；修正为「未回填计 0」后 dry-run **overall=0.19 / programOnly=1**——98 考点中 77 个 judge（78.6%）从未被判。**简历数字引用前须跑 v3（--judge 全量实跑）**
- **F-6 AI 会话配额完成**（ec7e8f4 + 29d8d31）：按 sessionId 计数 → 429 QuotaExceededException（与 502 语义分离）；登录用户记忆交给后端 anchor，游客保留本地 history；顺带修 login-max 缩进错位（原挂 tea.ai 下恒走默认值）
- **ADR-018 Graph 暂缓**：四维甄别 0/4（业务无多步有状态 AI 编排；HITL 与零点击闭环冲突）；实证砍掉结构化输出/工具缓存；只保留 AI 会话配额
- **T10-T13 评测体系完成**：评测集 50 条 + 评测器 + 判分器补齐 + RAG 长句召回真 bug 修复（连接词切分+虚词剥离+参数化，TDD 7/7，容器重建验证）+ ITERATIONS 落 v1/v2 program-only 数字与归因
- **A5 已解除**：容器网络早已恢复——早前"网络阻塞"实为评测器 busy-wait bug，已改原生 async fetch
- **T12 Judge 骨架 + T14/K13 repo-map 完成**：judge-prompts 模板 + calibrate-judge.cjs（一致率 85%，单测 5/5，UNKNOWN 分账）+ gen-repomap.cjs（repo-map.md 270 行，抽查 8/8）
- **K14 已实现**：后端 mock ChatClient + 无 key 502 契约测试
- **T07-T09 Agent 能力补强全完成**：Trace 四层归因（V5 + ADR-016）、运行时领域技能（V6 + ADR-017）、复杂度三档路由
- **S1 茶园能量账本已合 main**（PR #40）；V4 迁移 + ADR-015 + garden 域 + 前端收集入库
- **A3 compose up backend 完成**：容器 healthy（18080→8080），auth 注册 200 + JWT，AI key 生效
- **最终规划已交付**：`docs/plans/PLAN-final-convergence-2026-10-09.md`（T01-T15）+ REQ-quality-backlog + REQ-ai-project
- 本地 Docker 引擎已修复：启动 `D:\docker\Docker Desktop.exe`（引擎 29.8.2）

## A. 阻塞项（需用户操作，1 项）

| # | 事项 | 解锁 |
| --- | --- | --- |
| A4 | 处理 cu 虚拟桌面占用 | K23 截图打通 + P0-3 前端返工验收 + **v3 --judge 全量实跑（约 20 分钟，出全量真实分）** |

## B. 可直接开工（无依赖）

1. **T15 C6 低优先甄别**（可穿插）；**Q1 真实用户试用**（PWA 部署发同学群，建议评测达标后做）
2. **D 系列低优先**（见下，可穿插）

## C. 依赖卡点（备料可先行，执行要等）

- **T03（A4 cu 桌面）**：等用户处理；Judge 校准实跑（--judge）也等它
- **K14** LLM mocking 确定性测试：✅ 已解锁并完成（无新代码）
- **Q1** 真实用户试用（PWA 部署发同学群）：评测体系达标（v2 0.96 ✅）后可做

## D. 低优先（Phase 6 / 工程单遗留）

- K17-K22：Trace→回归、eval 基线 diff、每周 cron 追加、结果度量、HANDOFF 分级、润化包 8 子项
- P1-5 审计员风险标记（⚠ 无来源）、P1-6 ai_usage_logs 消费端、P1-7 前端优化、P1-8 茶园 S1、P1-9 HTTPS、P1-10 OPTIMIZATION 核对
- 技术债：mcp 双版本共存、启动 WARN（随 agent-framework 升级）；Q2 C6 低优先甄别未做

## 最近完成（防重做：先查这里，勿从零重写）

- **判分口径修正 + F-6 配额 + ADR-018**（2026-10-10，b9f083a 链，另一会话）：①b9f083a 判分语义「judge 未回填计 0」+ 报告 programOnly/judgeCoverage 口径 + calibrate UNKNOWN 分账（不计分母）+ ITERATIONS 标注 v1/v2 为 program-only；②ec7e8f4 F-6 每会话配额（AiCallQuota + QuotaExceededException 429）+ Trace plan 增复杂度档位 + 修 login-max 缩进；③29d8d31 前端会话记忆迁移（登录 Authorization+sessionId 后端 anchor、游客本地 history、429 清会话降级、setup.ts polyfill）；④1b64bdd ADR-018 Graph 暂缓（四维甄别 0/4）+ Graph 精读实测反驳（教材可信度低，见 research-spring-ai-alibaba-graph-2026-10.md §10）。
- **T10-T13 评测体系完成 + RAG 真 bug 修复**（2026-10-09）：v1 0.82/41 → v2 **0.96/48**（结果 0.93/过程 1.0/安全 1.0）。归因两类：判分器缺口 8 条（六境/投茶量/未命中/拒绝词补齐）+ RAG 长句召回真 bug（LIB-002/3/4 sources=0：整句 ILIKE miss → splitKeywords 连接词切分+虚词剥离+二次拆词 + likeClause/likeArgs 参数化，TDD 先红后绿，集成测试 7/7，容器重建 curl 双验证）。v2 残余 2 条：BRE-005 检查器单位补 `克`（已修）；MEN-001 真失败保留（mentor 入门规划未引六境，下轮迭代打磨）。评测器加 `--delay`（限流 10/min 产品节奏）。A5 解除（busy-wait bug 已修）。**数字均为 program-only 口径，见状态速览**。
- **T12 + T14/K13**（2026-10-09，46213f2）：T12 LLM-as-Judge 骨架（result-quality 单维评委模板 + calibrate-judge.cjs 一致率 85% + 单测 5/5 + demo PASS 87.5%）；K13 repo-map（gen-repomap.cjs 自动生成 docs/reference/repo-map.md 270 行，抽查 8/8 符号，缺失 exit 1）；K14 查证已实现（后端 mock ChatClient + 502 契约测试）。
- **T10-T11 评测体系前半**（2026-10-09）：T10 评测集 50 条（advisor/taster/librarian/brewer/mentor/chat 六文件，typical 30/edge 12/adversarial 8，校验器 VALID，14b3d07）；T11 评测器（eval-core.cjs 纯函数判分 + eval-tea-ai.cjs IO + node --test 11/11 + dry-run VALID + live 探路定位环境阻塞，b8d38bc）；js-yaml 依赖（audit 0 漏洞）；切片 ai-eval-cases/ai-eval-runner 已落。
- **T07-T09 Agent 能力补强**（2026-10-09）：T07 AI 评测 Trace（V5 `ai_eval_traces` 四层 JSONB + TraceRecorder 旁路埋点 + AiChatVo tokens 透传 + ADR-016，容器 PG 往返验证，182 tests）；T08 运行时领域技能（V6 `agent_skills` 4 领域种子 + AgentSkillRouter detect/load + LibrarianAgent 注入 + ADR-017，往返验证，201 tests）；T09 复杂度路由（SIMPLE 直答/MEDIUM 专家/COMPLEX 锚定压缩 20→5，配置化 tea.ai.complexity.*，201 tests）。
- **S1 茶园能量账本合 main**（2026-10-09）：PR #40（feature/garden-s1，8 commits）13 job 全绿 → `--admin --merge`（f600967）。3 轮 CI 修复模式：① Biome 只跑 `npx biome check --write <file>`；② 时间敏感断言用"当天内接近 0"容错；③ vitals 写入等待 5s→30s（本地实测该测试本身 4.8s）。V4 迁移：garden_energy_events + energy 列 + status 归并；ADR-015。
- **A3 compose up backend**（2026-10-09）：8080 被 pid 26916 占用 → 宿主机映射 `18080:8080`（d608c7c）；容器 healthy；`POST /api/v1/auth/register` 200 + JWT；`/actuator/health` UP。
- **T05 漂移修复**（2026-10-09，9d6a1a3）：biz-dev README 03 改两级缓存（ADR-012）；system-overview 全量刷新（Spring Boot 7 域/DashScope/13 job/Docker/garden 能量账本）；CONTEXT 4 处修复；4 个文档元信息头治理。verify-harness 全绿。
- **ADR-015 命名统一**（2026-10-09，f605b88）：ADR-015-garden-energy.md → ADR-015.md（git mv）；AGENTS.md §12 + 工程结构.md ADR 声明 014→015；PLAN-garden-s1-design 引用同步。
- **最终规划交付**（2026-10-09）：REQ-quality-backlog（6 簇 17 项 F-1~F-17 + D-1~D-9）；REQ-ai-project（F-A 评测体系 9 项 / F-B 3 项 / F-C 1 项 + D-A1~A4）；PLAN-final-convergence（T01-T15，V5 迁移/评测器/Judge 模板已写死）。
- **K7-K12 Phase 2**：PR #39 已合并（7975a3f，11 commits）。技能准入 O-11、评审闭环≤2 轮、经验链路 patterns 9 条、ADR-014 ArchUnit 两条规则、开工自查、CI job 看门。

## 关键 ID / 命令（准确取用）

- main：**`7f3e6cc`**（远端已同步）；PR：#38（ffe807e1）、#39（7975a3f）、#40（f600967，S1 已合）、**#41（7f3e6cc，PR-only 约定，已 squash 合并）**；commit：T10 `14b3d07`、T11 `b8d38bc`、T12/K13 `46213f2`、RAG fix `6b107af`、虚词 `f90692f`、评测 v2 `a4a1c05`、活文档 `684ef7b`、ADR-018/配额/迁移/口径 `1b64bdd` `29d8d31` `ec7e8f4` `b9f083a`、TODO 同步 `137b3a5`
- 分支：feature/garden-s1（已合，worktree `C:\Users\yanha\Desktop\tea-garden-s1` 可删可留）
- 迁移：V1 init / V2 culture_seed / V3 agent_memory / V4 garden_energy / **V5__ai_eval_traces**（T07）/ **V6__agent_skills**（T08）；V5/V6 编号已写死
- 方案：`docs/plans/PLAN-final-convergence-2026-10-09.md`（当前唯一执行母本）；`PLAN-k13-p12-design-2026-10-09.md`（K13/P1-2 设计）
- ADR：`docs/ADR/` 001-018（014 ArchUnit / 015 garden / 016 ai eval trace / 017 agent skills / **018 Graph 暂缓**）
- 经验池：`docs/plans/patterns.md`（P1-P9 候选，待跨项目验证）

```
npm run quality                     # 提交前门禁（全绿要求）
node scripts/verify-harness.cjs     # 治理一致性，期望 ERRORS: []（ADR 17 / CI 13 job / 技能 .agents 66 + .harness 33）
node scripts/audit-redlines.cjs     # 红线机械化审计，期望 ERRORS: []
node scripts/audit-wiki-drift.cjs   # wiki 契约漂移审计，期望 ERRORS: []
node scripts/validate-eval-cases.cjs  # 评测集结构校验（期望 VALID，T10 门禁）
node scripts/eval-tea-ai.cjs --dry-run # 评测器管道自检（mock；注意 programOnly/judgeCoverage 口径字段）
node scripts/eval-tea-ai.cjs          # live 评测（默认 delay 6500ms；judge off 出 program-only 分）
node scripts/eval-tea-ai.cjs --judge --delay 13000  # v3 全量实跑（50 条 × 2 次 AI 调用，约 20 分钟；出全量真实分，简历引用前必跑）
node scripts/calibrate-judge.cjs --demo # Judge 校准演示（期望 PASS，一致率 ≥85%）；实跑 --judge 需 A4
node scripts/gen-repomap.cjs         # 仓库地图生成（期望 OK，抽查 8/8 命中）
cd backend && mvn -q test           # 后端全量（201 tests，含 Testcontainers，需 Docker 引擎）
mvn test -Dtest=LayerDependencyTest # 单跑 ArchUnit（6 条规则）
```

- **ArchUnit 三坑**：① `getAnnotationOfType(Class)` 泛型编译冲突 → 用 `getAnnotationOfType(类型名)`；② `getReturnType().getName()` 含泛型参数 → 用 `getRawReturnType().getName()`；③ `noMethods()...should().exist()` 不存在。
- **GitHub push**：走 22 端口（443 会被网络重置），用一次性 `$env:GIT_SSH_COMMAND="ssh -o HostName=github.com -o Port=22"`。**merge main 走 PR**（见状态速览）；`approvals=0` 已解死锁，`--admin` 不再必需。
- **分支保护补 CI 门禁**（待办）：
  ```
  gh api repos/qiuqianyi66/tea-ceremony/branches/main/protection  # 确认 required_status_checks 缺失
  gh pr checks <PR号>  # 取 13 个 job 名，再 PATCH required_status_checks 补回
  ```
