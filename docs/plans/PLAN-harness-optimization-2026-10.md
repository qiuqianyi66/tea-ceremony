---
last_updated: 2026-10-08
status: draft
owner: yanha
---

# PLAN — Harness 优化方案（国内外合流，2026-10）

> 定位：`PLAN-session-memory-fixes-2026-10.md`（T1-T4 执行单）与 `PLAN-harness-research-2026-10.md`（工程单）之上的**统一优化方案**。合并去重 G1-G24（audit 2026-10-08）与 D1-D15（domestic 2026-10-08），紧贴 tea 实际文件定位差距，输出一份待批准的执行蓝图。
> 状态：draft，待用户批准。批准前不修改任何项目文件。
> 写法：plan-control Controlled Track 九段体；结论先行；编号列表。

# Goal

合流国内外 39 项差距（G24 + D15），合并去重为 32 项，按"真实缺口优先"排序，产出可执行任务序。目标状态：拦截时点前移、上下文工程自动化、多 agent 工件契约化、评测可定位可回放；会话记忆（P0-1b）落地。

# Context

**上游材料（全部已存在，只读）**
- `docs/research-harness-audit-2026-10-08.md`：G1-G24（P0×3/P1×9/P2×12）+ 内部漂移 I1-I8 + standards 核验。
- `docs/research-harness-domestic-2026-10.md`：D1-D15（P0×6/P1×5/P2×4）。
- `docs/PLAN-session-memory-fixes-2026-10.md`：T1(G3)/T2(G1)/T3(§6)/T4(P0-1b)，O-1~O-6 待拍板。
- `docs/PLAN-harness-research-2026-10.md`：工程单。已落地 P1-0(ArchUnit)/P1-1(MCP)/P1-3(纠错三要素)/P1-4(verify-harness)/P2-1/P2-2；待执行 P0-1a~P0-3、P1-2/5~10、P2-3~7、P3-1~4。
- `docs/prd/P0-1b-chat-memory-requirements-2026-10-08.md`：F-编号需求 + §8 架构样例。

**关键现状（紧贴文件）**
- AGENTS.md：212 行地图式（§11 `py_compile app/main.py` 路径错=G3；§2 截图验证不可执行=G2；§12 手动地图无自动化=G6）。
- CI：ci.yml L264-281 harness-consistency job 未挂 eval（=G1）；13 job 全量跑（=G8）。
- 后端：V3 表就绪无实体（=P0-1b）；ArchUnit 仅分层+构造器注入（=G12）；新栈无 Actuator（=G14）。
- 多 agent：M5 五专家派发无显式工件（=D4）；三子代理无工具隔离（=G7）。
- 经验链路：patterns.md 空壳（=G11）；lesson 靠人工晋升（=D11）。

# Risk Assessment

```yaml
risk:
  score: 9
  level: HIGH            # 8-12 = HIGH → Controlled Track
  evidence:
    - reason: "Impact=3：跨模块。规则体系、CI、后端服务、评测、文档五面动；P0-1b 是 L2 后端功能（新实体/Repository/Service/Controller + api-contract 登记）"
      affected_area: "AGENTS.md、ci.yml、backend/src/main/java/com/tea/ai/**、docs/prd、docs/plans、scripts/"
      possible_failure: "实体与 V3 DDL 列名不对齐 → ddl-auto: validate 启动失败；ci.yml 语法错 → CI 全红"
    - reason: "Scope=3：跨系统。前端（teaAI.ts 降级链）、后端（Spring Boot 新栈）、CI（GitHub Actions）、harness（规则/技能/经验）"
      affected_area: "src/services/teaAI.ts（承重墙）、backend/**、.github/workflows/ci.yml、.harness/**、.agents/skills/**"
      possible_failure: "触碰 teaAI.ts 降级链三分支 → 网络不可用时静默断服"
    - reason: "Uncertainty=2：P0-1b 表结构/分层风格已核查（低未知）；但 O-1~O-6 六决策待拍板，O-7~O-10 新决策待拍板；截图环境卡点（P3-4 cu 虚拟桌面占用）在用户侧"
      affected_area: "docs/prd/P0-1b 需求文档 §5 决策点、docs/plans 两文件"
      possible_failure: "未拍板即开工 → 返工（如 sessionId 参数位置选错）"
    - reason: "Irreversibility=1：全部可 git 回滚。L3 项（H9 工件契约/H18 ArchUnit 扩展/H27 Actuator）走 ADR + expand-contract；无数据迁移（会话记忆表已建，只加代码）"
      affected_area: "git 历史、backend/src/main/resources/db/migration/V3__agent_memory.sql（不动）"
      possible_failure: "无"
```

# Approach

**合并去重规则**：G 与 D 同主题即合并（如 G20+D12 结果度量、G13+D3 门禁前移）；已规划承接项不重复立项；tea 现状必须落到具体文件路径。

**真实缺口 vs 锦上添花**：真实缺口 = 会痛、有代价（拦截晚、不可验证、上下文溢出、红线不机械）；锦上添花 = 可缓（护栏、度量、备案类）。P0 优先做真实缺口。

```
Phase 0  L0 即时（无依赖，批准即可做）
  H1 py_compile 修复 ─┬─ H5 §6 并入 ── H6 规则治理文档
  H28a 润化 L0 子项 ─┘
Phase 1  用户拍板后并行
  H4 会话记忆（T4，依赖 O-1~O-6）── H2 eval 挂 CI（T2）
  H8 Spec 门禁入模板（影响后续所有 PRD）
Phase 2  门禁/评测加固（Phase 1 后）
  H7 开工门禁 ── H11 技能准入 ── H12 评审闭环 ── H13 LLM mocking ── H16 CI 增量
Phase 3  上下文工程
  H14 repo map ── H10 摘要/压缩
Phase 4  多 agent 结构（P0-1a 五专家注册后）
  H9 工件契约（L3+ADR）── H15 子代理隔离 ── H30 诊断角色
Phase 5  机械硬化（后端重写推进中）
  H18 ArchUnit 扩展（L3）── H24 红线脚本 ── H27 Actuator（L3）── H26 CI 人工批准
Phase 6  度量/巡检/防护
  H21 eval 增强 ── H19 Trace 回归 ── H22 定时巡检 ── H23 结果度量
  H20 Checkpoint ── H25 HANDOFF 分级 ── H29 MCP 命名
依赖用户：H3 截图打通（P3-4 截图环境）；H4（OQ 拍板）
```

**推荐第一步**：Phase 0 三件（H1/H5/H6）当天可完成，验证 L0；随后等用户对 O-1~O-7 拍板再开 Phase 1。

# Tasks

**A. 已规划承接项（5 项，不重复立项）**

| # | 差距（归属） | tea 现状（文件） | 建议动作 | 优先级 | 验证 |
|---|---|---|---|---|---|
| H1 | G3（=T1 已规划） | AGENTS.md §11 `py_compile app/main.py`：backend/app/main.py 不存在（已复核） | 改 `python -m py_compile main.py`（对齐 ci.yml:193） | P0 | L0 |
| H2 | G1（=T2 已规划） | ci.yml:264-281 仅三脚本；scripts/eval-harness.cjs L184 exit 1；docs/agent-eval/ 3 份 | harness-consistency job 加 eval 步；语义写进 §11 | P0 | L2 |
| H3 | G2（=P0-3 已规划） | scripts/screenshot-*.cjs 期望 ~10 张 vs docs/screenshots/ 3 张 | 修产物命名/端口 + 补跑；前置 P3-4 截图环境（用户侧） | P1 | L1 |
| H4 | P0-1b（=T4 已规划） | V3__agent_memory.sql 两表无实体；AiChatService.chat() 无状态 | 按 PRD §8 样例实现 ChatMemoryService 全套 | P0 | L2 |
| H5 | §6 并入（=T3 已规划） | docs/PLAN-harness-research-2026-10.md §6 清单未并入 §2 | 并入方式见 O-1 | P0 | L0 |

**B. 新增 P0（真实缺口优先）**

| # | 差距（标杆依据） | tea 现状（文件） | 建议动作 | 优先级 | 验证 |
|---|---|---|---|---|---|
| H6 | **规则体系治理**（D2 华为三层 [国内] + G9 Cursor 就近 [国外] + D7 Trae 分级 [国内] + G17 Gemini /memory [国外]） | AGENTS.md 212 行单文件；.harness/rules 三规则无三层语义说明；技能/规则无 token 分工红线 | ①.harness/rules 加"Rule=常驻/Skill=按需/Tool=不参与推理"三层语义页（L0）；②AGENTS.md 写"规则=全量常驻、技能=渐进加载"红线（L0）；③低频规则改 description 触发（L0）；④verify-harness 加"渲染当前生效规则全集"自检（L0） | P0 | L0 |
| H7 | **门禁前移**（D3 华为 Hooks 确定性 [国内] + G23a Gemini hook 指纹 [国外]） | verify/audit 提交前手动跑；rules/skills 文件改动无检测 | 会话开工自动跑 verify-harness+audit-redlines 红则阻断；verify-harness 加 rules/skills git diff 检测 | P0 | L2 |
| H8 | **小 Spec 门禁**（D1 海信 300 行 60% vs 70 行 95% [国内]） | docs/prd/_template/requirements-template.md 五段式无行数/可测性门禁 | 模板补三硬门禁：单切片 ≤100 行；每条 F-编号映射 ≥1 测试；>10 轮返工回需求阶段 | P0 | L1 |
| H9 | **阶段工件契约**（D4 MetaGPT SOP，SoftwareDev 3.75 [国内]） | ai/agent/AgentOrchestrator.java + AiChatService.java 五专家派发无显式工件 | 专家间定义显式中间工件（需求/设计/评审结论），下家只读工件；L3 需 ADR | P0 | L3 |
| H10 | **上下文传递治理**（D5 XAgent 只传摘要 [国内] + G18 OpenHands Condenser [国外]） | 子代理间无摘要约定；AGENTS.md §2"上下文稀缺"靠自觉 | 子代理间只传结论摘要+文件指针；compact-context.cjs 每 N 轮压缩旧对话 | P0 | L2 |
| H11 | **技能元数据门禁**（D6 华为准入自动化 [国内] + G10 Cursor 触发描述 [国外]） | .agents/skills/README 66 技能；verify-harness 11 类检查无技能验证命令检查 | SKILL.md 必须含可执行验证命令（不可执行不计入技能数）；frontmatter 补"何时触发"描述 | P0 | L2 |

**C. 新增 P1（真实缺口为主）**

| # | 差距（标杆依据） | tea 现状（文件） | 建议动作 | 优先级 | 验证 |
|---|---|---|---|---|---|
| H12 | 评审-修复闭环（G4 ADK LoopAgent+Cursor stop hook [国外]） | expert-reviewer/caveman-review 单次触发 | 闭环 ≤3 轮：quality 失败自动续修；评审不过回写三要素修复建议，第 4 轮才停 | P1 | L2 |
| H13 | LLM mocking（G5 OpenHands 附录 E [国外]） | eval-harness 全量跑成本高未挂 CI | 录真实 LLM 响应为 fixture，改 prompt/技能后回放，秒级门禁 | P1 | L2 |
| H14 | repo map（G6 Aider tree-sitter [国外]） | AGENTS.md §12 手动地图 212 行 | gen-repomap.cjs：符号依赖图 + 按任务裁剪（默认 1k token） | P1 | L2 |
| H15 | subagent 隔离（G7 Gemini 白名单+递归保护 [国外]） | 三子代理无工具级隔离；主会话全包 | 审查类子代理强制只读工具集；写死"子代理不得再派生子代理" | P1 | L2 |
| H16 | CI 增量测试（G8 Anthropic TIA [国外]） | ci.yml 13 job 全量跑；npm run quality 全量 | vitest related 按变更映射先跑受影响测试，全量兜底；CI 加"job 进==出"看门打印 | P1 | L2 |
| H17 | 经验链路激活（G11 内部 + D11 华为反思/muAgent KG [国内]） | docs/plans/patterns.md L21"暂无条目"；约 20 条 lesson 无出口 | 批量迁移已跨切片复现 lesson→pattern；review 后脚本自动收根因行到 _pending-lessons.md，人工确认晋升 | P1 | L0/L1 |
| H18 | ArchUnit 扩展（G12 内部审计） | LayerDependencyTest.java L25-65 仅分层+构造器注入 | 补 Service 写方法 @Transactional(rollbackFor) 断言、Controller 返回 ApiResponse<T> 断言；L3 需 ADR | P1 | L3 |
| H19 | Trace→回归用例（D8 百炼 Evolution [国内]） | eval-harness 七维已有；踩坑只写 lesson | 每次线上踩坑除 lesson 外同步产可重跑评测样本进 docs/agent-eval/ | P1 | L1 |
| H20 | Checkpoint 快照（D10 华为编辑前快照 [国内]） | 无批量改前快照，回退靠 git 人工 | AI 批量改文件前自动 `git stash create` | P1 | L2 |
| H21 | eval 报告增强（G15 plugin eval + D9 trae-agent 轨迹 + G19 Pass rate [国外+国内]） | eval-harness.cjs 输出七维分数表 | 存历史基线自动 diff 退步；输出加工具调用轨迹摘要；报告加 Pass rate 1/2 两列 | P1 | L1 |
| H22 | 定时巡检（G13 OpenAI doc-gardening + Claude Routines [国外]） | verify/audit 仅 CI 手动触发 | 定时跑 verify+audit-wiki-drift+docs 漂移扫描产修复草案（先只读报告两周再开自动 PR） | P1 | L1 |

**D. 新增 P2（锦上添花/备案为主）**

| # | 差距（标杆依据） | tea 现状（文件） | 建议动作 | 优先级 | 验证 |
|---|---|---|---|---|---|
| H23 | 结果度量（G20 Devin 89% 曲线 [国外] + D12 国内三指标 [国内]） | git 无 AI/人工提交标记 | 从今起约定 AI 提交 body 带标记，季度统计 AI 占比（历史不可得，见 O-10） | P2 | L0/L1 |
| H24 | 红线脚本化（G21 Devin 权限三级 [国外]） | AGENTS.md §10 禁 force-push main 等仅提示词级 | 禁高危命令升级为脚本前置检查（audit-redlines 扩展） | P2 | L1 |
| H25 | HANDOFF 分级（G22 LangGraph checkpoint [国外]） | HANDOFF 文档手动写 | 按 L0-L3 分级（L3 强制写、L0 不写）；session 结束自动 checkpoint 关键决策到 memory/ | P2 | L0 |
| H26 | CI 人工批准双轨（G23b Copilot [国外]） | ci.yml 无 AI-PR 人工批准门 | AI agent 提交的 PR，E2E/部署类 job 需人工 approve 才跑（单人项目收益低，备案） | P2 | L2 |
| H27 | 可观测性（G14 Anthropic TIA 归因修正 [国外]） | backend 新栈 application.yml 无 Actuator/结构化日志 | Spring Boot 新栈 Actuator + JSON 日志 + request_id 贯穿 /api/ai/* 代理调用；L3 需 ADR | P2 | L3 |
| H28 | 润化包（G24 九小项 [内部+国外]） | e2e/pwa-update.spec.ts:39/:74 例外未说明；package.json:22 quality 不含三件套；smoke.mjs IPv6 坑；scripts/ 40+ 仅登记 13；wiki-drift 一期 | ①§13 补 E2E 例外 ②quality:full 串三件套 ③smoke 默认 localhost ④scripts 分类 README+归档+登记 ⑤verify-harness 路径扩 .harness/rules/ ⑥README 补 caveman-review ⑦wiki-drift 二期参数/响应契约 ⑧Debug 插桩清理 ⑨AI onboard 产 HANDOFF 草稿 prompt | P2 | L0-L2 |
| H29 | MCP 白名单命名（D13 CodeBuddy mcp__server__tool [国内]） | 编码规范无 MCP 工具章节 | 未来接 MCP 直接采用该命名，写进编码规范（当前备案） | P2 | L1 |
| H30 | 诊断角色（D14 Seed for Seed 四角色 [国内]） | 三子代理（reviewer/verifier/auditor）偏评审 | 补根因诊断子代理角色，承接"两次修正失败就停下总结" | P2 | L2 |
| H31 | Java 切片（D15 Multi-SWE-bench [国内]） | eval 切片偏前端 TS | Spring Boot 重写推进后补 Java/JPA 切片用例 | P2 | L2 |
| H32 | Verifier 自身 QA（G16 Devin 假阴/假阳审计 [国外]） | eval-harness.cjs 无拦截有效性自检 | 故意写坏代码看是否真拦（假阴）、写好代码看是否误拦（假阳），抽样进评测报告 | P2 | L2 |

# Trade-offs

| 取舍 | 选项 | 选择 | 理由 |
|---|---|---|---|
| 执行批次 | 全做 vs 分批 | 分批：Phase 0 → 拍板 → Phase 1 | P2 锦上添花 10 项可缓；P0 真实缺口优先 |
| eval 挂 CI 路径 | H2 硬编码切片 vs H13 mock 后挂 | 先 H2 挂 CI 再 H13 降成本 | 门禁先行，成本优化随后 |
| repo map | 自动化（Aider）vs 维持手动 | H14 自动化 + 保留 AGENTS.md 摘要 | 符号图兜底，地图仍作入口 |
| H6 打包 | 拆 4 项 vs 打包 1 项 | 打包（子动作分级） | 同一主题，避免碎片立项 |
| H26 CI 人工批准 | 做 vs 备案 | 备案（P2） | 单人项目，AI 自验已足够；Copilot 是多人协作场景 |
| H23 度量 | 历史+未来 vs 仅未来 | 仅未来（带标记） | 历史 git 无标记不可追溯（O-10 拍板） |

# Rollback Strategy

- H1/H5/H6/H8/H17/H25/H28 等文档级改动：git revert 单 commit 即回滚，无运行影响。
- H2/H7/H16/H26（ci.yml）：revert ci.yml；H2 附带的 §11 文案同步 revert。
- H4（P0-1b）：新代码不碰 V3 迁移与承重墙（teaAI.ts 降级链零改动），删除新增类即可回退；api-contract 登记行同步撤。
- H9/H18/H27（L3）：先 ADR，expand-contract（新旧并存、CI 保持绿）→ 按包迁移 → contract；回滚走 ADR 记录的旧路径。
- H10/H14（上下文工程）：脚本/约定类，不影响源码运行，停用即回滚。
- 全部改动在 feature 分支，merge 前过 `npm run quality` + 后端 mvn test + verify-harness。

# Open Questions

**继承（PLAN-session-memory-fixes O-1~O-6，原样列出，待拍板）**
- **O-1**：H5 §6 并入方式——新增独立节（建议，既有表不动）vs 合并进既有 P0/P1 表？
- **O-2**：H4 sessionId 放 AiChatRequest 可空字段（建议，前端零改动）vs 独立参数？
- **O-3**：H4 DELETE 会话端点是否本次范围（建议含，CASCADE 现成）？
- **O-4**：H4 历史锚定条数上限（建议 20，tokens 列无 AI key 时 null 不可依赖）？
- **O-5**：H2 CI 上 eval 切片选取——扫描 .harness/changes/ 最新 vs 硬编码指定？
- **O-6**：H4 会话 topic 缺省 = 首条 user 消息前 20 字（建议）vs 空？

**新增（本次合流产生）**
- **O-7**：本 PLAN 批准范围——只批 H1/H2/H4/H5（承接 session-memory 的 T1-T4），还是连新增 P0 六项（H6-H11）一起批？（建议：先批既有 4 项 + H6/H8 两项 L0/L1 低风险，H7/H9/H10/H11 进下一批）
- **O-8**：H3 截图打通依赖 P3-4 截图环境（cu 虚拟桌面占用，用户侧）——是否现在处理占用？
- **O-9**：H9 阶段工件契约（L3 需 ADR）与 P0-1a 五专家注册的时序——同期启动 vs 五专家稳定后（建议后者，H9 依赖 P0-1a 形态稳定）？
- **O-10**：H23 结果度量——接受"从今起 AI 提交 body 带 `AI-generated: true` 标记、历史数据不可得"的近似方案（建议接受）vs 放弃该度量？

# Not Doing

- **TIA 服务本身**（Anthropic）：单人仓库过度工程，只搬增量选择层（H16）。
- **AAIF 新标准适配**：已合规（audit §2 核验），无新动作。
- **OpenAI Agents API 迁移**：托管运行时与本项目无关。
- **Devin 权限机械层完整版**：个人项目，只做红线脚本化（H24）。
- **Architect/Editor 两模型分工**：成本收益不明确（Aider 模式，观察）。
- **LangGraph/MetaGPT/ChatDev 框架引入**：现有 M5 + harness 已覆盖其价值；只迁移模式（H9/H10）不引入本体。
- **国内闭源 IDE/平台迁移**（Trae/Qoder/百炼/CodeArts）：无订阅价值，自建 harness 更贴近。
- **CAMEL 深入对标**：已停滞（最后 push 2025-06）。
- **经验三级进化改为自动晋升**：保留"晋升需人工确认"（防错误经验扩散，AGENTS.md §13）。
