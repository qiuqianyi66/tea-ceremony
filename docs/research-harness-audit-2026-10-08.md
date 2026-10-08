---
last_updated: 2026-10-08
status: active
owner: yanha
---

# Harness 全面体检：外部标杆增量 + 内部流程审计（2026-10-08）

> 任务：对一盏茶 AI 协作 harness 做全面体检。内部审计对照 AGENTS.md §4/§5/§9/§11 与实际脚本、文档核对同步性；外部调研扩展 OpenAI/Anthropic 更新核验 + Google/Devin/Cursor/Copilot + 开源（OpenHands/Aider/LangGraph），并核验 standards 篇三大缺口结论。
> 方法：6 个并行只读子代理执行；P0/P1 级核心结论独立抽查复核（已复核 3 条全部属实）。发现漂移只记录不修改。
> 底座：本文在 6 篇 `docs/research-*.md` 之上增量，不重复已有原理。

## 1. 结论先行

1. **治理数字门禁真实有效**。ADR-001~013 连续无跳号、CI 13 job 与 §9 逐项对应、技能 .agents 66 + .harness 32（8+19+5）、wiki 四件套、verify-harness/audit-redlines/audit-wiki-drift 三脚本 exit 1 语义真实且挂 CI（ci.yml:264-281）。已抽查复核。
2. **三大真实结构缺口**（需立项）：① eval-harness 未挂 CI，"每切片必跑"实为约定非门禁；② 截图验证闭环不可执行（screenshot 脚本期望 ~10 张产物，docs/screenshots/ 仅 3 张命名匹配）；③ 经验三级进化空转（patterns.md 无条目，lesson 堆积无出口）。
3. **standards 篇三大缺口核验**：全部仍成立。两处勘误："可观测性连 Agent"的直接可执行表述出自 Anthropic TIA 博客而非 OpenAI；32 KiB 截断从二手（CSDN）升级为 OpenAI 官方一手源。
4. **外部标杆 30+ 可迁移模式**。P0 级两条新增量：LLM mocking 确定性测试（OpenHands）、tree-sitter 自动 repo map（Aider）。P1 级共识：评审-修复闭环、subagent 工具隔离、就近规则分片、CI 增量测试细化。
5. **行业共识印证一盏茶方向**。AGENTS.md 地图式、约束机械化、CI 门禁、结构化纠错均为跨厂商事实标准。真实差距集中在两处：拦截时点前移（loop 内 hook）与上下文工程自动化（repo map/Condenser）。

## 2. standards 三大缺口核验（2026-10-08 更新）

| 缺口 | 核验结论 | 依据 |
|---|---|---|
| CI 增量测试 | 仍成立 + 补充：Anthropic TIA 原文直读，CI job 6 个月涨 25 倍、测试量涨 10 倍。官方忠告"v0 按 25 倍负载设计"。一盏茶只搬"受影响测试先跑、全量兜底"增量选择层，不照搬 TIA 服务本身（单人小仓库过度工程） | claude.com/blog/agentic-coding-is-straining-ci-heres-how-we-scaled-test-impact-analysis-at-anthropic（已查证） |
| 熵管理定时 agent | 仍成立 + 新证据：Anthropic 生产自用（TIA 事故期开 Claude Tag 会话常驻监控，listener 滞后超 5 万 job 自动 ping）；Claude Code Routines 已产品化（2026-04 W16，按日程/GitHub 事件触发） | openai.com/index/harness-engineering-leveraging-codex（已查证）；code.claude.com/docs/en/whats-new |
| 新栈可观测性连 Agent | 仍成立，**归因修正**：直接可执行表述（"instrument services as Claude's eyes and ears…CI job 进==出"）出自 Anthropic TIA 博客（2026-09-14），非 OpenAI；OpenAI 侧对应"golden principles 入库制" | 同上 TIA 博客（已查证） |
| AGENTS.md 32 KiB 截断 | 从二手升级官方一手：《Unrolling the Codex agent loop》（2026-01-23）确认指令链默认 32 KiB 上限、nearest-wins、更具体指令排更后。一盏茶 AGENTS.md ≈4 KiB 合规 | openai.com/index/unrolling-the-codex-agent-loop（已查证） |
| AAIF agents.md 标准 | 无新动态：官网最新 press release 2026-05-18（190 家成员）；读取工具 30+ 清单无官方更新；一盏茶合规结论不变 | linuxfoundation.org/press/agentic-ai-foundation-adds-43-new-members-as-enterprise-and-government-adoption-of-open-agent-standards-accelerates（已查证） |

## 3. 外部标杆增量

### 3.1 OpenAI Codex + Anthropic 2026

- Codex：周活 300 万+ 开发者（官方披露，一方称）；Agents API 公测（2026-09-10 release notes，已查证）＝"harness 即托管运行时"成官方产品形态；模型专属指令文件随 CLI 打包（如 `gpt-5.2-codex_prompt.md`）。
- Anthropic 2026-09 后新特性：`claude plugin eval`（插件跑测试套件打分、与无插件基线对比，W37，已查证）；Routines（定时云 agent）；Monitor（日志实时反应）；`/goal`（完成条件驱动持续工作）；`claude ultrareview` 直接进 CI。
- 可迁移：测试增量选择（G8）、eval 基线对比制（G15）。

### 3.2 Google（Jules / Gemini CLI / ADK）

- Jules：plan-then-approve 门禁（人批后才动码）；任务配置 setup/validate/test 三元组（VM 内先跑通环境）；失败自动重试一次再升级；beta 期 14 万+ code improvements（官方博客，已查证）。
- Gemini CLI：11 个 hook 生命周期事件，BeforeTool 可 block/rewrite 工具参数、exit code 2 硬阻断；subagent 工具白名单 + **递归保护**（subagent 不能再调子 agent）；`/memory show` 上下文可观测；npm 周下载 11.5 万（npmjs 官方页，已查证）。
- ADK：LoopAgent = refiner→critic→escalate（max_iterations 封顶）；Dynamic workflows 自动 checkpointing（成功节点 resume 自动跳过）；HITL 一等节点；21.7k star、Geotab/Revionics 官方引语（已查证）。
- 可迁移：评审-修复闭环（G4）、subagent 白名单+递归保护（G7）、loop 内 hook 前移（G23）、上下文可观测命令（G17）、plan 门禁产品化（G24）、环境自检（G24）。

### 3.3 Cognition Devin

- AGENTS.md 自动入上下文（16 KiB 硬截断，已查证）；plan 落盘 `~/.devin/plans/plan-<session>.md` 跨 session 恢复；权限三级 Deny/Ask/Allow + glob + 三层 scope；Verifier QA（假阴/假阳审计、隔离评分路径、作弊轨迹 reward=0）；工具调用批处理省 49% tokens（官方博客，已查证）。
- 落地证据：D 轮 $1B+ @ $26B、ARR $492M、自家 89% 代码由 Devin 提交（2025-12 的 13% 月曲线攀升，官方博客，一方称）；SWE-1.7 FrontierCode 1.1 Main 42.3%（官方自有榜单，一方称）；Mercedes 8 个月项目压到 8 天（一方称）。
- 可迁移：plan 强制落盘（G24 升级 HANDOFF）、Verifier 自身 QA（G16）、AI 提交占比度量（G20）。

### 3.4 Cursor / Anysphere

- 规则四档触发（alwaysApply/description/globs/manual，官方文档已查证）；嵌套 AGENTS.md 就近覆盖；stop hook 让 agent 迭代到测试全绿才停；TDD 五步官方流程；规则最佳实践"单条 <500 行、引用文件而非复制、只在重复犯错后加规则"。
- 落地证据：D 轮 $2.3B @ $29.3B、ARR $1B+、财富 500 强半数在用（官方博客，一方称）。
- 可迁移：规则触发描述自判（G10）、嵌套就近 AGENTS.md（G9）、stop hook 长循环（并入 G4）、Debug 插桩清理明文（G24）。

### 3.5 GitHub Copilot coding agent

- 范式：issue → draft PR → 人工 review；agent 跑在 Actions VM；**Actions workflows 默认需人工批准**（AI 自验 + 仓库 CI 人工批准双轨）；AGENTS.md 最近优先 + `.github/instructions/*.instructions.md` 带 applyTo glob（官方文档，已查证）。
- 落地证据：每月贡献 120 万 PR、2000 万+ 开发者（官方博客，一方称）；EY/Carvana 公开背书（已查证）。
- 可迁移：AI 自验 + CI 人工批准双轨（G23）、applyTo glob 分片（并入 G9）、AI onboard 自动产 HANDOFF 草稿（G24）。

### 3.6 开源（OpenHands / Aider / LangGraph）

- OpenHands：**LLM mocking 确定性 integration test**（论文附录 E：mock LLM 录制回放，防 prompt/action 改动引入 bug，秒级门禁，arXiv 2407.16741 已查证）；Condenser 对话压缩一等公民；Workspace 抽象（Local/Docker 切换）；SWE-bench 74.2%（官方 leaderboard API，已查证）；90.2k star。
- Aider：**tree-sitter 符号图 + 图排序 + token 预算（默认 1k）自动生成 repo map**（官方文档已查证）；Pass rate 1/2 双指标评测（leaderboard 官方维护）；Architect/Editor 两模型分工（实验方向）。
- LangGraph：checkpointer（短期 thread）+ store（长期跨 thread）双层记忆；checkpoint 写入模式分级 sync/async/off；Supervisor 模式生产案例 ServiceNow/Lyft/Vodafone/LATAM（官方博客已查证）。
- 可迁移：LLM mocking 测试（G5）、repo map（G6）、Pass rate 双指标（G19）、Condenser（G18）、双层记忆与 HANDOFF 分级（G22）。

## 4. 内部审计发现（漂移清单，P0/P1 已抽查复核）

| # | 漂移 | 证据 | 优先级 |
|---|---|---|---|
| I1 | §11 `py_compile app/main.py` 路径错误：main.py 在 backend/ 根，`backend/app/main.py` 不存在 | AGENTS.md §11；`Test-Path backend/main.py`=True、`backend/app/main.py`=False（已复核） | P0 |
| I2 | eval-harness 未挂 CI："每切片必跑"是约定非门禁 | ci.yml:264-281 harness-consistency job 仅跑 verify-harness/audit-redlines/audit-wiki-drift（已复核）；HANDOFF L70、agent-eval-baseline L76 声称门禁级 | P0 |
| I3 | 截图验证产物 7/10 缺失：4 个 screenshot-*.cjs 期望 ~10 张，docs/screenshots/ 仅 3 张命名匹配；home.jpg 与脚本输出名（home-*.png）不匹配 | scripts/screenshot-home.cjs L34/39/52 期望 home-desktop/home-drawer/home-mobile.png；docs/screenshots/ 实测仅 share/growth-desktop/brew-3d-steeping 匹配（已复核） | P1 |
| I4 | patterns.md 空壳：经验三级进化后两级零落地，约 20 条 lesson 无一晋升 | docs/plans/patterns.md L21"（暂无条目 — 2026-10-07 建立）" | P1 |
| I5 | ArchUnit 只机械分层+构造器注入；@Transactional/参数校验/ApiResponse/禁事务内远程调用未机械化 | backend/src/test/java/com/tea/architecture/LayerDependencyTest.java L25-65；编码规范 §7 | P1 |
| I6 | §13 E2E 相对路径规则 2 处例外未说明 | e2e/pwa-update.spec.ts:39、:74 用 `goto('/')` | P1 |
| I7 | `npm run quality`（lint+type-check+test+build+scan-emoji）不含 harness 三件套，§11 却称"提交前必跑" | package.json:22；开发流程规范 §七要求 quality+verify-harness | P1 |
| I8 | scripts/ 40+ 脚本仅登记约 13，一次性诊断（diag-glare*/inspect-brew-corner/verify-field 等）与 CI 门禁混放 | scripts/ 目录实测 | P1 |

**已核对同步的项（备查）**：ADR-001~013 连续；CI 13 job 与 §9 逐项对应；.agents/skills 66 / .harness/skills 32；wiki 四件套齐全；docs/skills 6 审查页齐全；§12 索引 20 条路径全部存在；biome.json vue override（关闭 useImportType）与 §13 一致；audit-redlines 声称 R2/7/8/9/10/11/12/14 全部兑现（R3/5/6/13/15 无机械化，已知）；verify-harness 11 类检查与注释一致；L1/L2 验证脚本真实存在（vitest run 不含 playwright，playwright 独立 test:e2e）；smoke.mjs 有 IPv6 已知坑（§13 已记，默认值未修）。

## 5. 差距清单（五要素，按优先级）

### P0（3 项）

| # | 标杆依据 | 一盏茶现状 | 建议动作 | 验证 | 类型 |
|---|---|---|---|---|---|
| G1 | 内部审计（无外部标杆） | eval-harness.cjs 阻断逻辑存在（L184 exit 1）但 CI 不触发；docs/agent-eval/ 仅 3 份历史报告 | harness-consistency job 加对最新切片跑 `node scripts/eval-harness.cjs <切片>`；或至少把"未传 --verify 正确性维记 0 分"语义写进 §11 | L2 | 结构缺口 |
| G2 | Anthropic"无法验证就不提交"（standards 已引） | 截图脚本产物 7/10 缺失；依赖 localhost:5174 + 系统 Chrome；AGENTS.md §2"改前改后截图"实际不可执行 | P0-3 前端返工前打通截图（修脚本产物命名与端口、补跑）；视觉批次过设计门禁（P3-4 截图环境前置项） | L1 | 结构缺口 |
| G3 | 内部审计 | AGENTS.md §11 `py_compile app/main.py` 复制即 FileNotFoundError | 改为 `python -m py_compile main.py`（对齐 ci.yml:193 ruff 用 main.py 并列形态） | L0 | 润化点 |

### P1（9 项）

| # | 标杆依据 | 一盏茶现状 | 建议动作 | 验证 | 类型 |
|---|---|---|---|---|---|
| G4 | ADK LoopAgent + Cursor stop hook + Jules 失败重试 | expert-reviewer/caveman-review 单次触发；quality 失败即报告给用户 | 评审-修复闭环 ≤3 轮：quality 失败自动续修；评审不过回写修复建议（问题/根因/修复），第 4 轮才停 | L2 | 结构缺口 |
| G5 | OpenHands LLM mocking（arXiv 2407.16741 附录 E） | eval-harness 全量跑成本高、未挂 CI | 录制真实 LLM 响应为 fixture，改 prompt/技能后回放对比，秒级确定性门禁 | L2 | 结构缺口 |
| G6 | Aider repo map（aider.chat/docs/repomap.html） | AGENTS.md 212 行手动维护地图 | gen-repomap.cjs：tree-sitter 扫 src/ 出符号依赖图 + 按任务相关度裁剪（默认 1k token），替代手动地图 | L2 | 结构缺口 |
| G7 | Gemini CLI subagent 白名单+递归保护 | 三子代理无工具级隔离；主会话全包 | expert-reviewer 等审查类子代理强制只读工具集；写死"子代理不得再派生子代理"防 token 爆炸 | L2 | 结构缺口 |
| G8 | Anthropic TIA（2026-09-14，已核验） | CI 13 job 全量跑；99f265c 曾 perf flaky | vitest related 按变更文件映射受影响测试先跑，全量 `npm run quality` 兜底；CI 加"job 进==出"看门打印 | L2 | 结构缺口（standards P1 细化） |
| G9 | Cursor 嵌套 AGENTS.md + Copilot applyTo glob + Gemini JIT | 单文件 212 行，无就近规则 | src/components/three/、backend/src/main/java/com/tea/ 等放精简局部 AGENTS.md 或 instructions glob 分片，就近约束 3D/后端分层 | L0 | 润化点 |
| G10 | Cursor description 四档 + Devin Trigger Description | 技能路由靠人工读 README 表后跳转 | 66 个 SKILL.md frontmatter 补"何时触发"一行，模型自判加载；frontmatter 合规（name=目录名）移植成 .cjs 挂 CI | L0 | 润化点 |
| G11 | 内部审计 | patterns.md 空壳；lesson 堆积无出口（AGENTS.md 200-350 行压力） | 批量迁移已跨切片复现的 lesson→pattern（npm audit registry、vite preview IPv6、PowerShell here-string）；加"晋升需人工确认"记录载体 | L0 | 结构缺口 |
| G12 | 内部审计 | ArchUnit 仅分层+构造器注入 | 补 Service 写方法 `@Transactional(rollbackFor)` 断言、Controller 返回 `ApiResponse<T>` 断言 | L3 | 结构缺口 |

### P2（12 项，简表）

| # | 标杆依据 | 建议动作 | 验证 |
|---|---|---|---|
| G13 | OpenAI doc-gardening + Claude Routines | 定时 agent：verify-harness + audit-wiki-drift + docs 漂移扫描定期跑，产出修复 PR 草案（先只读报告版跑两周再开自动 PR） | L1 |
| G14 | Anthropic TIA（归因修正后） | Spring Boot 新栈 Actuator + 结构化 JSON 日志 + request_id 贯穿 /api/ai/* 代理调用（须先 ADR） | L3 |
| G15 | Claude plugin eval（W37） | eval-harness 存历史基线，新版本自动 diff 退步维度，不靠人工盯总分 | L1 |
| G16 | Devin Verifier QA | eval-harness 假阴/假阳抽样：故意写坏代码看是否真拦、写好代码看是否误拦 | L2 |
| G17 | Gemini `/memory show` | verify-harness 加"渲染当前生效规则全集"自检输出，人机可核对模型看到什么 | L0 |
| G18 | OpenHands Condenser | compact-context.cjs：每 N 轮自动压缩旧对话为摘要，防上下文溢出（当前靠自觉） | L1 |
| G19 | Aider Pass rate 1/2 | eval 报告加首次通过率/人工干预后通过率两列，量化 AI 自主完成度 | L0 |
| G20 | Devin 89% 曲线 | git 提交 AI 占比周统计脚本，写进 docs/agent-eval/ 周报作成熟度北极星 | L0 |
| G21 | Devin 权限三级 + 已有红线 | 禁 force-push main/禁删 node_modules 等红线从提示词升级为脚本前置检查 | L1 |
| G22 | LangGraph 双层记忆 + checkpoint 分级 | HANDOFF 按 L0-L3 分级（L3 强制写、L0 不写）；session 结束自动 checkpoint 关键决策到 memory/ | L0 |
| G23 | Gemini hook 指纹 + Copilot 双轨制 | verify-harness 加 rules/skills 文件 git diff 检测；AI agent 提交的 PR，E2E/部署类 job 需人工 approve 才跑 | L2 |
| G24 | 内部审计多源 + Jules/Cursor 细节 | 一组低风险润化：§13 补 E2E 例外说明；package.json 加 quality:full 串三件套；smoke.mjs 默认 127.0.0.1→localhost；scripts/ 分类 README + diagnostics 归档 + convert-3d-ktx2 登记；verify-harness 路径检查扩 .harness/rules/；.agents/skills README 补 caveman-review；wiki-drift 二期参数/响应契约；Debug 插桩清理明文；AI onboard 产 HANDOFF 草稿 prompt | L0-L2 混合 |

## 6. 增量建议清单（可直接并入 docs/PLAN-harness-research-2026-10.md）

- **P0 主线新增**：G1 eval 挂 CI（与 P1-4 同族，改 ci.yml harness-consistency job）；G2 截图打通（并入 P0-3，前置 P3-4 截图环境）；G3 路径修复（当天可做，L0）。
- **P1 研究落地新增**：G4 评审闭环（接 P1-3 结构化纠错）；G5 LLM mocking（接 P1-4 文档一致性机械化同族）；G6 repo map（新立项，上下文工程）；G7 subagent 隔离（接 P0-1a 五专家体系）；G8 CI 增量（standards P1 细化，接 P1-4）；G9/G10 就近规则与触发描述（文档级，当天可做）；G11 经验迁移（接 P2-1）；G12 ArchUnit 扩展（接 P1-0，L3 需 ADR）。
- **明确不做的反例（记录）**：TIA 服务本身（单人仓库过度工程）；AAIF 新标准适配（已合规）；OpenAI Agents API 迁移（托管运行时与本项目无关）；Devin 权限机械层（个人项目）；Architect/Editor 两模型分工（成本收益不明确）；LangGraph 框架引入（现有 harness 已覆盖其价值）。

## 7. 边界与诚实声明

- 内部审计全程只读，未运行任何 .cjs/mvn/npm/GUI 命令；截图结论基于产物命名比对而非实际运行（"从未成功截图"的直接因果未验证，卡点推测为端口/浏览器依赖，标注不确定）。
- 外部标杆中融资额/ARR/客户指标均为公司一方披露，标注"一方称"；官方工程细节标注"已查证"（直读原文）。
- Jules 的 AGENTS.md 支持未命中官方专页（一方称，建议读产品内页确认）；Gemini CLI star 数未直读仓库页（一方称，npm 下载数已查证）。
- 未修改任何项目文件；standards 篇两处勘误以本文 §2 为准，未回写原文件。
