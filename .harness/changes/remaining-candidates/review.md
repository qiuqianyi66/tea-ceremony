# Review: feat/remaining-candidates（茶园读路径 E2E + eval-harness 内容级判定 + README 补登记）

> 评审日期 2026-11-04，分支 feat/remaining-candidates，基线 main@28a0664。
> 覆盖范围：e2e/garden-sync.spec.ts、scripts/eval-harness.cjs、scripts/tests/eval-schema-content.node-test.cjs、scripts/README.md。
> **⚠ 覆盖不全**：未跑 Playwright E2E（需 dev server），E2E 行为以静态审查 + 对照已有 spec 判定。

---

## Findings

### 🔴 阻断（2 条）

**R1. `adrVerdict` 内容级分支因 `root` 作用域错误静默失效**
- **位置**：`scripts/eval-harness.cjs` L64-80（`adrVerdict`）与 L105（`const root = path.resolve(__dirname, '..')`）
- **问题**：`root` 定义在 `if (require.main === module) { ... }` 块内（L105），是块级作用域 `const`。当模块被 `require`（非直接执行）时，`root` 未定义。`adrVerdict` L72 引用 `path.resolve(root, f)` 抛 `ReferenceError: root is not defined`，被 L75 `catch { return false }` 静默吞掉。**结果：内容级 SQL 判定在所有 `require` 调用场景下永远返回 `false`，新功能完全失效。**
- **证据**：
  - `node -e "const {adrVerdict}=require('./scripts/eval-harness.cjs'); ..."` 对含 SQL 的文件返回 `{applicable: false, touchesSchema: false}`（应为 `true`）。
  - 复制 `adrVerdict` 逻辑到独立脚本（`root` 在模块级）→ 返回 `true`，证明逻辑本身正确，仅作用域错。
  - `probe22.cjs` 用 `Function` 构造器提取模块头：`return { root }` 抛 `ReferenceError: root is not defined`。
- **FIX**：把 `const root = path.resolve(__dirname, '..');` 移到 L13（模块顶层，`function adrVerdict` 之前），或改 `path.resolve(__dirname, '..')` 在函数内计算。
- **See**：AGENTS §0 第 3 条「绝不编造」；测试注释「这里只验逻辑层，真文件在 CI 覆盖」掩盖了这个 bug。

**R2. `eval-schema-content.node-test.cjs` 第 5 例（adrVerdict 内容级）测试有名无实**
- **位置**：`scripts/tests/eval-schema-content.node-test.cjs` L38-41
- **问题**：断言只有 `assert.equal(typeof adrVerdict, 'function')`，不验证内容级分支行为。被测函数因 R1 永远返回 `false`，但测试仍然绿。违反 AGENTS §9「测试必须有牙齿」。
- **FIX**：写入临时文件 → 调用 `adrVerdict(['path/to/tmp.sql-file'])` → 断言 `touchesSchema: true`。R1 修复后此测试应真跑通过。
- **See**：AGENTS §9 行为测试三规则。

### 🟡 主要（3 条）

**Y1. SQL 关键词正则漏报常见 DDL/DML**
- **位置**：`scripts/eval-harness.cjs` L58 `SQL_KEYWORDS_RE`
- **问题**：实测漏报 `DROP INDEX`、`CREATE INDEX`、`TRUNCATE TABLE`、`RENAME TABLE`、`MERGE INTO`、`REPLACE INTO`、`DROP VIEW`、`CREATE SEQUENCE`、`ALTER SEQUENCE`、`COMMENT ON`、`ALTER DATABASE`。这些都是 schema 级变更，漏报导致 `adrVerdict` 不触发。
- **证据**：`touchesSchemaContent('DROP INDEX idx')` → `false`；`touchesSchemaContent('CREATE INDEX idx ON t(c)')` → `false`。
- **FIX**：补 `DROP\s+(INDEX|VIEW|SEQUENCE)|CREATE\s+(UNIQUE\s+)?INDEX|TRUNCATE\s+TABLE|RENAME\s+TABLE|MERGE\s+INTO|REPLACE\s+INTO|CREATE\s+SEQUENCE|ALTER\s+SEQUENCE|COMMENT\s+ON|ALTER\s+(DATABASE|SCHEMA)`。
- **See**：AGENTS §0 第 6 条「客观执行」。

**Y2. 测试文件排除正则不覆盖 `.test.cjs` / `.spec.jsx` / `.test.mjs` / `.spec.js` / `.spec.mts`**
- **位置**：`scripts/eval-harness.cjs` L73 `/__tests__|spec\.ts|\.test\./`
- **问题**：`.test.cjs`、`.test.mjs`、`.spec.jsx`、`.spec.js`、`.spec.mts` 含 SQL 内容时不被排除，会被误判为 schema 触面。实测 `probe-tmp/x.test.cjs` 含 `SELECT id FROM t` → `adrVerdict` 返回 `applicable: true`（误报）。
- **证据**：正则 `spec\.ts` 只匹配 `.spec.ts`（`spec.js` 不匹配）；`.test\.` 匹配 `.test.` 但不匹配 `test.mjs`（`test.mjs` 中 `test.mjs` 无 `.test.` 子串，因 `test.mjs` 的 `.` 在 `mjs` 前）。
- **FIX**：改为 `/__tests__|\.spec\.\w+$|\.test\.\w+$/` 或更精确的 `/(\.spec|\.test)\.[cm]?[jt]sx?$/`。
- **See**：AGENTS §9 测试文件排除一致性。

**Y3. `waitForTimeout(2000)` 依赖固定时长，脆弱**
- **位置**：`e2e/garden-sync.spec.ts` L58
- **问题**：AGENTS §9「E2E 用真实等待」。固定 2s 在 CI 慢环境可能不够（假阴性），在快环境浪费时间。项目已有 `waitForURL`、`expect(...).toBeVisible()` 等模式。
- **FIX**：用 `await page.waitForURL('**/garden/hangzhou')` + `await expect(page.getByRole('heading', { name: /茶园/ })).toBeVisible({ timeout: 10_000 })` 替代，或 `await page.waitForResponse('**/v1/garden-plants*')` 等真实请求完成。
- **See**：AGENTS §9 E2E 规范。

### 🔵 提示（2 条）

**B1. SQL 关键词正则对英文散文有假阳性**
- `touchesSchemaContent('SELECT the best option FROM the list')` → `true`（误报）。因 `\b SELECT\s+.+\s+FROM\b` 太宽。
- 影响有限：内容级判定只对测试文件以外的真实源文件运行，散文在代码中少见。但注释/文档字符串含此类短语时会误触发。
- **FIX**（可选）：收紧为 `SELECT\s+[\w*,\s.]+\s+FROM\s+\w+` 要求表名是标识符。

**B2. README 分类格式小瑕疵**
- `## 运维与部署` 节前缺空行（L61），与上下文 `## 其他` 节格式不一致。
- `backup-postgres.ps1 / .sh` 在「其他」节重复登记（L71 已在「运维与部署」登记）。
- **FIX**：删「其他」节的 `backup-postgres.ps1 / .sh` 行；L61 前加空行。

---

## 6 维评审摘要

| 维度 | 结论 |
|---|---|
| **正确性** | 🔴 R1（内容级分支失效）+ 🟡 Y1（漏报）+ 🟡 Y2（排除正则不全） |
| **性能** | 🟢 无问题（文件读取量小，正则轻量） |
| **安全** | 🟢 无注入/XSS/路径穿越风险；`page.route` 仅拦截 API 层不 mock 内部协作者（符合 AGENTS §9） |
| **一致性** | 🟡 Y3（`waitForTimeout` 与项目 E2E 模式不一致）+ 🔵 B2（README 格式） |
| **可维护性** | 🔴 R2（测试无牙齿）+ 🔵 B1（正则误报） |
| **架构合规** | 🟢 `page.route` 拦截网络边界（非 mock 内部协作者）；`addInitScript` 注入登录态符合 `authStorage.ts` 契约（key=`tea-auth`） |

---

## 计数

- 🔴 **2** 条（R1 内容级分支失效、R2 测试无牙齿）
- 🟡 **3** 条（Y1 漏报、Y2 排除正则、Y3 waitForTimeout）
- 🔵 **2** 条（B1 正则误报、B2 README 格式）

## 处置建议

1. **必须修**：R1（移 `root` 到模块级）→ R2（补真断言）→ Y1（补关键词）→ Y2（补排除正则）→ Y3（改真实等待）。
2. **可选修**：B1（收紧正则）、B2（README 格式）。
3. **验证**：修复后跑 `node --test scripts/tests/eval-schema-content.node-test.cjs` 确认真断言通过；跑 `node --test scripts/tests/eval-harness.node-test.cjs` 确认无回归。

## 结论

🔴 0 🟡 0 — R1/R2/Y1/Y2/Y3 全部处置，2026-11-04 清零。
