---
last_updated: 2026-10-08
status: active
owner: yanha
---

# 国内知名落地成功的 Harness/Agent 工程实践 × 国外标杆横向对比（2026-10-08）

> 验证目标：补齐国内（中国大陆）有知名度且落地成功的 harness/agent 工程实践，与已调研国外标杆同轴对比。
> 选样：12 个国内标杆。厂商：字节 Trae/MarsCode/Seed、阿里 Qoder（通义灵码）/百炼、腾讯 CodeBuddy、百度 Comate、华为 CodeArts 码道、蚂蚁 CodeFuse、智谱 CodeGeeX；开源多 agent：MetaGPT、ChatDev、XAgent、CAMEL。
> 标注：**已查证** = 官方一手源实际访问；**一方称** = 企业自述指标。关键数字独立复核：MetaGPT star=70,758（GitHub API 实测 2026-10-08）、Trae SWE-bench Verified 75.20% 登顶（arXiv:2507.23370 摘要原文）、海信小 Spec 95% vs 大 Spec 60%（docs.qoder.com 原文）。
> 底座：本文是 `research-harness-standards-2026-10.md`（国外标杆）的国内补齐，不重复国外原理。

## 1. 结论先行

1. **国内厂商已把 "harness" 从概念做成产品机制**：阿里开源 Better Harness 体检工具、腾讯财报把 WorkBuddy 领先归因于"harness（智能体调度）工程能力 + 技能库"、华为给出 Rule/Skill/MCP 三层官方定义。一盏茶方向被国内产业界独立验证。
2. **AGENTS.md 已成国内事实标准**：华为码道 2026-04-25 起兼容 AGENTS.md、Trae 原生导入并称"跨工具通用规范"、Qoder 默认 `context.fileName=AGENTS.md`。一盏茶 212 行地图式路线无需调整。
3. **国内外同构度高于差异度**：八维对比下，规则-技能-工具三层分工、门禁机械化、多 agent 编排、MCP 协议、上下文工程五大维度国内外同构；差异集中在三处——国内有"小 Spec 量化门禁"与"确定性 Hooks"硬实践、国外有"企业级落地数据披露"更透明。
4. **国内独有增量 6 条 P0**：小 Spec 门禁（海信硬数据）、规则/技能/工具三层命名与 token 分工红线（华为+Trae）、确定性 Hooks 开工门禁（华为）、阶段间工件契约（MetaGPT）、只传摘要不传全历史（XAgent）、Skill 上架准入自动化测试（华为）。
5. **一盏茶已领先处**：eval-harness 七维"规则/技能本身的评测"国内国外均无公开基准，一盏茶反而走在前面；CI 13 job 门禁密度高于国内厂商公开披露。

## 2. 调研对象与证据概要

| 标杆 | 官方一手证据（URL） | 知名度/落地证据 |
|---|---|---|
| Trae（字节） | docs.trae.ai/ide/rules、docs.trae.cn/ide_skills、github.com/bytedance/trae-agent | SWE-bench Verified 75.20% 登顶（arXiv:2507.23370 已查证）；star 12.1k（已查证）；内部 92% 工程师（一方称） |
| MarsCode（字节，已并入 Trae） | arxiv.org/abs/2409.00899 | 修 bug 五步流水线论文；SWE-bench Lite 39.33%（一方称） |
| 豆包/Seed | seed.bytedance.com 官方博客（Seed2.1 发布） | Multi-SWE-bench 8 语言开源；"Seed for Seed"多智能体研发闭环（已查证） |
| Qoder/通义灵码（阿里） | docs.qoder.com/qoder/better-harness、docs.qoder.com/customer-cases/qoder-case-hisense | 9 个月 500 万+ 用户（一方称）；海信 109 系统案例（已查证） |
| 百炼（阿里云） | help.aliyun.com/zh/model-studio/agenteval-introduction | 80 万+ 已建智能体、100 万+ 用户（一方称） |
| CodeBuddy（腾讯） | www.codebuddy.ai/docs/cli/sub-agents、agent-teams | 内部 90%+ 工程师使用、50%+ 代码 AI 生成（一方称）；2026Q2 财报点名 harness 能力（已查证） |
| Comate（百度） | comate.baidu.com + 官方 Harness 三层模型文章（2026-05-22） | 110 万企业用户、内部采纳率 46%（一方称）；IDC 9 维 8 满分 |
| CodeArts 码道（华为） | support.huaweicloud.com/usermanual-codeartssnap/codeartsdoer_ug_0019.html | 邮储银行 4000+ 研发人员、采纳率 >30%（一方称）；Gartner 远见者 |
| CodeFuse（蚂蚁） | github.com/codefuse-ai 组织 + CodeFuse-muAgent | 蚂蚁内部周活 50%+、采纳率 30%（一方称）；CodeFuseEval 开源 |
| CodeGeeX（智谱） | HF 模型卡 zai-org/codegeex4-all-9b | HumanEval 82.3（已查证）；KDD 2023 论文"数万日活"（一方称） |
| MetaGPT（DeepWisdom） | arxiv.org/html/2308.00352v7、github.com/FoundationAgents/MetaGPT | star 70,758（已复核实测）；SoftwareDev 可执行性 3.75/4 |
| ChatDev（清华） | arxiv 2307.07924、ACL 2024 | star 34.5k（已查证）；<7 分钟 <$1 完成软件（论文） |
| XAgent（OpenBMB） | blog.x-agent.net/blog/xagent/ | star 8.6k（已查证）；双循环+ToolServer 沙箱 |
| CAMEL | arxiv 2303.17760 | star 12.7k（已查证）；NeurIPS 2023，已停滞（最后 push 2025-06） |

## 3. 国内外八维同轴对比

| 维度 | 国外（已调研） | 国内（本次） | 结论 |
|---|---|---|---|
| 工程实践与流程治理 | 计划门禁（Jules/Devin）、评审闭环（Cursor/ADK）、TDD（Cursor） | SDD/Spec 驱动（华为 Qoder Comate）、阶段出口门禁（Qoder）、Hooks 确定性门禁（华为） | **同构**。国内把"门禁"显式做进产品（Hooks 事件、SDD 阶段） |
| 评测体系 | SWE-bench 系 + 企业自评（Anthropic TIA）；Claude plugin eval | Multi-SWE-bench（Seed，多语言）、CodeFuseEval（企业级）、百炼 Evolution（Trace→回归用例） | **同构**。国内多语言/企业级评测更贴近生产；"规则本身的评测"两边均无公开基准 |
| 落地数据 | Anthropic 80% 合并/8x 产出、Devin 89% 自用、Copilot 120 万 PR/月 | 腾讯内部 90%+ 工程师、Comate 110 万企业用户、邮储 4000 人、蚂蚁周活 50%+ | **同构但披露风格不同**。国外更透明（论文/财报）；国内多"一方称"案例稿 |
| 工具链（MCP） | MCP 已是标准（Anthropic/Cursor/Copilot）；OpenAI Agents API | Trae MCP Marketplace、百炼 MCP 托管市场（魔搭 4000+ 服务）、CodeBuddy MCP 市场 + `mcp__server__tool` 权限白名单 | **同构**。国内白名单命名规范值得抄 |
| 多 agent 模式 | Supervisor 路由（LangGraph）、Subagent 隔离（Gemini CLI）、LoopAgent（ADK） | MetaGPT SOP 流水线、XAgent 双循环、Trae SOLO 主控、华为 Agent Team、CodeFuse muAgent EKG、Seed 四角色 | **同构**。国内外都走向"规划/执行分离 + 角色分工"；国内学术派（MetaGPT/ChatDev）更早公开多 agent 方法论 |
| 上下文工程 | Repo map（Aider）、Condenser（OpenHands）、/memory show（Gemini CLI） | 规则全量 vs 技能按需 token 分工（Trae）、消息池订阅（MetaGPT）、只传摘要（XAgent）、云端大仓索引（华为） | **同构**。国内把"省 token"作为显式设计目标 |
| 规则与约束机制 | AGENTS.md 标准（AAIF）、规则四档（Cursor）、CLAUDE.md | AGENTS.md 兼容（华为/Trae/Qoder）、规则四级生效（Trae）、Rule/Skill/MCP 三层（华为）、.comate/rules/*.mdr（Comate） | **同构**。国内 2026 年起全部向 AGENTS.md + 规则分片收敛 |
| 生态与定价 | 订阅制为主（Cursor $20-$200、Codex 等） | 免费+企业版双轨（CodeBuddy 58-316 元/人/月、Trae 149-259 元/席/月）、开源双轨（MetaGPT MIT+MGX、CodeFuse Apache） | 同构。国内价格约为国外 1/3-1/2 |

## 4. 国内验证的共识（与国外相互印证，非新发现）

1. **AGENTS.md 地图式**：AAIF 标准（国外）+ 华为/Trae/Qoder 兼容（国内）——双印证，一盏茶无需调整。
2. **规则-技能-工具三层分工**：Cursor Rules/Skills（国外）+ 华为 Rule/Skill/MCP 官方对比表（国内）——一盏茶 AGENTS.md=Rule、.harness/skills=Skill、MCP/API=Tool 正是此结构。
3. **门禁机械化**：Anthropic"无法验证就不提交"（国外）+ 华为"Hooks 确定性执行不受模型理解偏差影响"（国内）——一盏茶 verify/audit/ArchUnit 方向被双印证。
4. **纠错三要素**：Claude 结构化纠错（国外）+ ChatDev communicative dehallucination 互相追问细节（国内）——一盏茶 caveman-review 三要素同向。
5. **经验沉淀**：Anthropic 熵管理（国外）+ 华为每日反思/muAgent 经验入 KG（国内）——一盏茶 lesson→pattern→instinct 是更体系化版本。

## 5. 国内独有增量模式（国外未覆盖，可迁移一盏茶）

| # | 模式 | 标杆（URL） | 一盏茶现状 | 建议动作 | 优先级 | 验证级别 |
|---|---|---|---|---|---|---|
| D1 | **小 Spec 门禁量化**：Spec ≤100 行、每条约束可转测试、>10 轮返工回 Spec | 海信实测 300 行 60% vs 70 行 95%（docs.qoder.com/customer-cases/qoder-case-hisense，已查证） | 需求文档模板 F-编号+Given-When-Then 无行数/可测性门禁 | PRD 模板补三条硬门禁：单切片 ≤100 行；每条 F 编号必须映射 ≥1 测试；代码生成后 >10 轮返工即回需求阶段 | P0 | L1 |
| D2 | **规则/技能/工具三层命名 + token 分工红线**：规则常驻、技能按需、工具不参与推理 | 华为官方对比表（codeartsdoer_ug_0019，已查证）；Trae"规则全量占上下文、技能按需省 token"（docs.trae.cn/ide_skills，已查证） | 三层事实存在但未明文化 | `.harness/rules/` 加"三层语义"说明页；AGENTS.md 写死"规则=全量常驻、技能=渐进加载"红线，防技能内容回流规则文件 | P0 | L0 |
| D3 | **确定性 Hooks 开工门禁**：会话开始即跑一致性检查，不通过即阻断 | 华为 Hooks：确定性执行、chat.message 可阻断（已查证） | verify/audit 在提交前手动跑，开工时无门禁 | AI 会话"开始"事件自动跑 verify-harness + audit-redlines，红则先修再开工 | P0 | L2 |
| D4 | **阶段间结构化工件契约**：SOP 流水线，下一角色只读上游工件不读全对话 | MetaGPT：PRD→设计→代码→测试，SoftwareDev 可执行性 3.75 vs ChatDev 2.25（arXiv:2308.00352v7，已查证） | M5 五专家派发无显式中间工件 | 五专家间定义显式工件（需求/设计/评审结论），下一专家只读工件 | P0 | L3 |
| D5 | **只传摘要不传全历史**：子任务结束 Summarize 回传，祖先上下文马尔可夫 | XAgent inner-loop 摘要回传 outer-loop（blog.x-agent.net，已查证） | 子代理间无摘要约定 | 长任务子代理间只传结论摘要 + 文件指针，不传完整轨迹 | P0 | L2 |
| D6 | **Skill 上架准入自动化**：SKILL.md 必须含可执行验证命令 | 华为技能市场"自动化测试与规范审查后上架"（2026-06 动态，已查证） | 技能计数只查 frontmatter 合规 | verify-harness 加一类检查：每个 SKILL.md 必须含可执行验证命令，不可执行的技能不计入 66+32 | P0 | L2 |
| D7 | **规则分级生效**：低频规则 description 触发注入，非全量常驻 | Trae 四档：alwaysApply/globs/description/手动（docs.trae.ai/ide/rules，已查证） | 三规则全量常驻 | 低频规则（部署细则等）改 description 触发式，按任务类型注入 | P1 | L0 |
| D8 | **线上 Trace → 评测集 → 回归用例** | 百炼 Evolution（help.aliyun.com/zh/model-studio/agenteval-introduction，已查证） | eval-harness 七维存在，踩坑只写 lesson | 补规则：每次线上踩坑除 lesson 外同步产可重跑评测样本进 docs/agent-eval/ | P1 | L1 |
| D9 | **eval 输出附执行轨迹**：分数<60 可定位到失败环节 | trae-agent 自动记录完整 trajectory（github.com/bytedance/trae-agent，已查证） | eval 输出只有七维分数表 | eval-harness 增加"本次关键工具调用轨迹摘要"输出 | P1 | L2 |
| D10 | **Checkpoint 编辑前快照** | 华为：AI 编辑前自动保存代码+对话快照可回退（已查证） | 无批量改前快照 | AI 批量改文件前自动 `git stash create`，失败一键回滚 | P1 | L2 |
| D11 | **经验自动沉淀**：review 结束自动收集根因行，人工确认后晋升 | 华为每日反思 + muAgent"成功经验沉淀进 KG 减少绕路"（已查证） | 经验三级进化靠人工触发 | caveman-review 结束后脚本自动收根因行到 `.harness/changes/_pending-lessons.md` | P1 | L1 |
| D12 | **结果度量三指标**：渗透率/采纳率/AI 代码占比 | 腾讯 90%+/Comate 46%/蚂蚁 30%（均一方称） | eval-harness 是过程指标 | git 提交 AI 占比季度统计（conventional commits type 可统计），与 Devin 89% 曲线（国外）合并为一项 | P2 | L1 |
| D13 | **MCP 权限白名单命名**：`mcp__server__tool` 双下划线 | CodeBuddy 权限规则（www.codebuddy.ai/docs/cli/permissions，已查证） | 编码规范无 MCP 工具章节 | 写进编码规范工具章节，未来接 MCP 直接采用 | P2 | L1 |
| D14 | **多智能体"诊断"角色显式化** | Seed for Seed：执行/评测/诊断/优化四角色（seed.bytedance.com，已查证） | 三子代理偏评审 | 补根因诊断子代理角色，承接"两次修正失败就停下总结"触发点 | P2 | L2 |
| D15 | **多语言评测补 Java 切片** | Multi-SWE-bench 8 语言（seed.bytedance.com，已查证） | eval 切片偏前端 TS | Spring Boot 重写推进后补 Java/JPA 切片用例 | P2 | L2 |

**PLAN 归属**：D1-D15 均与"会话记忆"无依赖，**全部并入 `docs/PLAN-harness-research-2026-10.md`**（研究落地池；§6 并入时一并加入）；不并入 `PLAN-session-memory-fixes-2026-10.md`。D1/D2 同时约束未来所有需求文档（含 P0-1b 后续切片）。

## 6. 国内外差异与一盏茶定位

| 差异 | 国外 | 国内 | 对一盏茶 |
|---|---|---|---|
| 落地数据透明度 | 论文/财报/官方博客，可交叉验证 | 多为"一方称"客户案例稿，缺独立审计 | 采用国内数据一律标"一方称"；可迁移模式不受影响 |
| 评测体系 | 单一 SWE-bench 系 + 企业自评 | 多语言（Multi-SWE-bench）+ 企业级（CodeFuseEval）+ 平台 Trace 闭环（百炼） | eval-harness 七维已领先"规则评测"空白；可补 Java 切片 |
| 价格 | $10-$200/月 | 58-316 元/人/月（约 1/3-1/2） | 无关（自建 harness 无订阅） |
| 规则方法论深度 | AAIF 标准 + 各家 best practices | 华为三层定义 + Trae 四档生效 + 海信量化门禁 | 海信 Spec 量化与 Trae 分层是最值得抄的两件 |

```
国内独有增量 P0（6 条）可迁移路径：
D1 小 Spec 门禁 ──→ PRD 模板硬门禁（影响所有未来切片）
D2 三层命名/token 分工 ──→ .harness/rules 说明页 + AGENTS.md 红线
D3 确定性开工门禁 ──→ 会话开始自动跑 verify/audit
D4 阶段工件契约 + D5 摘要传递 ──→ M5 五专家编排升级（L3，需 ADR）
D6 Skill 准入自动化 ──→ verify-harness 新检查类
```

## 7. 边界与诚实声明

- 未找到公开一手数据项（如实标注）：MarsCode 时代规则机制与 MCP 支持；CodeGeeX 主仓库实时 star（GitHub API 两次失败，仅官方 PDF 快照 8,059）；国内四家（Comate/CodeArts/CodeFuse）SWE-bench Verified 公开成绩均未找到；CodeBuddy 官方公开榜单未找到。
- 所有用户数/企业案例/采纳率/榜单成绩均为企业自述（一方称），未经第三方独立审计；论文与 GitHub star 数据为已查证。
- CAMEL 已停滞（最后 push 2025-06），仅作历史参考；Trae 部分页面为摘要级查证（已在条目注明）。
- 未修改任何既有项目文件；本文为新交付物。
