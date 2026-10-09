---
name: req-quality-backlog
description: 总需求分析（2026-10-09）——合并 S1 茶园线 + 主仓库治理线后的剩余工作全景、质量四性验收重头、优先级建议。需求确认后进方案设计，禁止跳过本文件直接开工。
status: draft
owner: yanha
date: 2026-10-09
last_updated: 2026-10-09
---

# REQ：双线合并后剩余工作总需求分析（质量四性重头）

## 0. 结论先行

- 双线合并后剩余工作共 **6 簇 17 项**：S1 收尾、治理收尾、质量收敛（重头）、依赖解锁、新功能、文档/决策漂移修复（纵览新发现）。
- 质量四性（**规范性 / 维护性 / 安全性 / 可扩展性**）是全部任务的**贯穿验收标准**，每项交付前过四性审计，禁止为赶进度牺牲质量。
- 需要你拍板的决策共 **9 项**（见 §7），其中 4 项阻塞开工顺序。
- 建议顺序：**先收尾（S1 合 main + A3 compose）→ 再质量收敛 + 漂移修复（四性审计 + 文档刷新）→ 后新功能（K13/P1-2）→ 低优先选择性做**。

> 注：你说的"还有一个什么性"我按**可扩展性**补全（与规范性/维护性/安全性并列为代码四性经典组合）。如果你指的是健壮性或可观测性，告诉我，我调整 §2 与验收模板。

## 1. 目标与范围

### 1.1 目标

- 把 S1 茶园线（能量账本）与主仓库治理线（K/P 系列）合并为一张可执行的剩余全景。
- 以质量四性为重头，明确每个剩余任务的验收标准，避免"一股脑做完但质量不可控"。
- 产出优先级建议与需要用户决策的事项，确认后再展开方案设计。

### 1.2 做（范围边界内）

| 簇 | 内容 |
|---|---|
| C1 S1 收尾 | S1 worktree 5 commits 推远端 → PR → 合 main；能量 UI 端到端验证 |
| C2 治理收尾 | A3 compose up（key 已填）、PR #39 后续同步（无）、TOD/活文档维护 |
| C3 质量收敛（重头） | 四性审计：规范性（红线/ArchUnit 覆盖）、维护性（分层/文档/死代码）、安全性（防越权/密钥/CSP/限流）、可扩展性（契约版本化/配置化）——审计结果产出修复清单，分批修 |
| C4 依赖解锁 | A3（key 已填→compose up）解锁 P0-1c/K14；A4 cu 桌面解锁 K23/P0-3 验收 |
| C5 新功能（设计已出） | K13 repo map、P1-2 复杂度路由（PLAN-k13-p12-design 待确认） |
| C6 低优先（选择性） | K17-K22、P1-5/6/7/9/10、ENTERPRISE_GAP P0/P1 映射核对、技术债 |
| C7 漂移修复（纵览发现） | ADR-012 vs 技能路由表决策漂移、system-overview 过期 6+ 处、CONTEXT.md 过期 3 处 |

### 1.3 不做（明确排除）

- 阶段六（简历功能）——用户明确暂缓。
- 新功能立项（四维甄别未过）——本轮只收尾与收敛，不扩功能面。
- 过度工程：K8s/OTel/Traefik/邮件/微服务（ENTERPRISE_GAP 结论），单用户自托管不需要。
- 旧 FastAPI 新增功能（仅维护不新增）；旧栈 ENTERPRISE_GAP 项（P0-1/P0-7 等 uvicorn/ai.py 项）先映射核对新栈是否已天然消解，不重复做。

## 2. 质量四性（贯穿验收重头）

| 性 | 定义 | 检查手段（现有机制） | 验收门 |
|---|---|---|---|
| 规范性 | 代码符合项目红线与既定规范，无风格漂移 | AGENTS.md 红线、ArchUnit（LayerDependencyTest）、Biome、ruff+bandit、编码规范 15 红线 | `audit-redlines.cjs` ERRORS: []、ArchUnit 绿 |
| 维护性 | 分层清晰、命名一致、文档同步、无死代码孤儿 | 分层单向依赖、同物同词、docs 元信息头、verify-harness 漂移检查 | `verify-harness.cjs` ERRORS: []、L2+ 带测试 |
| 安全性 | 防越权、密钥不泄露、输入校验、OWASP 面收敛 | 认证鉴权、sessionId 归属校验、.env 不提交、CSP/限流 | 越权测试绿、密钥审计无泄露、`npm audit` 绿 |
| 可扩展性 | 配置化、契约版本化、模块边界清晰，改动可增量演进 | @Value 配置注入、api-contract 契约、Flyway 迁移、expand-contract | 新能力靠配置/契约扩展，不动承重墙 |

**通用验收模板（每个任务交付前必答）**：该改动是否符合四性各自的门禁？不满足 → 不提交，先修。

## 3. 剩余工作清单（F 编号 + Given-When-Then 验收）

### C1 S1 收尾

| # | 任务 | Given-When-Then 验收 |
|---|---|---|
| F-1 | S1 推远端 + PR + 合 main | Given worktree 5 commits 全绿；When 推送 feature/garden-s1 并开 PR；Then CI 13 job 全绿后 --admin merge，main 含 V4/ADR-015/前端改造 |
| F-2 | 能量 UI 端到端验证 | Given 后端 compose 运行 + 登录用户 + 品鉴数据；When 完成一次品鉴并进茶园页；Then 能量气泡出现、一键收集后阶段推进、3D 档位变化，截图留证 |

### C3 质量收敛（重头，分四批）

| # | 任务 | Given-When-Then 验收 |
|---|---|---|
| F-3 | 规范性审计 | Given 全量红线脚本；When 跑 audit-redlines + ArchUnit + Biome；Then ERRORS: []，违规项产出修复清单（分批修，每批独立 commit） |
| F-4 | 维护性审计 | Given verify-harness + wiki 契约 + 文档索引；When 核对分层/命名/文档漂移/死代码孤儿；Then ERRORS: []，漂移当场修不遗留 |
| F-5 | 安全性审计 | Given 认证鉴权 + 密钥 + OWASP 面清单；When 逐项核对（越权/密钥泄露/输入校验/CSP/限流）；Then 高危项清零，剩余项进风险登记 |
| F-6 | 可扩展性审计 | Given 契约文件 + 配置 + 迁移；When 核对新增能力是否配置化/契约化/迁移化；Then 违反项产出收敛方案（如硬编码、无契约端点） |

### C4 依赖解锁

| # | 任务 | Given-When-Then 验收 |
|---|---|---|
| F-7 | A3：docker compose up backend | Given .env 已含 AI key；When compose up -d backend；Then /health 200、/api/v1/auth 可用，解锁 P0-1c/K14 联调 |
| F-8 | P0-1c 向量检索回填 | Given 后端运行 + embedding 可用；When 回填 teawares/etiquettes/relations 三表向量；Then 检索命中 + ILIKE 降级保留（承重墙） |
| F-9 | K14 LLM mocking 确定性测试 | Given AI key 可用；When 写 mock 化确定性用例；Then 测试不依赖真实 key、可重复、CI 绿 |
| F-10 | A4：cu 虚拟桌面处理 | Given 用户处理占用后；When 跑截图链路；Then K23 截图产出 + P0-3 前端返工验收通过 |

### C5 新功能（设计已出，等确认）

| # | 任务 | Given-When-Then 验收 |
|---|---|---|
| F-11 | K13 repo map（阶段 1 纯 fs） | Given 设计确认；When gen-repomap.cjs 实跑；Then 输出 repo-map.md ≤300 行、抽查符号命中、EXIT=0 |
| F-12 | P1-2 复杂度路由 | Given 设计确认（含 Q1/Q2）；When AgentOrchestrator.complexity + 配置落地；Then 三档边界单测绿、mvn 全量绿、模型不可用回退默认 |

### C6 低优先（选择性）

| # | 任务 | Given-When-Then 验收 |
|---|---|---|
| F-13 | K17-K22 度量/卫生系列 | Given 逐项过四维甄别；When 确定做；Then 按各自 PLAN 验收 |
| F-14 | ENTERPRISE_GAP 映射核对 | Given 新旧栈清单；When 逐项映射（新栈消解/旧栈保留）；Then 产出决定表（做/不做/已消解），不重复做 |

### C7 文档/决策漂移修复（纵览新发现，2026-10-09）

| # | 任务 | Given-When-Then 验收 |
|---|---|---|
| F-15 | 决策漂移修复：ADR-012（引入 Redis，Accepted 2026-10-05）vs biz-dev README "03-caffeine-cache（裁 redis）" 冲突 | Given ADR-012 为现行决策；When 同步技能路由表与裁剪声明；Then biz-dev 03 改为"两级缓存（Caffeine L1 + Redis L2）"表述并标注 ADR-012 依据，verify-harness 绿 |
| F-16 | system-overview.md 刷新（6+ 处过期） | Given 现状事实（S1 茶园能量账本已实现 / AI 走 DashScope / CI 13 job / Docker 现行 / ADR 至 014+）；When 逐节对照更新；Then 全文无过期表述，ADR 索引至 015 |
| F-17 | CONTEXT.md 刷新（3 处） | Given 现状事实；When 修正"Docker 已弃用"相反表述 + 去 ADR-013 重复行 + 后端关键词补 Spring Boot；Then 与工程结构/DEPLOY 一致 |

**纵览基线（2026-10-09 实查）**：
- 前端成熟（阶段一至五）；后端重写中：Spring Boot 已实现 7 域（ai/auth/common/culture/record/tea/ware，8 个 Service），garden 域在 S1 worktree 待合 main；旧 FastAPI 仅维护。
- 待落地缺口：scheduled-task（AI 成本日统计，ADR-011 决策 5）、Redis 四场景（ADR-012，M2/M3 未落地）、结构化日志（K15）、eval Java 切片（K16）、前端 P-O 优化。
- 技能缺口已补（quality-audit）；agent 开发类技能已存在（biz-dev 14-ai-agent / 15-rag-pipeline / 16-ai-fallback）。

## 4. 影响分析

| 项 | 影响面 | 风险与缓解 |
|---|---|---|
| S1 合 main | main 代码库 + CI | V4 迁移与 K1-K12 无冲突（worktree 已基于 ffe807e 全量验证）；合前过 quality |
| 质量审计批量修 | 全库代码 | 分批修、每批独立 commit、可 revert；只动审计发现的违规，不顺手重构 |
| A3 compose up | 本地 Docker + 端口 | 8080 可能被占用（另一会话）；先查端口再起，冲突换端口 |
| 可扩展性收敛 | 契约/配置 | 涉及契约变化走 api-contract 登记，不静默改 |
| 文档/决策漂移修复（C7） | docs + 技能路由表 | 纯文档/路由表述修复，零代码风险；修复后 AI 上下文不再被过期文档误导 |
| Redis 场景落地（若本轮做） | 后端 + 依赖 + compose | 走 ADR-012 既定场景（M2/M3）；禁止摆设式引入；每场景带测试 |
| 低优先选择 | 无 | 四维甄别 + 用户拍板，不做伪需求 |

## 5. 优先级建议（P0-P3）

| 优先级 | 项 | 理由 |
|---|---|---|
| P0（先做，收尾） | F-1 S1 合 main、F-7 A3 compose up | 工作已 90% 完成，落地成本最低；A3 解锁两个依赖项 |
| P1（重头，质量收敛） | F-3/F-4/F-5/F-6 四性审计 + F-15/F-16/F-17 漂移修复 | 用户点名重头；漂移修复与批 2 维护性同批（低风险高收益） |
| P2（新功能） | F-11 K13、F-12 P1-2（确认后） | 设计已出，依赖 Q1/Q2 拍板 |
| P3（依赖解锁 + 低优先） | F-2/F-8/F-9/F-10/F-13/F-14 | 依赖用户操作或低价值，穿插做 |

## 6. 建议执行顺序（依赖图）

```
P0 收尾          P1 质量收敛（重头）      P2 新功能
F-1 S1 合 main ──┐
                 ├─→ F-3/4/5/6 四性审计 → 修复清单 → 分批修
F-7 A3 compose ──┤                        │
                 └─→ F-8 P0-1c / F-9 K14   ├─→ F-11 K13
F-10 A4（用户）─────→ F-2 能量 UI 验证      └─→ F-12 P1-2
```

## 7. 需要你拍板的事项（8 项，前 4 项阻塞顺序）

| # | 决策 | 我的建议 |
|---|---|---|
| D-1 | 第四个性：可扩展性？还是健壮性/可观测性？ | 可扩展性（见 §0 注） |
| D-2 | S1 现在就推远端开 PR？（合 main 需 CI 全绿 + --admin） | 是，成本最低 |
| D-3 | A3 `docker compose up backend` 由我直接执行？ | 是，key 已填，唯一剩余动作 |
| D-4 | 四性审计先做哪一批？（规范/维护/安全/扩展） | 先规范性（脚本自动化程度最高，收益最快） |
| D-5 | K13/P1-2 设计确认？（P1-2 的 Q1/Q2：是否引入第二模型、阈值 40 字/3 轮/200 字） | 确认设计；模型先留空走默认 |
| D-6 | ENTERPRISE_GAP P0/P1 旧栈项：新栈已消解的跳过？ | 是，只做新栈仍有差距的 |
| D-7 | 低优先 C6：哪些做、哪些砍？ | 先 F-14 映射核对，再定 |
| D-8 | 后端重写推进节奏（K15/K16 等依赖它） | 维持现状（重写中），不额外扩 |
| D-9 | 纵览发现 C7：本轮直接修漂移（F-15/F-16/F-17）？Redis 四场景（ADR-012 M2/M3）本轮落地还是只修技能表述？ | 漂移直接修（零风险）；Redis 场景只修表述，落地排到后端重写 M2/M3 阶段 |

## 8. 需求确认

- [ ] D-1~D-9 拍板（或修正）
- [ ] F-1~F-17 范围确认（增减项）
- [ ] 确认后：出方案设计（PLAN-*，含每簇任务拆解 + 验证矩阵）
