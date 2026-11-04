# gate-reliability Review

> 评审对象：R2 机械化判据扩展 + 3 个 verify 探针退出码契约（分支 `fix/gate-reliability`，2 个代码 commit + 本轮修复）
> 评审方式：**独立 Codex 子代理两轮**（`dsh_code_review`），非自查转抄；逐项按命令输出核对
> 结论：**通过**，本轮引入项 **🔴 0 🟡 0**，2026-11-03
> 遗留（**非本轮引入**，本轮不修，见 §六）2 项

## 一、第一轮评审（改动前 → 评审时状态）

第一轮共 6 项，**3 项通过、1 项有条件、2 项不通过**。逐项证据与处置：

| # | 首轮结论 | 实测证据 | 处置 |
|---|---|---|---|
| 1 | ❌ 判据双向漏：5 类**误报**（注释/javadoc/字符串/文本块里写 `catch (Exception e) {}` 的举例被当真代码）+ 2 类**漏报**（`catch (E e) /* 说明 */ { }`、`catch (E e) { ; }`） | 首轮 fixture 22 例：误报 5 类全中、漏报 2 类全漏 | 已修 → §二.1 |
| 2 | ❌ 豁免是语言后门：`// R2-allow: 这里就是不想处理`（8 字）即通过；豁免不进退出码、不打印理由 → 命中 AGENTS §0.8⑤ | `swallow-catch.cjs:17,102` + `audit-redlines.cjs:58,63-65` | 已修 → §二.2 |
| 3 | ✅ 输出契约：`ERRORS: []` / exit 0/1 未破坏，CI 只消费退出码 | 注入 3 类违规 → `ERRORS: [2]` exit 1；恢复 → exit 0 | 无需改 |
| 4 | ⚠️ 探针「没验到也绿」+ 204 拦截把 telemetry 失败链移出可观测面 | 三探针实跑 `EXIT=0`，`waterBtnFound:false` 仍绿 | 部分采纳 → §二.3 |
| 5 | ✅ `await boundingBox()` 修复正确，仓内无第二处「Promise 当布尔」 | grep `scripts/**/*.cjs` 9 处 locator 调用均在 await 之后 | 无需改 |
| 6 | ❌ 规则与实现漂移：规则写了「同一理由 ≥3 处应改 helper」但实现不检查；措辞「确需不处理时」是动机式 | 对表 6 行 | 已修 → §二.2 |

## 二、本轮修复（逐项附实测）

### 2.1 判据双向可靠（首轮 #1）

`scripts/lib/swallow-catch.cjs` 新增 `maskNonCode()`：扫描前把注释、字符串、字符字面量、Java 文本块
整体涂成空格（长度与换行不变，偏移与原文一一对应），再做正则与花括号匹配；块体掩码后只剩空白或空语句 `;` 即命中。

双向 fixture（`.tmp/lead-1103-1630/probe-r2-two-way.cjs`，10 个断言）：

```
PASS  p1  want=hit  got=hit          # 空块
PASS  p2  want=hit  got=hit          # 具体异常类型 + 仅注释
PASS  p3  want=hit  got=hit          # 块体只有 ;
PASS  p4  want=hit  got=hit          # ) 与 { 之间有块注释
PASS  p5  want=hit  got=hit          # 豁免理由过短
PASS  n4  want=miss got=miss         # 字符串里的反例
PASS  n5  want=miss got=miss         # 文本块里的反例
PASS  n6  want=miss got=miss         # 正常日志体（含 "}" ）
PASS  n7  want=exempt got=exempt     # 合法豁免
PASS  n1/n2/n3（注释与 javadoc 区误报数=0 want=0）
总命中 6 处；失败 0 项
```

第二轮复核用 25 例单测 + 8 例对抗探针复验，均 PASS，并额外确认：掩码不吞真实 catch
（未闭合字符串、转义 `"C:\\"`、未闭合块注释到 EOF 三种边界均与 Java 词法一致）。

### 2.2 豁免从「自证放行」改成「有上限、可审计」（首轮 #2 / #6）

- 全库豁免 ≤ `R2_ALLOW_BUDGET`(3) → 实测 5 处时报 `❌ R2 豁免 5 处超出预算 3`，exit 1。
- 同一理由 ≥3 处 → 实测报 `❌ R2 同一豁免理由出现 3 处「…」`，exit 1。
- 每次运行打印**每处豁免的 loc + 理由正文**（不是只打 `file:line`）：
  `⚠ R2 豁免 2/3 处：…AiChatService.java:348「客户端已断连，再 emit 只会二次失败；SSE 通道已失效，无需处理」；…GardenEnergyService.java:52「并发同 client_id 记账由唯一索引兜底…」`
- 理由质量：新增 `normalizeReason()` —— 剥掉块注释尾巴 `*/`、要求 ≥8 字且**至少含 6 个文字/数字**。
  实测：`// R2-allow: ........`（8 个点）不再算豁免，回落到报红；`/* // R2-allow: 客户端已断连无需通知 */` 得到干净理由。
- 规则措辞同步（`.harness/rules/编码规范.md` R2）：删掉动机式「确需不处理时」，改成行为锚定
  「块体为空时唯一合法写法是…理由须 ≥8 字且含 ≥6 文字/数字」，并把两条机械限制与审计范围写进规则正文。

### 2.3 探针（首轮 #4，部分采纳）

新增 `ERRORS:` 契约 + 退出码 + `VERIFIED:` 行。实测：

```
verify-water-rain      → VERIFIED: no-watering-button（本次未验到浇水动画）   ERRORS: []  EXIT=0
verify-water2          → VERIFIED: no-water-button（本次未验到浇水粒子）      ERRORS: []  EXIT=0
verify-garden-ambient  → VERIFIED: page-error-free-only（视觉与 telemetry 传输不在覆盖范围） ERRORS: [] EXIT=0
注入必抛 pageerror 的副本 → 三个都 ERRORS 含 PAGEERROR、EXIT=1
```

**不采纳**「元素缺席即判红」，理由是实测数据而非偏好：本机干净 profile 下
`waterBtnFound:false` / `wateringVisible:false` 是**常态**（见 §六 遗留 1），判红会变成永久红灯，
没人会看，等于把门禁变成噪声。改为 `VERIFIED:` 如实标注「本次没验到」，把判断权留给人。

## 三、第二轮复核结论

复核对表（第二轮独立评审，逐项 PASS/FAIL）：

| # | 项 | 结论 |
|---|---|---|
| 1 | 掩码消除 5 类误报、不引入新漏报 | 🟢 PASS（25/25 单测） |
| 2 | 两类漏报（注释卡在 `)` 与 `{` 之间、`;` 空语句） | 🟢 PASS（端到端各报 1 条） |
| 3 | 豁免是否已脱离「自证」 | 🟡→🟢（预算 + 同因 + 打印理由是硬限制；残余边界已写入规则，见下） |
| 4 | 规则 ↔ 实现逐条对应 | 🟡→🟢（不对应的 3 条已修：块注释尾巴、纯标点理由、`;` 与审计范围/边界声明） |
| 5 | 探针 `VERIFIED` 如实性 | 🟢 PASS |
| 6 | `npm run verify` 接入 + AGENTS §11 同步 | 🔴→🟢（见 §四） |

### 已修复的 🟡 / 🔴

1. 🔴 `review.md` 缺失 → 本文件即该修复；`npm run verify` 因此回绿（见 §四 实测）。
2. 🟡 纯标点理由可凑长度 → `MIN_ALLOW_WORD_CHARS` 已加。
3. 🟡 块注释形式 `*/` 混进理由正文 → `normalizeReason` 已剥。
4. 🟡 规则未写明「只判空块」边界 → 规则正文末尾已加「机械化边界」一句。

### 明确保留的边界（不是缺陷，是判据范围，已写入规则与 lib 头部）

- 非空块体（含 `catch (e) { int x = 0; }` 这类 no-op）不在 R2 机械化范围，由评审覆盖。
- Java 文本块内出现转义引号 `\"""` 时掩码会提前闭合（本仓 `\"\""` 出现 0 处）。
- 理由是否为「真原因」无法机械判定；预算 + 同因阈值 + 输出打印把风险限制在「有上限、每次都看得见」。

## 四、`npm run verify` 接入后实测

```
npm run verify
  verify:static   → scan-emoji            exit 0
  verify:redlines → ERRORS: []            exit 0   （豁免 2/3，逐处打印理由）
  verify:harness  → ERRORS: []            exit 0   （本 review.md 存在 + 结论行格式合规）
  audit:context   → 47183 字符 ≈ 19499 token / 预算 19500   exit 0
```

接入后 AGENTS.md §11 的 `npm run quality` 注释同步为「提交前必跑（含 redlines/harness/预算）」。
过程中发现并修掉一处真实回归：注释初版写长导致 `audit:context` 报
`19516 > 19500`，已压到 19499（预算只差 1 token，后续任何 AGENTS.md 增量都必须先算预算）。

## 五、治理留痕（本轮自犯并已修）

首轮评审指出「`fix/gate-reliability` 分支不存在、2 个 commit 落在本地 main」。复核为真：
`git checkout -q -b` 未生效而我未校验 `git branch --show-current` 就提交了。
处置：`git switch -c fix/gate-reliability` + `git branch -f main b71e5d0`，工作区改动全部保留，
`main` 已等于 `origin/main`（`b71e5d0`），**远端从未被写过**。已按 AGENTS §13 记入 `docs/plans/lessons.md`。

## 六、遗留（**非本轮引入**，本轮不修，需另开切片）

1. `verify-water-rain.cjs` / `verify-water2.cjs` 的「若无苗则种茶」分支用 `.plant-btn-3d` / `.empty-hint`，
   而 `src/` 已无对应节点（2026-11-03 实测 0 命中），干净 profile 下两个探针**结构性验不到浇水**。
   已在两个脚本头部写明失效与后果，并在尾部用 `VERIFIED:` 如实披露。修它需要重做播种流程（拖拽/接口），
   属另一问题域。
2. `page.route('**/v1/telemetry/batch', …204)` 只拦一条路径，探针内看不到 telemetry 的失败/退避/熔断链；
   `verify-garden-ambient.cjs` 头部已声明「telemetry 传输不在覆盖范围」。

## 七、结论

**通过**：本轮引入项 **🔴 0 🟡 0**。判据双向可靠（该报的报、举例注释不误报）、豁免有上限且每次可见、
规则与实现逐条对应、探针退出码有牙齿（注入 `pageerror` 三个都 exit 1）。
§六 两项是既有缺陷，已在脚本内如实披露，不在本切片修复范围。
