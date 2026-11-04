# remaining-candidates 变更记录

> 目录：`.harness/changes/remaining-candidates/`，与 git 分支 `feat/remaining-candidates` 同名。
> **无数据库迁移**，故不含 `db-migrations.sql` / `rollback.sql`。
> **ADR：本切片不涉架构决策、数据模型或接口契约**，无需 ADR。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | remaining-candidates（清理三件待办：茶园读路径探针 + 语义级数据模型盲区 + README 补登记） |
| 分支 | `feat/remaining-candidates`（基于 main `28a0664`） |
| 需求来源 | probe-selector-audit 切片评审登记的三条「已接受的覆盖缺口」（summary §四） |
| 类型 | fix（工具可靠性 + 文档完整性） |
| 涉及范围 | `e2e/garden-sync.spec.ts`（新增）、`scripts/eval-harness.cjs`（语义级 schema 判定）、`scripts/tests/eval-schema-content.node-test.cjs`（新增）、`scripts/README.md`（20 行登记补齐） |

## 二、需求与方案

### 现状（实测 2026-11-04）

probe-selector-audit 切片（PR #217）评审 §四登记了三条「已接受的覆盖缺口」，用户指示「把剩下的做完」：

1. **茶园「读路径」同步无自动化覆盖**：`GardenView.vue:101` 仍 `Promise.all([gardenApi.list(), energyApi.summary()])` → `plants3d` → 3D 渲染，
   但唯一覆盖该链路的集成探针（`verify-garden-sync-e2e.cjs`）已退役，`e2e/garden.spec.ts` 不登录态、`src/` 无 garden 相关 spec。
2. **`eval-harness` 语义级数据模型盲区**：路径级判定只看 entity/迁移文件，只改 repository 内 SQL 或 service 内表语义而不动 entity/迁移文件时，
   `adrVerdict` 判 `n/a`，看不到——路径证据原理上不可判定。
3. **67 个脚本里 20 个未登记 `scripts/README.md`**：评审登记为「存量索引漂移」，只修了「登记了但不存在」的 3 个，补齐是大工程。

### 功能点

- **F1（读路径探针）**：新增 `e2e/garden-sync.spec.ts` —— Playwright 拦截 `GET /v1/garden-plants` + `GET /v1/garden-energy/summary`，
  返回 mock 数据，断言两个请求确实被发出（`requested.length ≥ 2`）+ 路径正确 + 页面正常渲染（标题可见、无 `pageerror`）。
  覆盖「读路径连通」，不覆盖 WebGL 渲染结果（那由 `scripts/verify-gardens.cjs` 截图验证，与登记的口径一致）。
- **F2（语义级 schema 判定）**：新增 `touchesSchemaContent(fileText)` —— 文件内容含 SQL/DDL 关键词
  （`CREATE TABLE` / `ALTER TABLE` / `DROP TABLE` / `INSERT INTO` / `UPDATE … SET` / `SELECT … FROM`）且非测试文件时，
  也算「触数据模型」。`adrVerdict` 在路径判定之外叠加内容判定，两者任一为真即适用。保守：测试文件排除、只看已确认存在的文件。
- **F3（README 补登记）**：按用途分类补 20 行（运维部署 4 + AI 评测辅助 5 + 上下文审计 1），登记后全仓 67/67 脚本均有登记行。

### 不做什么

- **不做真正的语义解析**：SQL 关键词正则是最保守的启发式，不是 AST 级判定；能捕「`UPDATE garden_plants SET status=?`」
  写在 repository 里的场景，不能捕「service 层调 ORM 改列语义但无 SQL 字面量」的场景（残余边界见下）。
- **不改 E2E 断言体系**：`e2e/garden-sync.spec.ts` 只验读路径，不动 `garden.spec.ts` 等既有用例。
- **不动 README 已有分区结构**：补登记行并入现有分区末尾，不重排。
- 不恢复种植/浇水功能（产品已删）。

### 验收标准（Given-When-Then）

- **F1-a** **Given** dev server 在 5173，**When** 跑 `npx playwright test e2e/garden-sync.spec.ts`，
  **Then** 测试通过：两个拦截请求被记录、路径正确、标题可见。
- **F2-a** **Given** 一个只改 repository 内 SQL 的文件（含 `UPDATE garden_plants SET`），**When** 跑 `touchesSchemaContent`，
  **Then** 返回 `true`。
- **F2-b** **Given** 纯逻辑 service 文件（`function greet(name)`），**When** 跑同一函数，**Then** 返回 `false`。
- **F2-c** **Given** 测试文件含 SQL 关键词，**When** 判定，**Then** 不计入（测试排除）。
- **F3-a** **Given** 当前仓库，**When** 抽取 `scripts/` 全部 `.cjs/.mjs/.py/.ps1/.sh` 文件名，
  **Then** 每个都在 `scripts/README.md` 中出现（`未登记 0/67`）。

### 技术方案

1. E2E 探针用 Playwright `page.route()` 拦截网络（跨进程边界 mock，符合测试规范）；断言请求发出 + 渲染正常。
2. 语义级判定用 SQL 关键词正则 + 测试文件排除；只在 `adrVerdict` 已知的 `changedFiles` 上做内容扫描（不新发现文件）。
3. README 按用途分类补行，用一次性脚本精确插入锚点后。

**双向论证**

- **选 A（E2E mock 网络探针）的理由**：登录态 + 真后端启动 = 环境重依赖，CI 里跑不了；mock 网络轻、稳定、断言清晰。
- **否 B（只跑 verify-garden-ambient 看无报错）的理由**：ambient 探针只验氛围层，读路径调用没断言。
- **选 A（SQL 关键词正则）的理由**：路径级判据原理上看不到语义级变更，正则在不引新依赖的前提下补主要盲区。
- **否 B（真做 AST 解析）的理由**：需要引 parser 依赖，成本远超收益，YAGNI。
- **反转条件**：若 SQL 关键词误报率高（>10%），改用路径白名单（repository/）+ 关键词组合，或按文件类型分目录预算。

### 残留边界（写清，不假装覆盖）

- **SQL 关键词正则是启发式**：能捕 repository 里的 SQL 字面量，不能捕 service 层调 ORM 改列语义但无 SQL 字面量的场景
  （需要 AST + ORM 调用图，属更深的语义分析，不在本切片范围）。
- **E2E 读路径探针只验「连通」**：不验 plants3d 数组元素是否正确（那是 `toPlantedTea` 的纯函数测试范围），
  不验 WebGL 渲染结果（`verify-gardens.cjs` 覆盖）。

## 三、影响分析

- **E2E**：新增 1 个 spec 文件（Playwright）；拦截请求不改前端代码，零侵入。
- **eval-harness**：语义级判定只在已有 `changedFiles` 上叠加，不影响现有评分口径（不扩大分母、不改权重）。
- **README**：20 行登记，纯文档，无代码影响。
- **承重墙确认**：不触 `teaAI.ts` 降级链、IndexedDB `sync_status`、评分模型、3D 状态机、PWA 缓存、后端分层。
- **回滚路径**：单 commit 回退；新增文件可删，README 行可删。

## 四、自检清单

- [x] 需求分析先行（F1-F3 + Given-When-Then + 范围边界 + 影响分析）
- [x] 轨道判定：**Guided**（多文件、可逆、无架构/数据模型变更）
- [x] 测试按改动面：`node --test` 88 例（含新增 5 例）+ `npm run verify` + E2E 读路径探针实跑
- [x] 无数据库迁移（本文件顶部已注明）；ADR 不适用
