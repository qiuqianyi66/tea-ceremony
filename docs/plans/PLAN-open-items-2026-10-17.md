---
name: plan-open-items-2026-10-17
description: 未完成事项统一规划（2026-10-17 复核）——把散在 25 份 PLAN/REQ/GAP 文档里的「未完成」逐条实测后汇成一份可执行清单，区分真未完成 / 等外部条件 / 待拍板 / 文档债。
status: active
owner: yanha
last_updated: 2026-10-17
---

# 未完成事项统一规划（2026-10-17 复核）

> 用途：**未完成事项的唯一入口**。散在 `docs/plans/PLAN-*`、`docs/prd/REQ-*`、`docs/ENTERPRISE_GAP.md`、`docs/OPTIMIZATION_PLAN.md` 里的"未完成"，先读这里，别逐份翻。
> 方法：25 份文档提取 86 条"未完成"声明 → **逐条实测复核**（grep / 文件存在 / 脚本可跑），不转抄文档结论。复核命令随条目给出。
> 结论：**真未完成 5 项 / 等外部条件 4 条 / 待拍板 6 条 / 文档债 20 条（写着未做，实测已做）**。

## 0. 一分钟结论

1. 清单比文档薄得多：86 条声明里 **20 条是过期债**（早已完成但文档没改），5 条是真待办。
2. **没有任何硬阻塞**：所有"等外部条件"都只需一个动作（充值 / 域名 / 预算拍板），不需要技术突破。
3. 最该先做的不是写代码，是**清文档债**——否则下一个会话会把已完成的事再做一遍（仓库已有 6 次同类教训）。

## 1. 真未完成（可直接开工）

| # | 项 | 实测证据 | 规模 | 级别 |
|---|---|---|---|---|
| **A1** | **P1-10 OPTIMIZATION_PLAN 残留核对**：旧栈条目逐条映射到新栈（消解 / 保留 / 过时） | T15 决定表标"做"，`docs/OPTIMIZATION_PLAN.md` 196 行仍在记旧栈状态；除 P1-8/P1-9 外无系统核对产物 | 半天 | L0 |
| **A2** | **评测 v6 离线批（F-V1~F-V3）**：判分器与产品设计冲突 5 条、`precondition: no-records` 标注 6 条、边缘输入关键词匹配 2 条 | `docs/ai-eval/ITERATIONS.md` 只到 v3；`docs/prd/REQ-ai-eval-v6-2026-10-12.md` 90 行未落地；live 批等充值，**离线批无依赖** | 1 天 | L1 |
| **A3** | **Phase 5 上下文缓存**：公共前缀做到 ≥1024 token + 语义缓存 | `git grep -il "cache" -- backend/src/main/java/com/tea/ai/` = **0**；`RedisTemplate\|@Cacheable` 全后端 = **0**；平均输入 225 token < 1024 → 20% 折扣一直吃不到 | 1-2 天 | L2 |
| **A4** | **P0-3 色值令牌化剩余量** | `git grep -o "#[0-9a-fA-F]\{6\}" -- src/views src/components` = **268 处**（原文写 ~500，已换一批；`colorTokens` 现 10 个文件引用） | 分批 | L1 |
| **A5** | **文档债清理**：把 §4 的 20 条"未做"标注为已完成 | 见 §4 逐条证据 | 半天 | L0 |

**A3 的诚实边界**：无 AI key 时无法验收缓存命中（要看响应里的 cached_tokens）。可先做"公共前缀扩容 + 语义缓存骨架 + 单测"，命中验证等充值后补。

## 2. 等外部条件（不是没人做，是做不了）

| 项 | 卡什么（实测） | 解锁动作 | 解锁后可做 |
|---|---|---|---|
| 评测 live 批 / 正式基线 | DashScope 2026-10-12 欠费（HTTP 400 `Arrearage`），live 调用被拒 | 阿里云百炼充值（¥50 量级够评测） | T08 pass³ 通义基线、T09 judge 校准补跑、v6 live 批 |
| P1-6 ai_usage_logs 消费端（每日统计 + 预算告警） | 同上：无有效调用 = 无数据可看 | 同上 | 用量报表 + 超阈值告警 |
| P1-9 HTTPS 443 + HSTS | 公网是裸 IP `42.121.125.4`，无域名无证书 | 用户申请域名 + 签证书 | 证书挂载 → 443 → 80 跳转；HSTS 同步补 |
| SFT T13 训练 | 预算未定（`PLAN-sft-budget` 训练单价需登录控制台确认，示例 $0.3/千 token 仅量级参考） | 用户给预算上限 | 241 条语料直接训练 LoRA（单专家 mentor） |
| 三大体积目录 86 MB（`.agents/skills` 34 / `docs/screenshots` 29.2 / `public/3d` 22.8） | 存储形态决策（LFS / 移出 git / 维持），改了就不可逆 | 用户拍板 | 仓库瘦身 |

## 3. 待用户拍板（每条给推荐与代价）

| # | 决策点 | 推荐 | 代价 / 反转条件 |
|---|---|---|---|
| D1 | **T15 决定表剩余项照准？**（K18/K19/K20/K22/P1-6/P1-7/P1-9 降级） | 照准降级 | 降级 ≠ 不做，是"等到有真实需求再做"；反转条件各条目已写明 |
| D2 | **SFT 语料量级**：241 条直接练 vs 先扩 500+ | 241 直接练（先跑通闭环） | 扩 500+ 多花 2-3 天合成 + 更多训练费，收益未验证 |
| D3 | **语义缓存是否本轮做**（ADR-012 M2/M3 需 Redis） | 与 A3 一起做，但只做骨架 | 引入 Redis = 新依赖 + 新容器，属 L3 |
| D4 | **超大单文件拆分**：`TeaBrewSceneInner.vue` 1322 行 / `BrewView.vue` 812 / `useAudio.ts` 789 | 拆 `useAudio.ts` 先（纯逻辑，E2E 兜底充分） | 3D 场景组件拆分风险高，建议单独一轮 |
| D5 | **SSE 流式输出立项** | 继续暂缓 | 200 字响应流式增益仅提前 1-2s；改契约 + 降级链回归面大 |
| D6 | **`filter-repo` 重写历史** | 暂不做 | 会改所有 commit hash，破坏外部引用；`.git` 160MB 未到痛点 |

## 4. 文档债：写着未完成，实测已完成（防下次重做）

| 文档位置 | 文档声明 | 实测证据 | 处置 |
|---|---|---|---|
| `REQ-quality-backlog` F-8/F-9/F-11/F-13/F-14 | "待排" | T10-T14 已完成（评测集/评测器/Judge 骨架/repo-map 270 行/经验池 9 条） | 标 ✅ |
| `REQ-graph-introduce` F-1/F-2/F-4/F-5 | "待开工" | v3 全量真实分已出（overall 0.81 / judgeCoverage 1）；ITERATIONS 已记 v1-v3 口径 | 标 ✅ |
| `REQ-graph-introduce` F-3 | "Docker 引擎未运行阻塞评测" | 本地 Docker 已修复，A3 compose up 已跑通（18080→8080 healthy） | 标 ✅ |
| `REQ-graph-introduce` F-6 | "待排期" | `AiCallQuota` + `QuotaExceededException` 429 已落地（ec7e8f4） | 标 ✅ |
| `PLAN-harness-research` P3-4 / K23 / `REQ-quality-backlog` F-10 | "cu 虚拟桌面占用阻塞截图" | **前提已证伪**：verify-gardens/pavilion/icons + screenshot-* 全部本地 headless 跑通，Judge 实跑与桌面无关 | 标 ✅（阻塞解除） |
| `PLAN-harness-optimization-v2` K14 | "依赖 P0-2 AI key" | K14 已实现（后端 mock ChatClient + 无 key 502 契约测试） | 标 ✅ |
| `PLAN-gateway-eval-channel` T08/T09 | "进行中 / 未开始" | PR #65（pass³ 32/50）、#66（T09 一致率 95.0%）已合并 | 标 ✅ |
| `PLAN-P0-2026-10-08` "截图脚本从未成功" | B1/B2 待诊断 | 截图链路已全部打通（见上一条） | 标 ✅ |
| `PLAN-session-memory-fixes`（status: draft，O-1~O-6 待定） | 整体"待批准后执行" | 该 PLAN 的设计已落地：F-6 配额（429）+ 后端 anchor 20 条 + 游客本地 history（ec7e8f4/29d8d31） | 改 status: implemented / 归档 |
| `PLAN-k13-p12-design` OQ-Q1/Q2（第二模型 / 阈值） | 待拍板 | P1-2 复杂度路由已落地（SIMPLE/MEDIUM/COMPLEX + 配置化），Q1 采纳"先不引入第二模型" | 标 ✅ |
| T15 决定表 K17 / K21 / P1-5 | "做"（未实施） | K17：`scripts/eval-extract-regression.cjs` 已存在；K21：`session-handoff/SKILL.md:17-18` 已写 L2/L3 必写、L0/L1 不触发；P1-5：`LibrarianAgent.java:104-106` 已加"⚠ 无来源"标记 | 标 ✅（T15 只剩 A1） |
| `PLAN-ai-capability` Phase 2 遗留"真嵌入需手动触发" | 遗留 | 属 Phase 4 语料前置，随 SFT 预算一起走 | 并入 §2 |
| `PLAN-harness-research` P0-2 "AI key 未配" | 502 降级态 | yg-gateway 通道已闭环评测（免费），生产 key 未配 → 与 DashScope 欠费同项 | 并入 §2 |

## 5. 建议执行顺序（按 ROI，不含待拍板项）

1. **A5 文档债**（半天）：改 20 处状态标注 → 下一个会话不再重做已完成的事
2. **A1 P1-10 残留核对**（半天）：纯文档，零风险，清掉旧栈误导
3. **A2 评测 v6 离线批**（1 天）：判分器口径修复 + precondition 标注，直接提升评测可信度
4. **A4 色值令牌化**（分批）：268 处按视图分批替换，每批过设计门禁 + 截图验证
5. **A3 上下文缓存**（1-2 天）：先做前缀扩容 + 语义缓存骨架 + 单测；命中验证等充值

## 6. 与既有文档的关系（避免又一份平行清单）

| 文档 | 角色 | 本次处置 |
|---|---|---|
| **本文件** | 未完成事项唯一入口 | 新建 |
| `docs/plans/TODO-PRIORITY.md` | 跨会话状态速览 | 加一行指针指向本文件；不再各自维护未完成清单 |
| `docs/plans/out-of-scope.md` | 明确不做 | 不变（本文件 §3 的 D5/D6 与之一致） |
| `docs/plans/hygiene-audit-2026-10-17.md` | 屎山盘点（体积/重复/死脚本） | 不变；其 §6 待决策已并入本文件 §2/§3 |
| `docs/prd/REQ-ai-eval-v6-2026-10-12.md` | v6 评测需求 | 不变；A2 引用它 |
| 各 `PLAN-*` | 单切片执行计划 | 已完成者按 §4 标 ✅，不再作为待办来源 |
