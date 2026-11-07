---
last_updated: 2026-11-07
status: active
owner: yanha
---

# 技能编写指南（加载机制 / 七步写法 / 量化验收）

> 本文回答「怎么写出一个能被正确加载、也能被正确选中的技能」。
> 治理流程（目录组织、导入甄别、增删改流程）仍以 `.harness/rules/技能规范.md` 为唯一权威；本文只补它没讲的两块：**加载机制的真实行为**与**可量化的写作判据**。
> 分层名单与升降判据看 `docs/reference/skill-layering.md`；可执行化现状看 `docs/reference/skill-tooling-audit.md`（生成物，禁手写追加）。

## 一、技能到底在什么时候被加载

```
会话开始
  └─ L1 元数据（name + description）→ 常驻 listing，模型在这一层"选"
        │  上限约上下文 1%（200k 窗口 ≈ 20-22 条），超出按 LRU 丢弃
        ├─ 未命中 ────────────────────────→ 技能对本次任务不存在
        └─ 命中
             └─ L2 SKILL.md 全文 → 注入上下文（建议 <5k token / ≤300 行）
                   └─ L3 正文点名的资产
                        ├─ scripts/  → 执行，不读进上下文（零 token 成本 + 确定性）
                        ├─ references/ → 按需再读，占用上下文
                        └─ assets/   → 不进上下文，只作产出素材被使用
```

| 层 | 内容 | 何时载入 | 谁决定 |
|---|---|---|---|
| L1 | `name` + `description`（约 100 token/条） | 会话开始即常驻 | 客户端扫描技能根后注入 |
| L2 | `SKILL.md` 正文 | 技能被选中之后 | 模型 |
| L3 | `scripts/` `references/` `assets/` | 正文点名且真的需要 | 模型 / 执行器 |

三条由此推出的硬事实：

1. **正文里的「何时使用」对模型无用**——正文在触发后才加载。一切触发信息只能写进 `description`。
2. **`scripts/` 是唯一零 token 成本却拿到确定性结果的载体**——这就是「可执行化」比「把正文写得更详细」更值钱的原因。
3. **资产存在但正文不点名 = 永不加载**。修复方式是在正文里加「确定性入口」段逐个点名（本库实测过这个失效）。

### tea 的两个通道

- **通道 ①（自动）**：`.agents/skills` 声明在技能根内，客户端可扫描。实际注入条数取决于客户端实现，**本项未复核**，可确认的只有「声明了该根」。
- **通道 ②（检索）**：`AGENTS.md §4` 第 2 步要求先判「流程驱动还是任务驱动」，再查 `.agents/skills/README.md` 或四族 README 定位，最后 `Read` 对应 SKILL.md。成本是路由表 + 一份正文，**不受 20 条上限约束**。硬约束是「README 不列 = 技能不存在」，由 `verify-harness` §4n 机械校验（只校验登记有无，不校验登记是否准确）。

这让分层成立：活跃 20 条（2222 字符 ≈ 1051 token）去抢通道 ①；其余 89 条靠通道 ② 按需进入。全库 108 条（19922 字符 ≈ 6410 token）若全摊开，单条只剩约 1/3 的信息量。

## 二、七步写法

### Step 0 · 先判该不该是技能

问「这是常驻约束，还是按需能力？」

| 性质 | 落点 |
|---|---|
| 每次都要遵守的约束 | 规则（`AGENTS.md` / `.harness/rules/*.md`），全量常驻 |
| 只在特定任务才需要的能力/流程 | 技能，按需加载 |
| 需要确定性执行或反复重写 | 脚本（工具层），执行但不参与推理 |

禁止把技能内容抄回规则文件（`三层语义.md` 红线 1）；禁止把规则红线原文抄进技能正文，只引用编号（如 R11）。

### Step 1 · 单一职责 + 定位

- 一个技能只干一件事；超过 300 行就拆。
- 动手前 `grep` 全库与项目外技能根，确认不重复（禁重复造轮子）。
- 跨栈同名允许但必须标注差异：`db-migration` 双轨（`.agents/skills/db-migration` 走 Alembic / `.harness/skills/biz-dev/09-db-migration` 走 Flyway），按 `AGENTS.md §8` 选路。
- 目录：通用扁平 `.agents/skills/<name>/`；流程族 `.harness/skills/<family>/<NN-name>/`，**编号禁改**。

### Step 2 · 写 description（全篇最值钱的一行）

句式：

```
<做什么>——<只属于本技能的术语/边界>。当<具体场景>时用。
```

硬指标：

| 指标 | 阈值 | 为什么 |
|---|---|---|
| 长度 | ≤200 字符 | 活跃 20 条共 2000 token 预算，单条 100 token 就吃掉 20% |
| 语言 | 中文（中文用户环境） | 跨语种匹配是额外失败面 |
| 独有词占比 | ≥50% | 低于此说明信息被模板套话稀释，只能靠后半段区分 |
| 触发句 | 必须有「当…时用」/「触发：」 | 否则清单无法机械校验 |

独有词的定义：一条 description 的词元里，只在它自己出现的词元占比。诊断：

```bash
node scripts/audit-skill-routing.cjs
```

实测对照（同一轮改动）：

| 技能 | 改前 | 改后 | 原因 |
|---|---|---|---|
| `vue-component` | 18.5% | **46.2%** | 原 27 个词元只有 5 个专属 |
| `fastapi-endpoint` | 20.6% | **57.6%** | 原与前者共用「为一盏茶项目生成符合规范」 |

为什么用独有词而不用相似度：全库两两字符 bigram 相似度实测 **1505/5886 对 ≥0.2**，Top 全是 `threejs-*` 共用前缀造成的假阳性——该指标在本库不可用。

禁止：把正文大纲抄进 description；超过 3 句；没有触发场景。

### Step 3 · 写正文（四段固定结构）

```markdown
# <技能名>

## 触发条件
<什么算命中，一句话。>

## 前置条件（硬门，缺失回退）
<要读哪些文件、依赖什么环境；缺失时退到哪一步。>

## 规则 / 流程
1. <可执行步骤>
2. <可执行步骤>

## 确定性入口
- <用途>：`node scripts/xxx.cjs`（参数与期望输出）
- <用途>：`npm run yyy`

## 检查清单
- [ ] <交付前必须打勾的项>
```

- ≤300 行。超了把变体、长参考、罕见分支移进 `references/`，正文只留核心流程与「什么时候读哪个文件」。
- 段落写用户的语言、句子简短；结构超过 3 个部分就配 ASCII 图。
- 不写「我会帮你…」这类开场白，直接给规则。

### Step 4 · 资产按用途分三处

| 目录 | 放什么 | 是否进上下文 |
|---|---|---|
| `scripts/` | 需确定性、会被反复重写的执行 | 否（只执行） |
| `references/` | 边做边要查的文档（schema / 政策 / API） | 是（按需） |
| `assets/` | 只进产出的素材（模板 / 图标 / 字体） | 否 |

- 引用只嵌一层，全部从 SKILL.md 直接链出；>100 行的参考文件顶部给目录，>10k 字的给 grep 模式。
- 同一信息只存在一处（正文或 references 二选一），否则两份会漂移。

### Step 5 · tea 特有字段

```yaml
type: executable | knowledge | flow   # §4f 校验值域
verification: node scripts/xxx.cjs    # type: executable 必填，必须真能跑
last-reviewed: 2026-11-07             # 必填（executable），超 180 天 warning
disable-model-invocation: true        # 仅用户手动触发（如 plan-control）
```

「可执行」只认真实工具：`node` / `npm` / `npx` / `git` / `python` / `mvn` / `vitest` / `pytest` / `curl` / `docker`。中文动词「运行 / 执行 / 跑」**不算**——曾把 `@Scheduled(cron=...)` 注解计成命令步骤，导致 8 个技能虚高。

### Step 6 · 登记（README 不列 = 不存在）

- 路由表：`.agents/skills/README.md` 或族 README，一行**中文**描述（面向人，不照抄 frontmatter）。
- 项目规则类技能另建 `docs/skills/<skill>.md` 人读审查页：它管什么 / 何时用与不用 / 审查要点 / 怎么知道它在生效。导入包不配。
- 改动记一行到 `docs/plans/lessons.md`。

### Step 7 · 过五关

```bash
node scripts/verify-harness.cjs        # 期望 ERRORS: []
node scripts/audit-skill-tooling.cjs   # 期望 孤儿 0、跨技能死链 0
node scripts/audit-skill-routing.cjs   # 独有词 ≥50%、预算 ≤2000
node --test scripts/tests/*.node-test.cjs
npm run verify
```

最关键的一条：**`verification` 必须真跑过一次**。实走 `05-rag-quality` 那次才发现，正文工作流第 4 步「抽查集命中率对比」早就有现成脚本在做，正文却没点名——不跑永远发现不了。

## 三、外部三家：借什么、不借什么

| 来源 | 借用 | 不借 |
|---|---|---|
| Anthropic `skill-creator` | 三级渐进披露；自由度分级（脆弱流程给死脚本、开放判断给启发式）；正文不写「何时使用」；不造 README / INSTALLATION_GUIDE 这类 clutter | trigger eval（20 query + 60/40 分割 + 每查询跑 3 次）——要真调模型，tea 不接 |
| SWEStash routing benchmark | accept-set 判分；拿 committed baseline 比增量而非设绝对阈值；它公开承认「早前全绿是假的，因为被测 agent 读到了带答案的数据集文件」→ 自评先查测试与被测对象是否同源 | 142 case 的规模 |
| 官方 context engineering | listing 约 1% 上限，决定了必须分层 | — |

tea 的立场：**文本可判定项用脚本测，行为可判定项（模型会不会真的触发）不假装能测**。`audit-skill-routing.cjs` 末尾明确写了这条边界。

## 四、失败模式（本库真实踩过的）

1. 把分层契约写进 `--write` 生成物 → 下次生成即消失。手写契约放独立文件。
2. 用 `| Select-String` 后读 `$LASTEXITCODE` → 拿到管道退出码，曾误判门禁「不阻断」。改 `node ... > $null 2>&1` 再读。
3. 临时降阈值做反例验证后忘记恢复（`ENFORCE_SINCE` / `UP_THRESHOLD` 都踩过）。
4. 给导入包改 description → 上游同步即冲掉，只能登记为已知限制（`frontend-design` / `shadcn` 纯英文 0% 中文属此类，未修）。
5. 正文不点名脚本 → 资产存在也永不加载。
6. 样本不足时按 0 计 → 得出「20 个活跃技能全该降」的荒谬结论。取不到数就报「未测」。

## 五、验收清单

- [ ] 目录名 = `name`，kebab-case，编号未被改动
- [ ] `description` ≤200 字符、中文、含触发句、独有词 ≥50%
- [ ] 正文四段齐、≤300 行、无「何时使用」段（已并入 description）
- [ ] 所有 `scripts/` 都在「确定性入口」点名；`references/` 写明何时读
- [ ] `type` / `verification` / `last-reviewed` 满足 §4f、§4i
- [ ] 路由表已登记（`verify-harness` §4n 能通过）
- [ ] `verification` 命令真跑过、exit 0
- [ ] 五关全绿、`node --test` 无新增失败
