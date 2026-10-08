---
last_updated: 2026-10-08
status: draft
owner: yanha
---

# PLAN — Harness 优化方案 v2（适配性裁剪后，2026-10）

> 定位：对 v1（`PLAN-harness-optimization-2026-10.md`，32 项 H1-H32）做逐项适配性甄别后的精简版。原则：**不一定别的东西就是好的**；大团队/大厂设计对单人项目不适配即砍或降。v1 保留原样，本文件为待批准版。
> 状态：draft，待用户批准。批准前不修改任何项目文件。
> 写法：plan-control Controlled Track 精简九段体；结论先行。

# Goal

把 32 项差距裁剪为 23 项可执行清单（保留 13 / 降级 10 / 砍 9），按 Phase 排序。砍掉大团队范式（MetaGPT 流水线、CI 人工批准、Verifier 假阴假阳）、已等效项（git 快照、子代理隔离、红线审计）、环境不可行项（豆包无 hook、compact 脚本）。

# Context

**甄别基准（6 维，每项全过）**：①规模匹配（单人项目/自建 harness，大而全砍）②成本收益（不痛砍、痛但边际降）③既有能力重复（重复合并或砍）④环境可行（豆包运行时/Windows PowerShell 5.1/无 Bash）⑤时序（依赖 P0-2 AI key/后端重写/截图环境者延后）⑥伪需求（四维甄别，"团队自己会不会用"硬门槛）。

**关键事实核实（2026-10-08，非凭印象）**
- 每周环境审查：**有自动化 cron**（豆包定时任务 cron_job_id 13364196800514，标题"每周环境审查"，表达式 `30 10 * * 1`，Asia/Singapore，2026-10-07 创建，已查证）；其 query 按 `docs/plans/environment-review.md` L7 人工清单执行。H22 复用该 cron 追加步骤，不新建。
- audit-redlines.cjs 已机械化：R2（吞异常）/R7a（ddl-auto）/R7b（迁移成对）/R8（Executors）/R9a,b（密钥）/R10（前端直连 AI）/R11a,b（Options API+any）/R12（数据流反向）共 8 类；R1 由 ArchUnit、R3/5/6/13/15 由 CI/人工覆盖。git 危险操作（force-push）不在其内。
- 技能构成：`.agents/skills` 66 个**全部项目自建**（Three.js 18 + Vue/TS/CSS/HTML 等 48），非"豆包预装"；`.harness/skills` 32 个分三族。绝大多数为知识/流程类，无"执行"概念。
- eval-harness.cjs：七维过程评测（含代码正确性维，未传 --verify 记 0 分），总分<60 退出码 1；当前不依赖 AI key（P0-2 未启用）。
- tea 多 agent 形态：M5 五专家 = **单请求单专家路由**（AiChatService 按 AgentType 派发），非多角色接力流水线。此事实决定 H9 判砍。

# Approach（甄别结论 + 最终清单）

## 甄别结论表（32 项逐项）

| H# | 原优先级 | 甄别结论 | 6 维摘要 | 最终验证 |
|---|---|---|---|---|
| H1 | P0 | **保留** | 真实 bug（backend/app/main.py 不存在，已复核）；L0 即时 | L0 |
| H2 | P0 | **保留** | 真实结构缺口（eval 未挂 CI）；A 组已规划 | L2 |
| H3 | P1 | **保留（依赖用户）** | 真实缺口（截图产物 7/10 缺失）；依赖 P3-4 截图环境 | L1 |
| H4 | P0 | **保留** | 用户点名产品功能；O-1~O-6 拍板后执行 | L2 |
| H5 | P0 | **保留** | 文档动作，并入方式 O-1 | L0 |
| H6 | P0 | **降级 P1 + 缩小** | 护栏型不痛；D7 分级触发/G9 就近分片是 IDE 机制豆包不适用（砍）；G17 渲染价值弱（砍）；只留三层语义说明+token 分工红线两项文档 | L0 |
| H7 | P0 | **降级 P2 + 缩小** | 自动开工门禁需 hook 事件，豆包运行时无此机制（环境不可行）；缩为"开工自查清单"一行约定；rules/skills diff 检测价值低（砍） | L0 |
| H8 | P0 | **保留 + 缩小** | 会痛（需求过大返工）；"每条 F 映射 ≥1 测试"仅强制 L2/L3 级（缩小），行数上限保留 | L1 |
| H9 | P0 | **砍** | 规模不匹配+伪需求：MetaGPT 是接力流水线，tea 是单请求单专家路由，无"下家"概念；L3 成本（ADR+Schema）无对应收益 | — |
| H10 | P0 | **砍** | 已等效+不可行：豆包系统已"子代理返回压缩结论"；compact-context.cjs 无法操作系统上下文 | — |
| H11 | P1 | **保留 + 缩小** | 会痛（技能不可验证）；98 技能全补不现实且多数为知识类无执行概念；缩为"仅可执行类技能标注验证命令+verify-harness 检查 type 标注" | L2 |
| H12 | P1 | **保留 + 缩小** | 会痛（评审单次不过要人工返工）；缩为闭环 ≤2 轮（第 2 轮不过人工介入，不做第 4 轮） | L2 |
| H13 | P1 | **降级 P2（依赖）** | eval 当前不调 LLM（AI key 未启用），mock 无对象；等 P0-2 后做 | L2 |
| H14 | P1 | **降级 P2** | 规模不匹配（src/ 中小）+ 重复（AGENTS.md §12 手动地图+wiki 四件套可维护）；收益边际 | L2 |
| H15 | P1 | **砍** | 已等效：豆包子代理机制已提供独立上下文/工具隔离；harness 层无法也不需控制 | — |
| H16 | P1 | **降级 P2 + 缩小** | 测试量未到 Anthropic 25 倍场景（规模不匹配）；只留"job 进==出看门打印"（成本极低），增量测试不做 | L2 |
| H17 | P1 | **保留** | 真实缺口（patterns.md 空壳，audit 三大缺口之一）；脚本自动收根因行可行 | L0/L1 |
| H18 | P1 | **保留** | 真实缺口（红线机械化不全）；ArchUnit 基建已就绪，扩展成本可控；L3 需 ADR | L3 |
| H19 | P1 | **降级 P2** | 会痛但转化率低：踩坑多为环境/流程问题难转自动化评测样本；lesson 已记录 | L1 |
| H20 | P2 | **砍** | 已等效：git 分支+commit 即快照（AGENTS.md §10 分支规范），脚本化叠床架屋 | — |
| H21 | P1 | **降级 P2 + 缩小** | eval 是过程评测非结果评测，Pass rate 概念不适用（砍）；轨迹留痕单人审计价值弱（砍）；只留"历史基线自动 diff" | L1 |
| H22 | P1 | **降级 P2 + 缩小（复用）** | 有现成 cron（豆包定时任务 13364196800514 每周一 10:30），在 query 中追加 verify 重跑+eval 报告步骤；不开自动 PR | L1 |
| H23 | P2 | **保留** | 北极星度量不痛但低成本；O-10 待拍板 | L0/L1 |
| H24 | P2 | **砍** | 重复+规模：audit-redlines 已机械化 8 类代码红线；force-push 在单人本地仓库风险低；PowerShell pre-push hook 维护成本>收益 | — |
| H25 | P2 | **保留** | 低成本文档约定；HANDOFF 手动写会痛 | L0 |
| H26 | P2 | **砍** | 伪需求+规模：单人项目 PR 即本人 merge，人工批准无意义（Copilot 是多团队场景） | — |
| H27 | P2 | **保留 + 缩小（依赖）** | 会痛（后端排障无日志）；Actuator 全套过重砍，只留结构化 JSON 日志+request_id；依赖后端重写推进 | L3 |
| H28 | P2 | **保留 + 缩小** | 9 子项去 1：⑨AI onboard 产 HANDOFF 草稿（单人 onboarding 少，砍）；其余 8 项保留（多为真实小漂移） | L0-L2 |
| H29 | P2 | **砍** | 环境不匹配：CodeBuddy 权限命名是 IDE 权限层机制，tea 的 MCP 走 Spring AI 工具注册，无此层 | — |
| H30 | P2 | **砍** | 已等效：expert-reviewer/audit 脚本已覆盖评审/审计；"诊断"角色新增价值边际 | — |
| H31 | P2 | **保留（依赖）** | 有价值但后端重写未就绪；标注依赖，不提前立项 | L2 |
| H32 | P2 | **砍** | 伪需求：eval-harness 是过程评测非安全拦截器，无"故意绕过"场景；假阴/假阳审计为安全门设计 | — |

**统计：保留 13（含缩小 4）/ 降级 10（含缩小 4）/ 砍 9。**

## 最终任务清单（K1-K23，按 Phase）

| K# | 原 H# | 任务 | 优先级 | Phase | 验证 | 备注 |
|---|---|---|---|---|---|---|
| K1 | H1 | py_compile 路径修复（§11） | P0 | 0 | L0 | 当天可做 |
| K2 | H5 | §6 并入 PLAN-harness-research | P0 | 0 | L0 | 方式见 O-1 |
| K3 | H6 | 规则三层语义说明 + token 分工红线（2 项文档） | P1 | 0 | L0 | 去就近分片/分级触发/渲染 |
| K4 | H4 | 会话记忆 ChatMemoryService | P0 | 1 | L2 | 依赖 O-1~O-6 |
| K5 | H2 | eval 挂 CI + §11 语义 | P0 | 1 | L2 | 切片选取见 O-5 |
| K6 | H8 | Spec 门禁入 PRD 模板（映射测试仅 L2/L3） | P0 | 1 | L1 | 影响后续所有 PRD |
| K7 | H11 | 技能准入：可执行类技能标注验证命令 | P1 | 2 | L2 | 先定 type 分类 |
| K8 | H12 | 评审-修复闭环 ≤2 轮 | P1 | 2 | L2 | 第 2 轮不过人工介入 |
| K9 | H17 | 经验链路：lesson→pattern 迁移 + 自动收根因行 | P1 | 2 | L0/L1 | 人工确认晋升保留 |
| K10 | H18 | ArchUnit 扩展（@Transactional/ApiResponse 断言） | P1 | 2 | L3 | 需 ADR |
| K11 | H7 | 开工自查清单（AGENTS.md §4 一行约定） | P2 | 2 | L0 | 不做自动 hook |
| K12 | H16 | CI "job 进==出"看门打印 | P2 | 2 | L2 | 不做增量测试 |
| K13 | H14 | gen-repomap.cjs（tree-sitter） | P2 | 3 | L2 | 手动地图可维护期延后 |
| K14 | H13 | LLM mocking 确定性测试 | P2 | 3 | L2 | **依赖 P0-2 AI key** |
| K15 | H27 | 结构化 JSON 日志 + request_id（后端） | P2 | 5 | L3 | **依赖后端重写**；Actuator 不做 |
| K16 | H31 | eval 补 Java/JPA 切片 | P2 | 5 | L2 | **依赖后端重写** |
| K17 | H19 | Trace→回归样本约定（并入 lesson 规则） | P2 | 6 | L1 | 踩坑时产可重跑样本 |
| K18 | H21 | eval 历史基线自动 diff | P2 | 6 | L1 | 不做 pass rate/轨迹 |
| K19 | H22 | 现有每周 cron（13364196800514）query 追加 verify 重跑+eval 报告步骤 | P2 | 6 | L1 | 复用现有 cron 不新建；人工确认产物 |
| K20 | H23 | 结果度量（AI 提交占比，从今起带标记） | P2 | 6 | L0/L1 | O-10 拍板 |
| K21 | H25 | HANDOFF 分级（L3 强制写/L0 不写） | P2 | 6 | L0 | 文档约定 |
| K22 | H28 | 润化包 8 子项（①-⑧） | P2 | 6 | L0-L2 | ⑨已砍 |
| K23 | H3 | 截图打通 | P1 | 依赖用户 | L1 | 前置 P3-4 截图环境 |

```
Phase 0（L0 即时）    Phase 1（拍板后）        Phase 2（门禁/经验）
K1 py_compile ──┐    K4 会话记忆（OQ）        K7 技能准入 ── K8 评审闭环
K2 §6 并入 ─────┤    K5 eval 挂 CI ──────→   K9 经验链路 ── K10 ArchUnit
K3 规则治理 ────┘    K6 Spec 门禁（进模板）    K11 开工清单 ── K12 看门
Phase 3（上下文）      Phase 5（后端推进）       Phase 6（度量/卫生）
K13 repo map ──┐     K15 日志+request_id       K17 Trace ── K18 基线
K14 LLM mock ──┘     K16 Java 切片             K19 每周 cron ── K20 度量
                                              K21 HANDOFF ── K22 润化
依赖用户：K23（截图环境）、K4（OQ 拍板）、K14（AI key）、K15/K16（后端重写）
```

**推荐第一步**：Phase 0 三件（K1/K2/K3）当天完成；随后等 O-1~O-7 拍板开 Phase 1。

# Trade-offs

| 取舍 | 选项 | 选择 | 理由 |
|---|---|---|---|
| 自动化 vs 约定 | 开工自动门禁（华为 Hooks）vs 自查清单 | K11 自查清单 | 豆包运行时无 hook 事件，自动不可行 |
| 流水线 vs 路由 | MetaGPT 工件流水线 vs 维持单专家路由 | 砍 H9 | tea 无"下家"接力场景，L3 成本无收益 |
| 度量 | 历史+未来 vs 仅未来 | K20 仅未来（带标记） | git 历史无标记不可追溯（O-10） |
| 技能验证 | 98 全验证 vs 仅可执行类 | K7 仅可执行类 | 多数为知识/流程类，无可执行命令 |
| 定时自动化 | 新建 cron vs 复用现有 cron | K19 复用现有 cron（13364196800514）追加步骤 | 有现成 cron，无需新建；自动 PR 风险高故不开 |
| CI 优化 | 增量测试 vs 只加看门 | K12 只加看门 | 测试量未到瓶颈，增量是过度工程 |

# Rollback Strategy

- K1/K2/K3/K6/K9/K11/K17/K19/K20/K21/K22（文档/约定级）：git revert 单 commit。
- K5/K12（ci.yml）：revert ci.yml + 同步 §11 文案。
- K4（会话记忆）：新代码不动 V3 迁移与 teaAI.ts 承重墙，删新增类即回退。
- K10/K15/K16（L3）：先 ADR，expand-contract（新旧并存、CI 绿）→ 按包迁移 → contract。
- K13/K14（上下文/测试工程）：独立脚本，停用即回滚，不碰源码。
- 全部 feature 分支，merge 前过 `npm run quality` + mvn test + verify-harness。

# Open Questions

**继承（原 O-1~O-10，待拍板）**
- **O-1**：K2 §6 并入方式——新增独立节（建议）vs 合并进既有表？
- **O-2**：K4 sessionId 放 AiChatRequest 可空字段（建议）vs 独立参数？
- **O-3**：K4 DELETE 会话端点是否本次范围（建议含）？
- **O-4**：K4 历史锚定条数上限（建议 20）？
- **O-5**：K5 CI 上 eval 切片选取——扫描最新 vs 硬编码？
- **O-6**：K4 会话 topic 缺省（建议前 20 字）vs 空？
- **O-7**：批准范围——建议改为：先批 Phase 0（K1-K3）+ Phase 1（K4-K6），Phase 2 起的 K7-K22 分批批准。原 v1 建议"既有 4 项+H6/H8"已被裁剪替代。
- **O-8**：K23 截图环境（cu 虚拟桌面占用）是否现在处理？
- **O-9**：~~H9 工件契约时序~~（H9 已砍，O-9 失效）。
- **O-10**：K20 结果度量接受"从今起 AI 提交带标记、历史不可得"（建议接受）vs 放弃？

**新增（本轮甄别产生）**
- **O-11**：K7 技能 type 分类——由谁定"可执行类"边界（建议：frontmatter 加 `type: executable|knowledge|flow` 三值，由维护者标注）？
- **O-12**：K22 润化包 8 子项是否全部纳入本次批准，还是只做 ①②③（真实小 bug）其余 ④-⑧ 进下批？

# Not Doing

**本轮裁剪砍掉的 9 项（v1 H9/H10/H15/H20/H24/H26/H29/H30/H32）**
- H9 阶段工件契约：tea 单请求单专家路由，无接力场景（规模不匹配+伪需求）。
- H10 compact-context.cjs：豆包系统管理上下文，脚本不可行；摘要传递系统已等效。
- H15 subagent 工具隔离：豆包子代理机制已提供独立上下文/工具，harness 层无需控制。
- H20 Checkpoint 快照：git 分支+commit 已等效，叠床架屋。
- H24 红线脚本化：audit-redlines 已机械化 8 类代码红线；force-push 单人本地仓库风险低，pre-push hook 维护成本>收益。
- H26 CI 人工批准双轨：单人项目 PR 即本人 merge，人工批准无意义（Copilot 多团队场景）。
- H29 MCP 白名单命名：CodeBuddy IDE 权限层机制，tea MCP 走 Spring AI 工具注册，机制不适用。
- H30 诊断角色：expert-reviewer/audit 脚本已等效。
- H32 Verifier 假阴/假阳：eval 是过程评测非安全拦截器，无绕过场景。

**缩小砍掉的子项**：H6 就近分片/分级触发/渲染；H7 自动 hook/rules diff 检测；H16 增量测试；H21 pass rate/轨迹；H27 Actuator 全套；H28 ⑨ AI onboard HANDOFF 草稿。

**v1 既有 Not Doing（保留）**：TIA 服务本身；AAIF 新标准适配（已合规）；OpenAI Agents API 迁移；Devin 权限机械层完整版；Architect/Editor 两模型分工；LangGraph/MetaGPT/ChatDev 框架引入；国内闭源 IDE/平台迁移；CAMEL 深入对标；经验进化自动晋升（保留人工确认）。
