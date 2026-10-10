---
name: pr-body
description: 写 PR body 的模板——最小可视化 Summary + before/after Evidence + 单向/双向门 Merge Danger。当一个分支要 push 远端开 PR 时触发，目标是让 reviewer 不读 diff 也能判断改了什么、有没有风险。
type: flow
---

# PR Body（pr-body）

PR body 不是 commit message 的扩写。目标是让 reviewer **不读 diff** 也能回答三个问题：改了什么、怎么证明它工作、合并风险多大。

## 触发条件

- 一个 feature/fix 分支准备 push 远端开 PR
- 不触发：commit message（那是为什么改，这里是改了什么的可视化）、直接 push main（已禁）

## 模板

```markdown
## Summary
<最小可视化，选一种>

## Evidence
- **Before:** <截图 / 失败测试输出 / 旧行为>
- **After:** <截图 / 通过测试输出 / 新行为>

## Merge Danger
**Door:** <one-way / two-way>
**Blast Radius:** <一词概括影响范围>
```

## Summary：选最小视图，不堆砌

选**一个**能说清关键变化的视图，不要全用：

- **算法/逻辑** → 伪代码：
  ```text
  on(save)
    if content unchanged → return cache
    write new content → return fresh
  ```
- **调用链变化** → 调用树：
  ```text
  submitForm → createSession → persistPrompt
                             → launchAgent → navigateToSession
  ```
- **文件布局变化** → 浅文件树（只标新增/删除）：
  ```text
  src/services/api/
  ├── teas.ts
  ├── records.ts
  └── types.ts        ← 新，统一 ApiResponse<T>
  ```
- **局部改动** → diff 形状（只留关键行）：
  ```diff
  on(save)
  - write content
  + if unchanged → return cache
  + write content → invalidate cache
  ```
- **跨模块数据流** → Mermaid sequenceDiagram（只在真需要时）。

规则：
- 每个可视化贴在它说明的短句旁边。
- 只保留回答"改了什么"所需的调用/文件/状态/边界，不贴全量。
- 3D/UI 改动 → 组件树带状态（`<TeaRoom>` 里哪个组件加了/改了 props）。

## Evidence：before/after 必须成对

- **截图是 S 级**：UI 改动有前后对比截图最有力。前端 UI 改动贴 `/brew`、`/garden`、`/tea/:id` 等关键页前后对比。
- **测试输出是 A 级**：后端逻辑改动贴失败测试→通过测试的具体命令输出。
- **3D 改动**贴对应 verify 脚本输出：`verify-gardens.cjs` / `verify-pavilion.cjs` / `verify-icons.cjs` 期望 `ERRORS: []`。
- **PWA/离线改动**贴离线测试结果（断网刷新、SW 缓存命中）。
- **后端改动**贴 `cd backend && mvn -q test` 或旧栈 `.venv\Scripts\python.exe -m pytest tests -q` 尾部摘要。
- 禁止只写"已测试"——贴具体证据。

## Merge Danger：单向/双向门

- **Two-way door**：可回退（改文案/调样式/加 feature flag）→ 低风险。
- **One-way door**：难逆转（数据库迁移/改 API 契约/删承重墙行为）→ 高风险，explain 为什么必须现在做、回滚方案是什么。

Blast Radius 一词概括：`前端单组件` / `跨 3 个 api 文件` / `DB schema` / `PWA 缓存策略` / `AI 降级链`。

## 纪律

- 不用 preamble（"本 PR 实现了..."），直接上图/证据。
- 用项目领域术语（glossary.md 里的词），不发明新词。
- PR body 不写实现步骤（那是 commit history 的事）；写 reviewer 判断所需的。
- 破坏性/数据迁移 PR 必须在 Merge Danger 段写回滚方案。

## 自检

- [ ] Summary 选了一种最小可视化（伪代码/调用树/文件树/diff/Mermaid），不是纯文字
- [ ] Before/After 成对（截图或测试输出）
- [ ] Door 标了 one-way/two-way
- [ ] Blast Radius 一词说清影响范围
- [ ] one-way door 写了回滚方案

## 下一步

PR 开好 → CI 绿 → 合并 → `deploy-verify`（阶段 8-10 部署验证）。
