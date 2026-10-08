---
last_updated: 2026-10-08
status: active
owner: yanha
---

# PLAN — Harness Phase 2 执行方案（K7-K12，2026-10-08）

> 定位：对 `PLAN-harness-optimization-2026-10-v2.md`（已批 23 项清单）Phase 2 六项的逐项执行方案。母本已定义"做什么"，本文件定义"怎么做"与验证。写法：plan-control Controlled Track 九段体，结论先行。
> 状态：active（用户已批准"按推荐去做"；本方案落实执行细节）。

# Goal

小步落地 K7-K12 六项，每项独立 commit、独立验证，治理文档与实现同步（AGENTS.md §13 规则）。

| K# | 任务 | 级别 | 落点 | 验证 |
|---|---|---|---|---|
| K7 | 技能准入：可执行类技能标注验证命令 + verify-harness 检查 type | L2 | 技能规范.md + verify-harness.cjs + 可执行类技能标注 | `verify-harness` + `npm run quality` |
| K8 | 评审-修复闭环 ≤2 轮 | L2 | 开发流程规范.md §五 + main-dev README | `verify-harness` 绿 |
| K9 | 经验链路：lesson→pattern 迁移 + 评审收尾自动收根因行 | L0/L1 | patterns.md + 开发流程规范.md §八 | `verify-harness` 绿 |
| K10 | ArchUnit 扩展（@Transactional / ApiResponse 断言） | L3 | ADR-014 + LayerDependencyTest.java | `mvn -q test` + `verify-harness` |
| K11 | 开工自查清单（AGENTS.md §4 一行约定） | L0 | AGENTS.md §4 | `verify-harness` 绿 |
| K12 | CI "job 进==出"看门打印 | L2 | verify-harness.cjs §3 | `verify-harness` 输出含对照 |

# Context

**相关文件现状（2026-10-08 已读）**
- `verify-harness.cjs`（12.7KB）：11 类检查。§3 已校验 ci.yml job 数 vs AGENTS.md 声明（进==出存在但不打印清单）；§4 已校验技能数量 + README 双向核对。K7 在 §4 后加 4f；K12 在 §3 加打印。
- `技能规范.md`：§2 模板仅 name/description/disable-model-invocation；§6 审计命令为 PowerShell 内联脚本。O-11 三值在此扩展。
- `.agents/skills` 66 个 + `.harness/skills` 32 个 = 98 个技能。v2 已核实：绝大多数为知识/流程类，无可执行命令（"技能验证 | 98 全验证 vs 仅可执行类 | K7 仅可执行类"）。
- `开发流程规范.md`：§五 评审约束（🟡 未清零不过评审、评审不过回炉）；§八 经验三级进化（lesson→pattern→instinct，人工确认晋升）。
- `LayerDependencyTest.java`：4 条规则已落地（红线 #1 + 字段注入），纯编程式 @Test 执行，错误信息三要素。K10 在此追加。
- `docs/plans/patterns.md`：需确认现状（计划为 pattern 池，待填充）。
- ADR 现状：docs/ADR/ 至 ADR-013（verify-harness 校验连续性）。

**O-11 决策（采用建议并细化，用户可反驳）**
- frontmatter 加可选 `type: executable|knowledge|flow`，由维护者（技能作者/本 Agent 执行 K7 时）标注。
- "可执行类"边界：SKILL.md 正文含**可直接运行**的验证命令/脚本调用（`npm run`/`node scripts/`/`mvn`/`python -m`/`docker` 等）即 executable；无执行概念为 knowledge；定义流程/时序/决策路径的为 flow。
- 约束三条（verify-harness 强制）：
  1. `type` 值域 ∈ {executable, knowledge, flow}，否则 error。
  2. `type: executable` → 必填 `verification: <可运行命令>`，否则 error。
  3. 声明 `verification` 但 `type` 非 executable → error（防误标）。
- 不强制 98 个技能全标 type（缺省不报错，避免知识类噪音）；只标注 executable 候选 + 已声明 verification 的。

# Risk Assessment

| 项 | Impact | Scope | Uncertainty | Irreversibility | Score | Level |
|---|---|---|---|---|---|---|
| K7 | 2（verify-harness 是 CI 门禁，改错挂 CI） | 2（3 文件 + 技能标注） | 1（设计已定，标注范围待扫） | 1（revert 单 commit） | 6 | MEDIUM |
| K8 | 1（流程文档） | 1 | 0 | 0 | 2 | LOW |
| K9 | 1（经验迁移需判断） | 2（2 文件） | 1（patterns 现状待确认） | 0 | 4 | LOW |
| K10 | 3（ArchUnit 误报可挂 Maven 门禁） | 2（ADR + 测试） | 2（现有代码是否全合规未知，需基线扫描） | 2（L3 需 ADR + 迁移测试） | 9 | HIGH |
| K11 | 0 | 0 | 0 | 0 | 0 | LOW |
| K12 | 1 | 1 | 0 | 1 | 3 | LOW |

K10 单独 HIGH：先基线扫描（mvn test 现状）+ ADR 先行，有违规先记录不强制（新规则只对新增代码生效的除外——ArchUnit 全量检查，故必须基线 0 违规或先修）。

# Approach

**执行顺序**（低风险先行，K10 最后）：
K11 → K9 → K7 → K12 → K8 → K10。每项独立 commit；K10 内部分 ADR commit + 规则 commit。

# Tasks

## K11 — 开工自查清单（L0）

- **Input**：AGENTS.md §4（AI Change Protocol）；学习记录"开工前先查目标功能是否已实现（git log --oneline -10，0f3549d）"。
- **Action**：§4 开头加一行约定（不改变其他条款）：
  `0. **开工自查**：先 \`git log --oneline -10\` 查目标功能是否已实现；已实现 → 补缺验证，禁止从零重写。`
- **Output**：AGENTS.md §4 一行。
- **Validation**：`node scripts/verify-harness.cjs` → ERRORS: []（行数仍在 200-350）。

## K9 — 经验链路激活（L0/L1）

- **Input**：`docs/plans/patterns.md`（确认现状）；AGENTS.md §13 学习记录；开发流程规范 §八。
- **Action**：
  1. 读 patterns.md 确认空壳 → 按 §八 pattern 判据（跨项目 ≥2 复现），把 AGENTS.md §13 中**通用经验**（非 tea 特有）迁入 pattern 池，附 lesson 来源与日期；tea 特有保留在 §13。
  2. 开发流程规范 §八 加一句约定：`评审收尾自动收根因行：changes/{slice}/summary.md 固定 Learning 节（一行根因），跨项目复现提级 pattern 建议。`
- **Output**：patterns.md 有内容；§八 有根因行约定。
- **Validation**：`verify-harness` 绿（docs 元信息头补齐）。

## K7 — 技能准入（L2）

- **Input**：技能规范.md §2/§6；verify-harness.cjs §4 后；98 个技能 frontmatter。
- **Action**：
  1. 技能规范.md §2 模板加 `type` / `verification` 字段说明（含 O-11 边界定义）；§6 审计命令同步加 type/verification 三条检查。
  2. verify-harness.cjs 加 4f 检查：扫描 `.agents/skills` + `.harness/skills` 全部 SKILL.md frontmatter，实施 O-11 三条约束，命中即 error（错误信息三要素格式）。
  3. 扫描 98 个技能正文，识别 executable 候选（含可运行命令），逐个补 `type: executable` + `verification`；确认无执行概念的不标。
- **Output**：规范扩展 + 脚本检查 + 可执行类标注。
- **Validation**：`node scripts/verify-harness.cjs` → ERRORS: []；`npm run quality` 全绿（脚本改动属 L2，跑 test+build）。

## K12 — CI job 进出看门打印（L2）

- **Input**：verify-harness.cjs §3。
- **Action**：§3 校验后追加常规输出行：`CI jobs 进出: ci.yml N 个 [name1, name2...] vs AGENTS.md 声明 M`，不一致即 error（现有逻辑保持）。
- **Output**：每次体检可见 job 清单对照。
- **Validation**：重跑 `verify-harness` 输出含对照行 + ERRORS: []。

## K8 — 评审-修复闭环 ≤2 轮（L2）

- **Input**：开发流程规范 §五「评审约束」；main-dev README（expert-reviewer 行）；expert-reviewer SKILL.md（执行时读，确认是否有"单次触发"字样需同步）。
- **Action**：§五 评审约束追加：`🔴 评审-修复闭环 ≤2 轮：第 1 轮不过 → 按三要素（问题/根因/修复）回炉修复 → 重评；第 2 轮仍不过 → 暂停，人工介入（禁自动第 3 轮）。`；main-dev README expert-reviewer 行补"闭环 ≤2 轮"。
- **Output**：流程约定 2 处。
- **Validation**：`verify-harness` 绿（README 数字声明不受影响）。

## K10 — ArchUnit 扩展（L3，需 ADR）

- **Input**：LayerDependencyTest.java；编码规范 §7（事务/响应规范）；现有 controller/service 代码（基线扫描）。
- **Action**：
  1. ADR-014 先行：`docs/ADR/ADR-014.md`（ArchUnit 事务与响应契约机械化；范围=service 写方法 @Transactional(rollbackFor)、只读 readOnly=true、controller 返回 ApiResponse；动机/取舍/回滚）。
  2. 基线扫描：对现有 backend/src/main 跑新规则原型，确认 0 违规（有违规先记录，与用户确认是否修）。
  3. LayerDependencyTest.java 追加两条 ArchRule（错误信息三要素格式）：
     - `transactionalWriteMethodsNeedRollbackFor`：service 层方法，`@Transactional` 且非 `readOnly=true` → 必须含 `rollbackFor` 属性指向 Exception 类。
     - `controllersReturnApiResponse`：controller 方法返回类型必须为 `ApiResponse<?>`（排除 void / ResponseEntity 特例若基线存在）。
  4. 更新 AGENTS.md §13 或规则文档的 ArchUnit 描述（如 LayerDependencyTest 注释行数引用）。
- **Output**：ADR-014 + 两条 ArchRule + 基线 0 违规。
- **Validation**：`cd backend && mvn -q test`（ArchUnit 真实执行）→ 绿；`verify-harness` 绿（ADR 编号连续性）。

# Trade-offs

| 取舍 | 选项 | 选择 | 理由 |
|---|---|---|---|
| type 标注范围 | 98 个全标 vs 仅可执行类 | 仅可执行类 + 缺省不报错 | 知识/流程类无执行概念，全标是噪音（v2 已定） |
| verification 强制 | 所有技能 vs 仅 executable | 仅 executable | 约束 3 反向兜底误标 |
| K10 强制范围 | 全部方法 vs 写方法/controller 返回 | 写方法 + controller 返回 | 编码规范 §7 明文的机械子集 |
| K9 迁移范围 | 全部 lesson 迁 pattern vs 仅跨项目 | 仅跨项目（≥2 复现） | §八 pattern 判据 |
| K8 轮数 | ≤3 轮 vs ≤2 轮 | ≤2 轮 | v2 已定（第 2 轮不过人工介入） |

# Rollback Strategy

- K11/K9/K8（文档级）：`git revert` 单 commit。
- K7/K12（verify-harness + 规范）：revert 脚本 commit + 技能标注 commit（标注独立 commit，可单独回退）。
- K10（L3）：revert ADR-014 + 测试 commit；规则对新增代码的约束随 revert 消失，不影响旧代码。
- 全部在 feature/harness-k7-k12 分支，merge 前过 `npm run quality` + `mvn -q test` + `verify-harness`。

# Open Questions

- **O-11 确认**：本方案按建议实施（三值 + 维护者标注 + 三条约束）。用户有异议可反驳，改动点集中在 K7。
- **K10 基线**：若基线扫描发现现有代码违反新规则（如 controller 返回裸类型），执行时列出清单问用户：一并修 or 规则限定范围。

# Not Doing

- 不给全部 98 技能标 type（只标可执行类 + 已声明 verification 的）。
- K8 不做第 3 轮自动重试、不做自动提 PR。
- K10 不查 Repository 事务、不查 Controller 入参校验（编码规范 §7 之外的红线不动）。
- K11 不做自动 hook（豆包运行时无此机制，v2 已定）。
- K12 不做增量测试、不做 pass rate/轨迹（v2 已砍）。
