# gate-reliability 变更记录

> 目录：`.harness/changes/gate-reliability/`，与 git 分支 `fix/gate-reliability` 同名。
> **无数据库迁移**（本次只改门禁脚本 + 规则措辞 + verify 探针，未触及任何表结构），故不含 `db-migrations.sql` / `rollback.sql`。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | gate-reliability（红线 R2 机械化补齐 + 探针退出码对齐） |
| 分支 | `fix/gate-reliability`（基于 main `b71e5d0`） |
| 需求来源 | 本会话实测发现（`docs/plans/PLAN-code-reuse-sweep-2026-11-03.md` §7 第 4 项、`docs/plans/REPORT-backend-catch-audit-2026-11-03.md` §附带发现 1） |
| 类型 | fix（门禁可靠性） |
| 涉及范围 | `scripts/audit-redlines.cjs` + 新增 `scripts/lib/swallow-catch.cjs` + `.harness/rules/编码规范.md` R2 措辞 + 2 个 Java 文件各 1 行注释 + 3 个 verify 探针 + `package.json` verify 链 + `AGENTS.md` §11 命令注释 |

## 二、需求与方案

### 现状（实测 2026-11-03）

1. `scripts/audit-redlines.cjs:51` 的 R2 正则：
   `/catch\s*\(\s*(Exception|RuntimeException)\s+\w+\s*\)\s*\{\s*[\r\n\s]*\}/`
   - **盲区①**：类型限定 `Exception|RuntimeException`，具体异常类（如 `DataIntegrityViolationException`）不报。
   - **盲区②**：`[\r\n\s]*` 不含注释，**「空块 + 一句说明」不报**——而这正是红线最想拦的「自证式放行」写法。
2. 全库实测空 catch（含仅注释）共 **2 处**，两处都合理：
   `AiChatService:348`（客户端已断连）、`GardenEnergyService:52`（唯一索引幂等兜底）。
   所以按现状扩规则 → 会得到 2 个误报，必须先有显式豁免机制。
3. 另有 3 个 verify 探针（`verify-water-rain` / `verify-water2` / `verify-garden-ambient`）打印错误但
   **不设退出码**，与已修的 6 个脚本不同族：它们输出 JSON 而非 `ERRORS:` 契约，无法被串起来判红。

### 功能点

- **F1**：R2 检出范围扩到「任意异常类型的空 catch 块，含仅注释的空块」，并引入块内显式豁免标注
  `// R2-allow: <理由>`；无标注或理由不足 8 字一律报红。
- **F2**：3 个 JSON 探针补 `ERRORS: [...]` 输出行 + `process.exitCode`，并拦掉后端不在场时的
  telemetry 噪声（与 #207 同法），使它们可被判红。

### 不做什么

- 不动非空 catch 的判定（降级/重试/清理语义不审视，那是 P2 已结论的范围）。
- 不扩到 `backend/` Python（维护模式）或 Kotlin，也不扩到 `backend/src/test` 与前端 TS（范围写进规则，避免"规则说全库、实现只扫一处"的漂移）。
- 不新增 CI job（`audit-redlines.cjs` 已是 CI 门禁；本轮把它和 `verify-harness` 一起并入 `npm run verify`，让本地 `quality` 与 CI 同口径）。
- 不改 3 个探针「元素缺席」时的退出码：现状下这三个探针在本机就是 `waterBtnFound:false` / `wateringVisible:false`，改成红会变成**永久红灯**，没人会看；改为打印 `VERIFIED:` 如实标注「本次没验到」，把判断权留给人（理由与实测见 `review.md` §五）。

### 验收标准（Given-When-Then）

- **F1-a（正例）** **Given** Java 里出现 `catch (SomeSpecificException e) { }` 空块、无豁免标注，
  **When** 跑 `node scripts/audit-redlines.cjs`，**Then** 输出含该文件行号的 R2 错误、脚本退出码非 0。
- **F1-b（豁免）** **Given** 同一空块内写了 `// R2-allow: <≥8 字理由>`，**When** 跑同一命令，
  **Then** 不报错，且在输出里能看到「R2 豁免 N 处」。
- **F1-c（存量不回归）** **Given** 当前 main 代码只有 2 处空 catch 且都已标注，
  **When** 跑同一命令，**Then** `ERRORS: []`，且输出 `R2 豁免 2/3 处` 并列出两处理由正文。
- **F1-d（豁免是预算不是通道）** **Given** 全库豁免数达到 4 处、或出现同一理由 3 处，
  **When** 跑同一命令，**Then** 分别报「超出预算 3」「同一豁免理由出现 3 处」并 exit 1。
- **F1-e（不误报举例注释）** **Given** 注释/javadoc/字符串/文本块里写着 `catch (Exception e) {}`，
  **When** 跑同一命令，**Then** 不报错（上述四类在修复前都会误报，实测见 `review.md` §一）。
- **F2-a** **Given** 后端未启动（8000 端口无服务），**When** 依次跑 3 个探针，
  **Then** 每个都打印 `ERRORS: []`、`VERIFIED:` 行如实说明是否验到目标、退出码 0。
- **F2-b（有牙齿）** **Given** 探针副本注入一个必抛 `pageerror`，**When** 跑该副本，
  **Then** 退出码 1 且 `ERRORS` 含 `PAGEERROR:`。

### 技术方案

1. 把 R2 检出抽成纯函数 `scripts/lib/swallow-catch.cjs`（`findSwallowCatches(text)`），
   便于用固定 fixture 双向验证（该报的报 / 不该报的不报）。
2. 扫描前先 `maskNonCode(text)` 把注释、字符串、字符字面量、Java 文本块整体涂成空格（长度与换行不变），
   再做正则与花括号匹配；块体掩码后只剩空白或空语句 `;` 即命中。
   —— 不做掩码会把仓库里用来举例的注释（`// 反例：catch (Exception e) {}`）当成真代码误报，
   而误报逼人删注释或加假豁免，反过来削弱门禁。
3. 豁免写成块内 `// R2-allow: <理由≥8字>`；`audit-redlines.cjs` 统计并**打印每处豁免的 loc + 理由正文**，
   同时机器校验两条限制：全库豁免 ≤ `R2_ALLOW_BUDGET`(3)、同一理由不得 ≥3 处。
4. 存量 2 处把说明注释改写成 `R2-allow: <理由>`，理由说明"为什么这个位置不能处理"。
5. 探针补 `ERRORS:` 行 + 退出码 + `VERIFIED:` 如实标注 + telemetry 204 拦截。
6. `npm run verify` 增加 `verify:redlines` / `verify:harness`，让本地 `quality` 覆盖与 CI 同口径的红线与治理门禁。

**双向论证**

- **选 A（扩范围 + 显式豁免 + 机械预算）的理由**：红线要拦的是"吞掉且无人知晓"，
  不是"catch 里没写 log"。豁免标注让每次放行都留下可 grep 的理由，预算与同因阈值把
  "自己写一句话就通过"限制成有上限、可审计的动作。
- **否 B（只扩类型、不加豁免）的理由**：立刻产生 2 个误报，等于逼人删规则或写假处理。
- **否 C（维持现状）的理由**：现状对"空块 + 注释"完全免疫，写一句注释即可永久绕过红线，
  属 §0.8⑤ 定义的"伪装成正常陈述的逃逸口"。
- **否 D（豁免要求挂 issue 编号）的理由**：本仓不使用 issue 跟踪治理项，强制编号会制造空编号；
  改成「预算 + 同因阈值」是同一目的的可核验替代。
- **反转条件**：若豁免在 3 个月内撞到预算上限且理由各不相同，说明判据过严 → 应改为按目录设预算或
  重新设计 R2 判据，而不是直接上调常量。

## 三、影响分析

- **门禁语义变化**：这是本次唯一实质变化——未来 Java 代码里所有空 catch（含仅注释）都会红，
  除非写豁免。对写法是收紧，对既有代码零影响（存量已标注）。
- **兼容性**：`audit-redlines.cjs` 的输出契约（`ERRORS: [...]`)不变，CI 解析不受影响；
  仅多一行豁免统计。
- **规则同步**：`.harness/rules/编码规范.md` R2 措辞同步为「不得为空（含仅注释）+ 豁免标注契约」，
  保持「规则=唯一权威」。已 grep 其余 4 处引用（`.claude/agents/red-line-auditor.md`、
  `biz-dev/06-exception-handling`、`main-dev/coding-skill` 检查项），均只提"禁吞异常"概念，
  不含正则或类型范围，措辞仍然成立，不改。
- **承重墙确认**：不触及 `teaAI.ts` 降级链、IndexedDB `sync_status` 同步逻辑、评分模型、3D 状态机、PWA 缓存。
- **回滚路径**：单 commit 回退即可（脚本 + 规则 + 注释），无数据副作用。

## 四、自检清单

- [x] 需求分析先行（F1/F2 + Given-When-Then + 范围边界 + 影响分析，见上）
- [x] 轨道判定：**Guided**（多文件、影响可估、可逆；未达 Controlled 的架构/数据模型/不可逆门槛，理由见上）
- [x] 编码规范红线 15 条零违反
- [x] review 通过与 🟡 清零（独立 Codex 评审已跑，2 轮：首轮 2 项不通过，修复后复核通过；记录见 `review.md`）
- [x] 测试按改动面：`node scripts/audit-redlines.cjs` + 双向 fixture（10 项）+ `node scripts/verify-harness.cjs` +
      `npm run quality` + 3 探针实跑
- [x] 无数据库迁移（本文件顶部已注明）
