---
last_updated: 2026-11-06
status: active
owner: yanha
---

# 技能分层契约（活跃层 / 储备层）

> 本文只定「谁优先进上下文」与「怎么升降」。技能全量与触发条件看两份 README（`.agents/skills/README.md` + 四族 README），可执行化现状看 `docs/reference/skill-tooling-audit.md`。

## 为什么分两层

客户端每会话把每条 `description` 的元数据常量级注入，模型只在这些元数据里选技能。tea 实测（2026-11-07，口径 ASCII/3.8 + CJK/1.5，与 `audit-context-budget` 一致）：活跃层 20 条 2222 字符 ≈ **1051 token**，全库 108 条 19922 字符 ≈ **6410 token**，而可用预算约 2K token。**全量摊开 = 每条都变薄**，所以分两层：活跃层争取被选中，储备层按需响应。

## 活跃层（20 个）

| 族 | 技能 |
|---|---|
| main-dev（10） | request-analysis、coding-skill、agent-eval、quality-audit、session-handoff、arch-deepen、retro、unit-test-ci、tea-voice、caveman-review |
| 通用（8） | db-migration、plan-control、frontend-design、fastapi-endpoint、vue-component、tea-tasting、shadcn、design-md-collection |
| biz-dev / prompt-templates（2） | 18-3d-scene、01-feature-dev |

## 储备层（其余 89 个）

储备 ≠ 废弃。它们的 `description` 仍是元数据的一部分，能被模型按需选中；差别只在**没有专门的入口段和踩坑段**，激活与否取决于真实任务是否点到它。

## 升降判据

| 方向 | 条件 | 动作 |
|---|---|---|
| 升 | 储备技能被真实任务点名 ≥ 3 次（`npm run audit:skill-usage` 切片记录可查） | 进活跃层，补「确定性入口」与「踩坑」 |
| 降 | 活跃技能连续 3 个切片零调用，且有同类技能覆盖 | 退储备层，删入口段 |
| 不升 | 技能无可对应脚本，且属纯流程 / 纯参考 | 标 N/A，不硬凑入口 |

**判据必须是记录，不是印象。** `audit-skill-usage` 当前统计 39 个切片、1 条技能记录（2026-11-07 批 G 产出首条：`rag-quality`）——剩下 38 条是「未留痕」，不是「88 个没用」。降判据的最小样本是 3 个有留痕切片，现在只有 1 个，所以本轮不动名单。

体检命令：`node scripts/audit-skill-layering.cjs`（读本文活跃层名单 + 切片留痕，输出升降候选；样本不足时显式报「未测」而非按 0 计）。

## 当前实测（2026-11-06）

| 指标 | 值 |
|---|---|
| 活跃层元数据 | 20 条 2222 字符 ≈ **1051 token**（预算 ≤ 2000；口径 ASCII/3.8 + CJK/1.5） |
| 活跃层确定性入口 | **16 / 20**（N/A 4：request-analysis、caveman-review、design-md-collection 无脚本可挂；shadcn 用 `npx`，不计入 `scripts/` 口径） |
| 活跃层踩坑段 | **14 / 20**（N/A 6：`lessons.md` 未点名，不编造） |
| 全库 | 109 技能 / 58 脚本；可执行 21、半可执行 12、纯文档 76；孤儿 0 |

## 路由可区分性（2026-11-07 实测）

外部基准先摆出来，免得把「没被触发」误判成「技能写得差」：

- Claude Code 把 `name` + `description` 注入 listing，**上限约上下文 1%（200k 窗口 ≈ 20-22 条）**，超出按 LRU 丢弃——这解释了为什么茶库 108 条里大多数对自动触发不可见。
- 社区实测自动触发命中率 **45%~84%**（依提示词与 hook 做法波动），即「触发是概率事件」。
- 因此「某个技能从没被调用」既可能是描述问题，也可能只是没轮到。判据必须落到**记录**与**文本可判定项**上，不能落到印象。

不做真触发评测的原因：Anthropic skill-creator 与 SWEStash routing benchmark 都是真调模型、每查询跑 3 次取触发率、按 accept-set 判分。tea 不接外部模型调用，用规则近似触发率是假验证，故只做文本层可判定项。

跑 `node scripts/audit-skill-routing.cjs`，当前结果：

| 指标 | 值 |
|---|---|
| 活跃层元数据 | 20 条 2222 字符 ≈ **1051 token**（预算 2000） |
| 独有词比例最低 | **43.8%**（`db-migration`，改前最低是 `vue-component` 18.5% / `fastapi-endpoint` 20.6%） |
| 超 200 字符 | 3 条（`frontend-design` 204 / `shadcn` 203 / `design-md-collection` 225） |
| 非中文主导且无中文触发句 | 2 条（`frontend-design` / `shadcn`，属导入包，改动会被上游同步冲掉，本轮未动） |
| 共用开头模板 | 0（原 `fastapi-endpoint` / `vue-component` 共用「为一盏茶项目生成符合规范」，已各自领域化） |

「独有词比例」的定义：一条 description 的词元里，有多少只在它自己出现。比例低 = 信息被公共套话稀释 = 模型只能靠后半段区分。这比「相似度」稳——实测全库两两相似度有 1505/5886 对 ≥0.2，Top 全是 `threejs-*` 共用前缀造成的假阳性。

## 路由表成本（2026-11-08 实测）

按需层不是免费的。通道 ② 要求「先读路由表定位技能」，这笔开销按任务付，此前没有任何预算口径管它：

| 项 | 改前 | 改后 |
|---|---|---|
| `.agents/skills/README.md` 主表 | **2241 token** | **1485 token** |
| Three.js 分册 `threejs-INDEX.md` | 不存在（31 条全在主表） | 930 token，只在真动 three.js 时读 |
| 四族 README 合计 | 2362 token | 不变 |
| 非 3D 任务实际支付 | 2241 | **1485**（省 734） |
| 3D 任务实际支付 | 2241 | 1485 + 930 = **2415**（多 174） |

结论是 trade-off，不是无条件变好：主表的 31 条 three.js 明细占了主表约七成 token，而项目日常 3D 走 TresJS（`18-3d-scene`），绝大多数任务用不到。把明细搬去分册后，非 3D 任务省 734 token/次，3D 任务多付 174。

**分册机制**：主表只留族指针，明细放 `threejs-INDEX.md`。三道校验（§4d 路由表双向核对、§4h 死技能审计、§4n 登记检查）统一走 `readWithSubindex()`——顺着主表里的 md 链接读分册，排除 `SKILL.md`（技能正文不算登记），只查一层、结果缓存。不这么改，把明细搬出去就会被判成 31 个死技能（本轮实测：未加的分册解析时 `ERRORS: [32]`）。

反向验证：从分册删掉 `threejs-bloom` 一行 → exit 1 且报「未列入路由表 README」；恢复 → 0。

## 维护

- 改活跃层名单 = 改本表 + 对应技能的入口段，两处必须一起改。
- 四族 README 与 `.agents/skills/README.md` 保持全量可查（README 不列 = 技能不存在，`verify-harness` §4d/§4h/§4n 会报错）；明细允许下沉到二级分册（如 `threejs-INDEX.md`），但分册必须由主表以 md 链接点名，否则等于没登记。**分层只标在本文，不在 README 逐行打标**，避免两份清单漂移。
- 本文不进常驻层。`AGENTS.md` 只指向技能路由表，不复制名单。
