---
last_updated: 2026-10-07
status: active
owner: tea-harness
---

# patterns — 跨项目经验模式池

> 经验三级进化（lesson → pattern → instinct，见 `.harness/rules/开发流程规范.md` §八）的 **pattern 落点**。
> AGENTS.md §13 学习记录是 lesson 池（单次踩坑）；本文件是 pattern 池（同一问题 ≥2 项目复现才可写入）。

## 规则

1. 每条 pattern 附：lesson 来源（AGENTS.md §13 条目）+ 复现项目 + 日期。
2. 晋升 instinct：用户确认后更新 AGENTS.md 对应规则，并在本条标注晋升日期。
3. 条目 ≤ 10 行；超长内容迁 research 文档，本文件留索引。
4. 禁止从 lesson 直接复制到本文件（无复现证据不构成 pattern）。

## 条目

### 候选条目（通用环境类 lesson，待跨项目复现验证后晋升正式条目）

> 判据：不依赖 tea 业务语义、适用于任意同类环境/工具链。在 tea 记录过 1 次；§八 pattern 级需 ≥2 项目复现，故先登记候选。

| # | pattern 候选 | 来源（AGENTS.md §13） | 适用面 | 登记日期 |
|---|---|---|---|---|
| P1 | 删除/覆盖文件前先 Read 确认无独立价值；恢复成本高于删除成本 | lesson 首条 | 任何文件操作 | 2026-10-08 |
| P2 | 调研用横纵分析框架：先纵向历史演进，再横向统一维度对比，两轴合看再规划 | lesson「开工前调研必须用横纵分析框架」 | 任何技术选型/竞品调研 | 2026-10-08 |
| P3 | PowerShell 写代码用单引号 here-string（@'...'@）防 `$` 插值破坏；动手前先探测行尾（LF/CRLF 混合） | lesson「PowerShell 往 .vue 写…」 | Windows + 文本生成 | 2026-10-08 |
| P4 | 工具级字符串编辑会把 CRLF 混合文件归一为 LF；修复 = 在 HEAD 字节上重放替换保留原行尾 | lesson「Edit/Write 工具对 CRLF 混合文件…」 | 任何编辑器工具链 | 2026-10-08 |
| P5 | `vite preview` 可能绑定 IPv6 ::1；冒烟探测用 localhost 而非 127.0.0.1 | lesson「vite preview 可能绑定 IPv6…」 | Vite 部署验证 | 2026-10-08 |
| P6 | npm audit 本地必须加 `--registry=https://registry.npmjs.org`（镜像不实现 audit endpoint） | lesson「npm audit 本地必须加…」 | npm 供应链审计 | 2026-10-08 |
| P7 | 容器数据库密码认证失败：先试候选已知密码再重建卷；重建卷是最后手段 | lesson「数据库容器密码认证失败…」 | Docker Compose 数据库 | 2026-10-08 |
| P8 | GitHub push 走 443 可能被本地网络重置；改用一次性 `GIT_SSH_COMMAND` 走 22 端口，不动全局配置 | lesson「GitHub push…」 | git/GitHub 网络 | 2026-10-08 |
| P9 | E2E 导航路径必须相对 baseURL（禁前导斜杠），CI base 前缀下会跳出 SW scope 或命中提示页 | lesson「E2E 测试导航路径…」 | Playwright + CI base | 2026-10-08 |
