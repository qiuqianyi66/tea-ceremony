---
last_updated: 2026-11-03
status: active
owner: yanha
---

# 全项目复用收敛规划（2026-11-03）

> 交接件。上一轮（PR #186 / #187 / #203 / #204）只做了 `src/` 展示层的 4 类字面重复，
> 后端 24k 行、scripts 7.7k 行一行没碰。本规划把剩余工作拆成 4 轮，每轮独立 PR、可单独止损。

## 0. 起点：已做完的 vs 没做的

**已做**（勿重复）：`src/` 的毛玻璃面板 21 处 → `Card`、分区标题 10 处 → `SectionHeader`、
日期 5 处 → `formatDateShort`、数值夹取 21 处 → `clamp`。细节与"有意不动"清单见
`docs/code-reuse-audit-2026-11-02.md`。

**没做**（本规划覆盖）：

| 区域 | 规模 | 摸底结果 |
|---|---|---|
| `scripts/` | 66 个 .cjs / 7,727 行 | **手写目录遍历 25 处 / 12 文件**、`fs.readFileSync` 63 处 |
| `backend/` Java | 261 文件 / ~18k 行 | **catch 块 67 处 / 33 文件**、`log.*` 72 处 / 31 文件 |
| `src/` 深层 | services 58 + stores 10 + composables 15 | 跨文件同名导出函数 **0 个**（字面不重复，语义待读） |
| `src/` 散落模式 | — | `localStorage` 20、`setTimeout` 30、`new Date` 32、`try/catch` 13、`console` 17 |
| `backend/` Python | 47 文件 / ~6k 行 | 维护模式，**不做**（AGENTS.md：旧 FastAPI 仅维护不新增） |
| `.agents/` | 923 文件 / 127k 行 | 第三方技能库，**不是项目代码，不做** |
| `docs/` | 223 文件 / 51k 行 | 文档重复是内容问题，**不做** |

## 1. 优先级怎么定的

不是按"哪块代码多"，是按 **确定性 × 风险倒数**：

1. **`scripts/` 第一**：重复是机械的（25 处 `function collect()` / `readdirSync` 几乎逐字雷同），
   提取成共享模块零业务风险，且每个脚本都有明确退出码可验证。
2. **后端 Java 第二**：`catch` 块 67 处 / 33 文件密度最高，但涉及异常路径，风险中。
3. **前端语义第三**：`services/` 字号层面无重复函数名，真实重复需人读判断，收益不确定。
4. **散落模式第四**：数量大但单点收益小，放最后。

## 2. 四轮规划

### P1 — `scripts/` 共享工具层（最低风险，最高确定性）

**目标**：66 个审计脚本不再各写一遍目录遍历、报告头、退出码。

**现状证据**：`function collect(` / `function walk(` / `readdirSync` 共 25 处，散在 12 个文件；
`console.log('===` 报告头 7 处；`process.exit(` 55 处 / 35 文件。

**动作**：
1. 新建 `scripts/lib/`，先放三个模块：
   - `fs-utils.cjs`：`collect(dir, exts, {exclude})`、`readText(file)`、`walkDirs(dir)`
   - `report.cjs`：`heading(title)`、`fail(msgs)`、`ok()`（统一 `ERRORS: []` + exit code）
   - `cli.cjs`：`parseFlags(argv)`（各脚本重复的手写参数解析）
2. **一个脚本一批**改造，每批独立 commit。先挑 `verify-harness.cjs` 这类高频执行的验证（跑一次就回归一次）。
3. 每改完一批，跑该脚本并与改造前的输出**逐字 diff**（同输入必须同输出，除行号/时间戳）。

**验收**：`ERRORS: []` 的脚本改造前后 stdout 完全一致；`npm run quality` 全绿。

**止损**：若某脚本改造后输出有差异且无法解释，该脚本回退，只保留已通过的部分。

**预估收益**：净减约 300–500 行，12 个文件受益。

### P2 — 后端 Java 错误处理与日志收敛

> **状态：已关闭（2026-11-03，PR #208）。** 实测 A 类（catch 后转 `ApiResponse` 返回）**0 处**，
> 没有可删的重复包装；B 类 11 处逐条有据，C 类 54 处是刻意的降级/跳过边界。
> 结论与全量清单见 `docs/plans/REPORT-backend-catch-audit-2026-11-03.md`。
> **下面这段保留作摸底记录，不要再照做一次。**

**目标**：67 处 `catch` 块、72 处 `log.*` 收敛到统一约定。

**前置调查已完成（2026-11-03 实测，动手前请复核是否仍成立）**：

- **已有 `GlobalExceptionHandler`**：`src/main/java/.../GlobalExceptionHandler.java` 上是
  `@RestControllerAdvice`，含 8 个 `@ExceptionHandler`（BusinessException / MethodArgumentNotValid /
  HttpMessageNotReadable / MethodArgumentTypeMismatch / HttpRequestMethodNotSupported /
  NoResourceFound 等）。
- **异常家族完整**：`BusinessException extends RuntimeException` + 6 个子类
  （BadRequest / Unauthorized / NotFound / Conflict / BadGateway / QuotaExceeded）。
- **`ApiResponse<T>` 已存在**，但全库只有 1 处显式 `ApiResponse.ok(` —— 说明 Controller 大多直接
  return 对象，包装方式需确认（可能是全局序列化或另有约定）。

**结论改变了 P2 的性质**：不需要建全局处理（已存在），问题是**已有全局处理，但 33 个文件里还有
67 处本地 `catch` 在做重复包装**。这是典型的"基础设施就绪、调用方没跟上"，收益和高确定性都比
预想高。

**动作**：
1. 出「重复清单报告」（只读，不改代码）——列出 33 个文件的 catch 块，按模式分组：
   - A 类：catch 后转 `ApiResponse` 返回 → 大概率该删（交给 GlobalExceptionHandler）
   - B 类：catch 后重抛成 `BusinessException` 子类 → 保留但可能重复
   - C 类：catch 后降级/重试/清理资源 → **必须保留**，别动
2. 人工确认每类归属，A 类优先处理。
3. 分 3–5 批改，每批跑 `cd backend && mvn -q test` + ArchUnit `LayerDependencyTest`。

**验收**：`mvn test` 全绿（含 Testcontainers）+ ArchUnit 分层测试通过 + 手测一次错误响应体
（4xx/5xx 的 `{code, message}` 形态不变）。

**止损**：任一批测试失败且 30 分钟内定位不到根因 → 该批回退。

**注意**：16 Controller / 21 Service / 18 Repository，先确认分层现状再动，别按新项目习惯重排。
C 类（降级/重试/资源清理）**一律不动**——那是有意的边界处理，删了会引入真 bug。

### P3 — 前端语义复用（先出报告，再决定改不改）

**目标**：`services/` 58 + `stores/` 10 + `composables/` 15 文件里的**语义**重复。

**关键事实**：跨文件同名导出函数 **0 个**——说明没有字面重复，grep 扫不出东西。必须人读。

**动作**：
1. 用只读方式（子 agent 并行读，别污染主上下文）产出一份「同构清单」：
   - `services/api/`（auth/garden/records/teas）：4 个模块的请求封装是否雷同
   - `services/storage/`（8 模块）：读写 IndexedDB 的模式是否雷同
   - `stores/` 10 个：状态+actions 结构是否雷同
   - `composables/` 15 个：生命周期/清理逻辑是否雷同
2. 报告列出「雷同点 + 建议合并方式 + 预估收益 + 风险」，**不改代码**。
3. 人拍板后再执行，按目录分批。

**验收**：先交付报告；改代码时 `npm run test` 全绿 + 逐批 type-check。

**止损**：若读完发现重复度低于 20%，直接结论"不值得动"，结束 P3。

### P4 — 前端散落模式收尾

按收益排序，逐项独立 PR：

1. `localStorage` 直用 20 处 / 6 文件 —— **先判定**：`services/authStorage.ts`、`services/storage/db.ts`、
   `telemetry/identity.ts`、`stores/theme.ts` 本身是存储层，不该改；只有 `src/test/setup.ts` 之外的
   业务直用才是问题。上一轮已判定"不动"，本轮需重新逐处核实是否真有业务侧直用。
2. `try/catch` 13 处 / 8 文件 + `console.error/warn` 17 处 / 10 文件 —— 收敛到统一错误处理约定
   （先读 `services/errorBuffer.ts` 是否已是该约定）。
3. `new Date()` 32 处 / 18 文件 —— 只收「格式化」用途，时间戳比较不动。
4. `setTimeout` 30 处 / 20 文件 —— **已验证全是时序编排/请求超时，不是防抖**（见审计报告 §四），
   本轮大概率整项跳过，别硬套 `debounce`。

## 3. 每轮通用验证（AGENTS.md §5 Modification Level）

| 改动类型 | 必跑 |
|---|---|
| `scripts/` | 该脚本本身 stdout 逐字 diff + `npm run quality` |
| 后端 | `cd backend && mvn -q test` + ArchUnit |
| 前端逻辑 | `npm run test` + type-check |
| 前端 UI | 额外：像素对比（带状态，见下） |

**视觉回归的坑（务必照做）**：对比前先满足路由守卫的前置状态，中途不得再 `goto` 同一路由
（整页刷新会重置 Pinia）。详见 `docs/plans/lessons.md` 2026-11-03 三条。**「IDENTICAL」前先确认
目标元素真的渲染了**——首轮 8 页"全绿"就是假绿。

## 4. 明确不做

- `backend/` Python 47 文件：维护模式，只维护不新增。
- `.agents/` 923 文件：第三方技能库。
- `docs/` 51k 行、`.harness/` 6.7k 行：文档/治理内容重复≠代码复用债。
- `e2e/` 16 文件 / 759 行：体量小，等 P3 报告再定。
- 上一轮判定的 9 类（`rounded-2xl` 面板、标签胶囊、空态、`clearTimeout`、`localStorage` 直用等）
  ——理由见审计报告 §四，不重新讨论。

## 5. 新会话怎么开工

1. 读本文件 + `docs/code-reuse-audit-2026-11-02.md`（前一轮的判据与保留清单）。
2. 读 `AGENTS.md` §4 分诊：P1 属 **Guided**（多文件、影响可估）；P2 若涉及新建 GlobalExceptionHandler
   属 **Controlled**（架构改动，需 ADR + 确认）；P3 只出报告属 **Fast**。
3. 开工前先 `git log --oneline -5` 确认没人在同期改同一批文件。
4. 每轮独立分支 + PR，CI 14 job 全绿才合。main 受保护，禁直推。
5. 若发现本规划的摸底数据已失真（代码演进），**重新摸底再动手**，别信这份快照。

## 6. 摸底数据快照（2026-11-03，供新会话对照）

```
src        248 文件 / 29,828 行   （.vue+.ts 排除 tests = 169 个）
backend    384 文件 / 23,919 行   （Java 261 / Python 47）
scripts     91 文件 /  7,727 行   （.cjs/.js = 66 个）
docs       223 文件 / 51,617 行
.harness   160 文件 /  6,675 行
.agents    923 文件 /127,486 行
e2e         16 文件 /    759 行

scripts: collect|walk|readdirSync 25 处/12 文件；fs.readFileSync 63 处/30；process.exit 55 处/35
backend Java: catch 67 处/33 文件；log.* 72 处/31；BusinessException 47 处/20；@Transactional 46 处/17
backend Java 结构: @RestController 16 / @Service 21 / Repository 18
src/services: 跨文件同名导出函数 0 个（语义重复需人读）
src 散落: localStorage 20、setTimeout 30、new Date 32、try-catch 13、console 17、as unknown as 4
```

## 7. P1 已执行 + 快照修正（2026-11-03 实测复核）

P1 已完成（分支 `refactor/scripts-fs-utils`，6 commit）。执行时发现本文件 §6 快照有两处失真，
按 §5 第 5 条「失真则重新摸底」以实测为准：

| 项 | 快照写的 | 实测 |
|---|---|---|
| `scripts/` .cjs/.js | 66 个 / 7,727 行 | **63 个 / 6,146 行** |
| 递归目录遍历重复 | **25 处 / 12 文件** | **6 处 / 6 文件** |

**为什么是 6 不是 25**：25/12 是 `readdirSync` 的计数，其中 15 处是一次性扁平读目录
（`readdirSync(x).filter(...)`，本身只有 1–2 行），另 4 处是不同契约的遍历
（`gen-repomap.cjs` 要 `{path, dir}` 记录 + 深度限制 + 排序，不是文件收集器）。
真正逐字雷同的递归收集器只有 6 个：`audit-redlines` / `audit-wiki-drift` / `verify-harness`
/ `add-doc-meta` / `scan-emoji` / `verify-alert-rules`。

**实际收益不是行数**：7 文件 +72/−71 = **净 +1 行**（§2 P1 预估「净减 300–500 行」不成立）。
收益是 6 份遍历合并成 1 份、排除集以后只改一处。验收按 §2 原定标准执行：
6 个脚本改造前后 stdout **md5 逐字一致**，退出码不变。

**P1 顺带查出四个未列入本规划的问题**（1–3 已修，4 需拍板）：

1. **已修（PR #212）**：`npm run quality` 在本机（干净的 main）上红 5 个测试，全在 `tracking*.spec.ts`。
   **根因不是测试写坏，是产品代码竞态**：`initDB()` 用「完成后才置位的布尔标记」做守卫，
   并发调用会一起进 `db.open()` 与一次性迁移，迁移期间的读写与 `clear()` 交错 → 计数断言
   「expected 0 received 1」；墙钟性能断言是同因（额外的 open/迁移推高耗时）。
   实测：旧实现下 3 个并发调用触发 **3 次** `db.open()`；改成缓存 Promise 后连续 **3 次全量
   44 文件 381 测试全绿**（改前每次全量都稳定 5 红）。新增 `db.init.spec.ts` 有牙齿
   （旧实现下断言 `toHaveBeenCalledTimes(1)` 实测得到 3 → 失败）。
2. **已修（PR #207）**：9 个 `verify-*.cjs` 打印 `ERRORS: [...]` 却不设非零退出码 →
   `npm run verify:ui` 用 `&&` 串联时永远报成功（假绿）。修了其中 6 个。
   **关键坑**：只加退出码会把 telemetry 噪声算成失败——后端不在场时
   `localhost:8000/api/v1/telemetry/batch` 上报失败会往错误桶塞 2 条 `ERR_CONNECTION_REFUSED`
   （实测 `verify-gardens` 8 条、`verify-pavilion` 每产区 2 条）。拦法实测：
   `route.abort()` 反而变 6 条 `ERR_FAILED`；`route.fulfill(204)` 才是 0 条。
   另注意 `**/api/**` 宽匹配会误伤 `/src/services/api/index.ts` 模块请求，只能精确匹配
   `**/v1/telemetry/batch`。
3. **已修（PR #211）**：`verify-gardens` 自启 dev server 后收不干净——运行结束 5173 仍被 node 占用。
   两个 bug：①`stop: child.kill()` 在 Windows 上只杀 `cmd.exe`，vite 的 node 子进程活着 → 改
   `taskkill /pid <pid> /T /F` 按进程树杀；②`portListening` 探 `127.0.0.1` 而 `waitForServer` 用
   `http://localhost`（Windows 可能先解析 `::1`），vite 只监听 `::1` 时被误判未启动 → 默认 url 统一
   `127.0.0.1`。验证：冷跑 exit 0、`ERRORS: []`、跑完端口已释放。
4. **待拍板**：`audit-redlines` 的 R2（禁 catch 吞异常）正则
   `/catch\s*\(\s*(Exception|RuntimeException)\s+\w+\s*\)\s*\{\s*[\r\n\s]*\}/`
   有两处盲区：①类型限定 `Exception|RuntimeException`，具体异常类不报；②`[\r\n\s]*` 不含注释，
   **「空块 + 一句说明」不报**——而那正是这条红线最想拦的「自证式放行」写法。
   全库实测只有 **2 处**空 catch（含仅注释）：`AiChatService:348`（客户端已断连）、
   `GardenEnergyService:52`（幂等唯一索引兜底），**两处都合理**。所以现在扩规则会得到 2 个误报，
   必须先定 allowlist 机制（如 `// R2-allow: <理由>`）再动，否则不要改。
