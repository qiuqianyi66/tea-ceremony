---
name: plan-open-items-2026-10-17
description: 未完成事项统一规划（2026-10-17 复核 + 执行拆解）——把散在 25 份 PLAN/REQ/GAP 文档里的「未完成」逐条实测后汇成清单，每项给出步骤/验收/风险，并区分真未完成 / 等外部条件 / 待拍板 / 文档债。
status: active
owner: yanha
last_updated: 2026-10-17
---

# 未完成事项统一规划（2026-10-17 复核 + 执行拆解）

> 用途：**未完成事项的唯一入口**。散在 `docs/plans/PLAN-*`、`docs/prd/REQ-*`、`docs/ENTERPRISE_GAP.md`、`docs/OPTIMIZATION_PLAN.md` 里的"未完成"，先读这里，别逐份翻。
> 方法：25 份文档提取 86 条"未完成"声明 + 4 轮深度扫描（代码抑制标记 / 测试 skip / CI 弱化门禁 / 调度任务）→ **逐条实测复核**，不转抄文档结论。
> 结论：**真未完成 0 项 / 等外部条件 4 条 / 待拍板 5 条（D1/D2/D4/D5/D6）/ 文档债 25 条**。（2026-10-17 五次复核：A 类全部处置；D3 已由 ADR-021 决策、D7 随 A6 结案、D8 已决策并落地）

## 0. 一分钟结论

1. 清单比文档薄：86 条声明里 **25 条是过期债**。A 类 6 项**全部处置完毕**：完成 3 项（A2/A5/A6）、本来就做过 1 项（A1）、用数据否掉 2 项（A4 令牌化、A3 前缀扩容）。
2. **无技术阻塞**：4 条"等外部条件"各自只需一个动作（充值 / 域名 / 预算 / 拍板）。
3. 唯一的结构性矛盾：**ADR-012 判"引入 Redis"（status: active），代码零实现**（`spring-data-redis` 不在 pom，0 处 RedisTemplate）。决策与实现脱节，需重新拍板。
4. 优先级：先清文档债（半天）→ 再动代码。否则下一个会话会把 22 件已完成的事重做一遍。

## 1. 真未完成（含执行拆解）

### ~~A1 P1-10 OPTIMIZATION_PLAN 残留核对~~ → **已完成（2026-10-13）**

> **2026-10-17 更正**：我上一轮判它"未做"是错的——`docs/OPTIMIZATION_PLAN.md` §五「落地核对结论（2026-10-13，T15 P1-10）」本身就是 30+ 项逐条核对结果。教训：**断言"没做"之前先读目标文件末尾的结论节**，别只看表格中段。

增量只剩 3 项低优先增强（详见 `docs/OPTIMIZATION_PLAN.md` §六）：P1-12 健康分离（/live /ready）、P2-6 aria-live 覆盖、P2-7 AVIF 转换——都不阻塞发布，列入「低优先」而非本轮真待办。

### ~~A2 评测 v6 离线批 F-V1~F-V3~~ → **离线批已完成（PR #88）**

> 已完成：F-V1（50 条补 precondition，10 no-records / 40 n/a，含机械化门禁，双向实测 bogus 会报错）+ F-V2（RAG 未命中按合格常识回答判定，单测 33/33）。**未做**：F-V3 六境 prompt 与 F-V4 pass^3 报告格式需 live 跑批，等 DashScope 充值。

现状：`docs/ai-eval/ITERATIONS.md` 只到 v3；v3 失败 13 条按根因三类（判分器与产品冲突 5 / 缺 precondition 6 / 边缘匹配 2）。

- 步骤：①读 v3 归因清单逐条对判分器 → ②修 ADV-001/002「允许常识作答」语义（不按"未命中"扣分）→ ③评测集加 `precondition: no-records` 标注 6 条 → ④补边缘输入关键词 2 条 → ⑤`validate-eval-cases.cjs` + `eval-tea-ai.cjs --dry-run` 回归
- 验收：dry-run 输出 VALID；判分器单测更新并通过；v3 同口径重跑 program-only 分不下降
- 风险：**放松判分会让分数虚高**——每处放宽必须配单测锁死，且报告里区分「口径变化」与「质量提升」

### ~~A3 Phase 5 上下文缓存~~ → **前缀扩容已用算式否决；语义缓存并入 D3**

**实测（2026-10-17）**：五个专家的 `SYSTEM_PROMPT` 常量为 335–493 字符 → **167–260 token**（Advisor 217 / Brewer 216 / Librarian 167 / Mentor 260 / Taster 251），加检索标记拼装后固定前缀约 **220 token**，距隐式缓存 1024 阈值差 4–5 倍。

**净收益算式（百炼上下文缓存：命中段按 20% 计价）**：

```
现状      输入 225 token（固定前缀 ~220）                 → 全价 225 当量
扩容+命中  输入 1113 token（前缀 1024 命中 + 内容 89）     → 1024×0.2 + 89 = 293.8 当量
净差      +68.8 当量/次（成本 +31%）                      → 负数，否决
```

> 只有单次输入本身 ≥ ~1280 token 时扩容才可能持平（1024 的 80% 折扣 = 819 才能抵掉塞进去的 800+ token）。本项目是短问答（平均 225 token），**前缀扩容是明确负收益**。
> **语义缓存**（省整次调用 100%）不在本文件实施：依赖 embedding（需 AI key）+ Redis（D3 未拍板），并入 D3 决策。

### ~~A4 色值令牌化剩余~~ → **实测不可行，转 D8 决策**

> 2026-10-17 实测否掉原假设：268 处里**只有 9 处恰等于令牌值**，其余 259 处是定制/派生色（其中 115 处在 `src/components/three/**` 的 3D 场景调色，不属 UI 语义色）。那 9 处还有两类不可替换：语义不匹配（`#c9a96e` 是暗色令牌值，却用在浅色页 `TeaBreakView` / `HomeHero`）、技术上读不到（`TeaTreeCanvas.vue` 的 canvas `strokeStyle`）。**「清零裸值」不是可机械执行的目标**，已转 D8 由设计拍板，并在 `DESIGN_SPEC.md` §〇 补令牌适用边界。

### A5 文档债清理（0.5d，L0）

见 §4 的 22 条，逐条改状态标注（已完成标 ✅ / 版本改 status / 阻塞项标已解除）。

- 验收：`git grep -c "待排\|待开工" -- docs/` 显著下降；`verify-harness` 绿
- 风险：无

### ~~A6 pip-audit 安全债立项~~ → **已结案：不修（漏洞不可达）**

> 结论：pyasn1 0.4.8 / ecdsa 0.19.2 是 python-jose 的传递依赖，但旧栈 JWT 只用 HS256（`backend/app/deps.py:22`、`auth_service.py:18`），`ecdsa`/`pyasn1` 只在 RS256/ES256 路径被调用 → 不可达；且旧栈仅维护、生产跑 Spring Boot（jjwt）。已写入 `docs/plans/out-of-scope.md` + `ci.yml` 注释（把"临时放行"改成"有据放行"）。

现状：`.github/workflows/ci.yml:91` `continue-on-error: true`（非阻断），注释写"pyasn1<0.5 受 python-jose 约束、ecdsa 无修复版本；根治需迁移 PyJWT（已记录，未立项）"——**全库 grep 无该立项记录**。

- 步骤：①`pip-audit -r backend/requirements.txt` 出全量清单 → ②评估 python-jose 使用面（JWT 签发/校验在 `JwtService`）→ ③二选一：迁 PyJWT（L2，需 JWT 回归测试）或维持非阻断 + 在 out-of-scope 记明「已知漏洞 + 不修理由 + 重评条件」
- 验收：无论做或不做，`docs/plans/out-of-scope.md` 有明确条目
- 风险：JWT 库迁移影响认证承重墙 → 必须全量认证测试 + 令牌兼容性验证

## 2. 等外部条件（不是没人做，是做不了）

| 项 | 卡什么（实测） | 解锁动作 | 解锁后可做 |
|---|---|---|---|
| 评测 live 批 / 正式基线 | DashScope 2026-10-12 欠费（HTTP 400 `Arrearage`） | 阿里云百炼充值（¥50 量级够评测） | T08 pass³ 通义基线、T09 judge 校准补跑、v6 live 批、A3 缓存命中验证 |
| P1-9 HTTPS 443 + HSTS | 公网是裸 IP `42.121.125.4`，无域名无证书 | 申请域名 + 签证书 | 证书挂载 → 443 → 80 跳转；HSTS 同步补 |
| SFT T13 训练 | 预算未定（训练单价需登录百炼控制台确认） | 用户给预算上限 | 241 条语料直接训练 LoRA（单专家 mentor） |
| 三大体积目录 86 MB（`.agents/skills` 34 / `docs/screenshots` 29.2 / `public/3d` 22.8） | 存储形态决策 | 拍板 | 仓库瘦身 |

## 3. 待用户拍板（每条给推荐与代价）

| # | 决策点 | 推荐 | 代价 / 反转条件 |
|---|---|---|---|
| D1 | T15 决定表剩余项照准？（K18/K19/K20/K22/P1-7/P1-9 降级） | 照准降级 | 降级 ≠ 不做；**注：P1-6 在表里被降级，但它其实已实现**（见 §4） |
| D2 | SFT 语料量级：241 条直接练 vs 先扩 500+ | 241 直接练 | 扩 500+ 多花 2-3 天合成 + 更多训练费，收益未验证 |
| D3 | ~~ADR-012 Redis + 语义缓存~~ | **已决策（ADR-021，2026-10-17）**：暂不引入 Redis，ADR-012 标 deprecated；语义缓存随「AI key + 真实流量」重启评估 | 反转条件：多实例水平扩展 / 语义缓存能算出净收益 / 简历目标重启 |
| D4 | 超大单文件拆分：`TeaBrewSceneInner.vue` 1322 行 / `BrewView.vue` 812 / `useAudio.ts` 789 | 先拆 `useAudio.ts`（纯逻辑，E2E 兜底充分） | 3D 场景组件拆分风险高，单独一轮 |
| D5 | SSE 流式输出立项 | 继续暂缓 | 200 字响应增益仅提前 1-2s；改契约 + 降级链回归面大 |
| D6 | `filter-repo` 重写历史 | 暂不做 | 会改所有 commit hash，破坏外部引用 |
| D7 | ~~A6 安全债：迁 PyJWT 还是维持非阻断~~ | **已结案：不修**（漏洞不可达，见 A6） | — |
| D8 | ~~裸值治理策略（268 处硬编码色值）~~ | **已决策并落地（2026-10-17）**：新增 `ink-bright` 令牌收编最高频的 17 处（等值替换，零视觉变化）；其余维持「派生色允许裸值 + 注释」，不追求清零 | 实测 9/268 可等值替换；扩表须逐个确认语义，禁止为凑数换错令牌 |

## 4. 文档债：写着未完成，实测已完成（22 条，防下次重做）

| 文档位置 | 文档声明 | 实测证据 | 处置 |
|---|---|---|---|
| `REQ-quality-backlog` F-8/F-9/F-11/F-13/F-14 | "待排" | T10-T14 已完成（评测集/评测器/Judge/repo-map/经验池） | 标 ✅ |
| `REQ-graph-introduce` F-1/F-2/F-4/F-5 | "待开工" | v3 全量真实分已出（0.81 / judgeCoverage 1） | 标 ✅ |
| `REQ-graph-introduce` F-3 | "Docker 未运行阻塞评测" | 本地 Docker 已修，compose up 跑通（18080→8080 healthy） | 标 ✅ |
| `REQ-graph-introduce` F-6 | "待排期" | `AiCallQuota` + `QuotaExceededException` 429 已落地 | 标 ✅ |
| `PLAN-harness-research` P3-4 / K23 / `REQ-quality-backlog` F-10 | "cu 虚拟桌面阻塞截图" | **前提证伪**：verify-gardens/pavilion/icons + screenshot-* 全本地 headless 跑通 | 标 ✅（阻塞解除） |
| `PLAN-harness-optimization-v2` K14 | "依赖 AI key" | K14 已实现（mock ChatClient + 502 契约测试） | 标 ✅ |
| `PLAN-gateway-eval-channel` T08/T09 | "进行中/未开始" | PR #65（pass³ 32/50）、#66（T09 一致率 95.0%）已合并 | 标 ✅ |
| `PLAN-P0-2026-10-08` "截图从未成功" | B1/B2 待诊断 | 截图链路已全部打通 | 标 ✅ |
| `PLAN-session-memory-fixes`（status: draft，O-1~O-6） | "待批准后执行" | 设计已落地：F-6 配额 + 后端 anchor 20 条 + 游客本地 history | 改 status: implemented |
| `PLAN-k13-p12-design` OQ-Q1/Q2 | 待拍板 | P1-2 复杂度路由已落地（三档 + 配置化），Q1 采纳"先不引入第二模型" | 标 ✅ |
| T15 K17 / K21 / P1-5 | "做"（未实施） | K17 `scripts/eval-extract-regression.cjs`；K21 `session-handoff/SKILL.md:17-18`；P1-5 `LibrarianAgent.java:104-106` | 标 ✅ |
| **T15 P1-6**（"降级：等 AI key"） | 未做 | **`AiUsageSummaryService.java` 已实现**：`@Scheduled` 每日 8 点统计 + 预算告警（默认 20 万 token）+ 单测 | 标 ✅ |
| **`OPTIMIZATION_PLAN` P2-5 视觉回归** | "缺像素阈值" | `e2e/visual-regression.spec.ts` 已实现 `maxDiffPixelRatio 0.02` + 快照目录（CI 跳过属设计） | 标 ✅ |
| **CI `pip-audit` 注释"未立项"** | 只有注释 | 全库无立项记录 → **转 A6 真待办** | 移入 §1 |
| `PLAN-ai-capability` Phase 2 "真嵌入需手动触发" | 遗留 | 属 Phase 4 语料前置，随 SFT 预算走 | 并入 §2 |
| `PLAN-harness-research` P0-2 "AI key 未配" | 502 降级态 | 评测已用 yg-gateway 闭环；生产 key 与 DashScope 欠费同项 | 并入 §2 |
| `REQ-quality-backlog` §110 "scheduled-task 未落地" | 待落地 | 同 P1-6 → `AiUsageSummaryService` 已实现 | 标 ✅ |
| `REQ-quality-backlog` §110 "K15 结构化日志" | 待落地 | `RequestIdFilter` + logback MDC 已落地（P1-1 ✅） | 标 ✅ |
| `REQ-quality-backlog` §110 "K16 eval Java 切片" | 待落地 | 仍缺；依赖后端重写节奏，当前不阻塞 | 留作低优先 |
| `REQ-quality-backlog` §110 "Redis 四场景 M2/M3" | 未落地 | pom 无 spring-data-redis，0 实现 | **转 D3 决策** |
| `REQ-ai-capability` 事实 4 "语义缓存未实现" | 未实现 | 与 A3 同一件事 | 归入 A3 |
| `ENTERPRISE_GAP` P2-9 Sentry | "需拍板" | 与 ADR-006「本地埋点无网络外发」冲突 | 保留在决策区（等同 D 类） |
| **`OPTIMIZATION_PLAN` P1-10 残留核对** | 我上轮判"未做" | §五「落地核对结论（2026-10-13，T15 P1-10）」已是完整核对结果 | **标 ✅（T15「做」的 4 项全部完成）** |

## 5. 执行顺序（含依赖）

```
无待开工代码项。

已完成：A2（PR #88）· A5（PR #87）· A6（PR #89 结案不修）· A1（本已做过）
已否掉：A4（实测 9/268 → D8）· A3 前缀扩容（净亏 31% → 语义缓存并入 D3）
```

**为什么不先写代码**：A5 半天清掉 22 条过期债，避免后续每个任务都先花时间验证"这事是不是已经做了"——仓库已有 6 次同类教训（见 `docs/plans/lessons.md`）。

## 6. 与既有文档的关系（避免又一份平行清单）

| 文档 | 角色 | 本次处置 |
|---|---|---|
| **本文件** | 未完成事项唯一入口 | 新建 |
| `docs/plans/TODO-PRIORITY.md` | 跨会话状态速览 | 加指针；不再各自维护待办清单 |
| `docs/plans/out-of-scope.md` | 明确不做 | 不变（D5/D6 与之一致；A6 若不修则记这里） |
| `docs/plans/hygiene-audit-2026-10-17.md` | 屎山盘点 | 不变；其 §6 待决策并入本文件 §2/§3 |
| `docs/prd/REQ-ai-eval-v6-2026-10-12.md` | v6 评测需求 | 不变；A2 引用它 |
| `docs/ADR/ADR-012.md` | Redis 决策 | **status: active 但 0 实现 → D3 待重判** |
| 各 `PLAN-*` | 单切片执行计划 | 已完成者按 §4 标 ✅，不再作为待办来源 |
