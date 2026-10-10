---
name: bug-diagnose
description: 难 bug 诊断总入口——先建 tight feedback loop（一条命令稳定变红），再按 6 阶段排查。当用户报 bug/报错/慢/异常且还不知道是哪个领域时触发；定位后分派到 01-slow-sql/02-oom/03-cpu/04-ai-exception/05-rag-quality。
type: flow
---

# Bug 诊断（bug-diagnose）

难 bug 的 6 阶段纪律。**Phase 1 是本体，其余是机械动作**。没有能稳定复现的命令，不许 theorize——读代码猜根因是本技能要防的失败模式。

## 触发条件

- 用户说"这个 bug 帮我看看 / 报错了 / 慢 / 崩 / 不对"
- 还不知道是 SQL/OOM/CPU/AI/RAG 哪类问题
- 间歇性 flake bug、两个已知 good 状态间的 regression
- 不触发：已知是哪类问题（直接走 01-05）、纯新功能开发、单点文案错

## Phase 0: tea 特定快速分诊（建 loop 前先过）

本项目历史 bug 集中在四层，Phase 1 建 loop 前先快速排除：

1. **环境层（网络/TLS）**：症状是 AI 调用超时 + `SSLHandshakeException` → 按 §13「容器出网 TLS 排查法」（nc/DNS/容器内 openssl/宿主机对比）。TCP/DNS 通但容器内 TLS eof = 环境级拦截，不是代码问题。
2. **数据模型层（NOT NULL / null 字段）**：症状是"某 agent 的 trace 0 行 / 静默丢数据" → 查 `AiChatVo` 这类实体有没有两参构造漏了 NOT NULL 字段（§13 旁路 catch 教训）。insert 失败被 catch 降级成 warn，数据永久丢。
3. **类型系统层（null enum / 空指针）**：症状是集成测试 500 → 查路由回落路径有没有对可能为 null 的枚举直接 `.name()`（§13 AgentOrchestrator null 教训）。
4. **可观测性层（旁路静默降级）**：症状是"数据没落库但日志没报错" → 查旁路（埋点/计量）的 catch 是不是把落库失败吞了。

四层都排除不掉，再进 Phase 1 建 loop。

## Phase 1: 建 tight feedback loop（最重要，花大力气）

**这是整个技能。** 有一条命令在这个 bug 上稳定变红，bisection/假设/插桩都只是消耗它。没有它，盯着代码看多久都没用。

按顺序试，第一个成功的就是 loop：

1. 失败测试（单元/集成/e2e，打在能碰到 bug 的 seam 上）
2. curl / HTTP 脚本打 dev server
3. CLI 带 fixture 跑，stdout 对 snapshot
4. Headless browser（Playwright）驱动 UI，断言 DOM/console/network
5. Replay 捕获的 trace（真实请求/payload 存盘，隔离重放）
6. Throwaway harness（最小子集，一个函数调用触发 bug）
7. Property/fuzz（"有时错"→ 跑 1000 个随机输入找失败模式）
8. Bisection harness（两个已知状态间回归 → `git bisect run`）
9. Differential loop（同输入跑新旧版本 diff 输出）
10. HITL bash script（最后手段：必须人点的，用脚本结构化驱动）

### Tighten loop

有 loop 后当产品打磨：
- 更快？（缓存 setup、跳过无关 init、缩小范围）
- 信号更锐？（断言具体症状，不是"没崩"）
- 更确定？（pin 时间、seed RNG、隔离文件系统、冻结网络）

2 秒确定的 loop 是 debug 超能力；30 秒 flaky 跟没有一样。

### 非确定 bug

目标不是"干净复现"而是**提高复现率**。loop 触发 100×、并行、加压、缩时序窗口、插 sleep。50% flake 可 debug；1% 不行，继续拉高复现率。

### 真建不起来 loop

停下来说。列试了什么。问用户要：(a) 复现环境访问 (b) 脱敏捕获物（HAR/log dump/core dump/录屏带时间戳）(c) 临时加生产插桩的许可。**没有 loop 不许进 Phase 2。**

### Phase 1 完成标准

能说出**一条命令**（脚本路径/测试调用/curl），已跑过至少一次（展示调用+输出，脱敏），且：
- [ ] Red-capable：走真实 bug 代码路径，断言用户说的症状，能变红能转绿
- [ ] Deterministic：每次同判定（flaky bug 要有足够高复现率）
- [ ] Fast：秒级不是分钟级
- [ ] Agent-runnable：无人值守能跑

发现自己开始读代码建理论 → **停**。先有变红命令再说。

## Phase 2: 复现 + Minimize

1. 跑 loop，看它变红。确认失败模式是**用户描述的那个**，不是附近另一个错。
2. 缩小到**最小场景仍红**的输入。砍输入/调用方/配置/数据/步骤，一次砍一个，每次重跑 loop。
3. 完成标准：剩下的每个元素都 load-bearing——删掉任何一个 loop 就变绿。

最小 repro 缩小 Phase 3 假设空间，也成为 Phase 5 的回归测试。

## Phase 3: 排序假设

列 **3-5 个可证伪假设**再测。单假设会锚定第一个貌似合理的答案。

每个假设格式：
> 如果 X 是因，那改 Y 会让 bug 消失 / 改 Z 会让它更严重。

说不出预测 = vibe，扔掉或 sharpen。

**先把排序后的假设给用户看**——用户有领域知识会立即重排（"#3 我们刚改过"）或排除已知答案。不阻塞，用户 AFK 就按你的排序继续。

## Phase 4: 插桩

每个 probe 对应 Phase 3 一个预测。**一次只改一个变量。**

工具优先级：
1. Debugger/REPL（一个断点顶十条日志）
2. 在区分假设的边界打 targeted log
3. 禁止"全打日志再 grep"

日志打标签：`[DEBUG-a4f2]`，清理时一个 grep 删干净。

性能分支：日志通常没用。先建基线测量（timing harness / profiler / query plan），再 bisect。先量后修。

## Phase 5: 修 + 回归测试

先写回归测试，**但只在有正确 seam 时**。正确 seam = 测试穿过真实 bug 触发的调用链。seam 太浅（单调用方测试但 bug 需要多调用方）会给虚假信心。

**没有正确 seam 本身就是发现**——代码结构阻止 bug 被锁定，标记给 arch-deepen。

有正确 seam：
1. 把最小 repro 变成失败测试
2. 看它失败（证明 red 是真的）
3. 修
4. 看它过
5. 重跑 Phase 1 原始 loop（非最小化场景）确认

## Phase 6: 清理

- [ ] 原始 repro 不再复现（重跑 Phase 1 loop）
- [ ] 回归测试过（或无 seam 已记录）
- [ ] 所有 `[DEBUG-*]` 日志删干净（grep 标签）
- [ ] throwaway harness 删除或移到 debug 目录
- [ ] commit message 写清哪个假设是对的，让下一个 debug 的人学到

## 纪律

- 所有命令/输出/捕获物先脱敏：密钥写 `<REDACTED>`，对 env 变量建 loop 而不是把凭证贴出来。
- 不命中具体领域前不调 01-05；定位后（慢 SQL / OOM / CPU / AI 超时 / RAG 不相关）再走对应技能。
- 修完走 retro（main-dev 族）：这次什么环境问题导致 debug 难？该加什么自动化检查？

## 检查清单

- [ ] Phase 1 有一条已跑过的 red-capable 命令（秒级、确定、无人值守）
- [ ] Phase 2 repro 已 minimize 到每个元素 load-bearing
- [ ] Phase 3 有 3-5 个可证伪假设，已排序给用户看
- [ ] Phase 4 一次一个变量，日志打标签
- [ ] Phase 5 回归测试在正确 seam（无 seam 已记录给 arch-deepen）
- [ ] Phase 6 DEBUG 标签全删，commit 写清真假设
