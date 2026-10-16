# R5 外置/移除内容原文留档（常驻层压缩，2026-10-16）

> 用途：记录本次从常驻层移出的内容原文，供 14 天内核对与回滚。原文在 `%LOCALAPPDATA%\tea-context-backups\2026-10-16\r5\` 亦有完整副本。
> 外置到按需文件的条目（如 26 项自检清单）不在此重复，落点见 `ledger.json`。

## CONTEXT.md §待办与已知限制：已完成里程碑原文（移出常驻层）
- [x] 单元测试与 E2E 测试已落地（Vitest 142 用例 / Playwright 34 例 / pytest 51 过 3 跳，2026-09-20 基线）
- [x] AI 第三方请求已收敛到后端代理（`/api/v1/ai/chat`，浏览器不再直连；DashScope）
- [x] 用户公开品鉴卡片和分享链接已实现（二维码 / `/share` 只读页）
- [x] 冲泡页已升级为 TresJS 3D 茶席 + 实景夜色暖光背景（`3D_SPEC.md`）
- [x] 迁移测试本地跑：`TEST_DATABASE_URL` 指向本地 PG 服务即可（不再依赖 Docker），CI 用 Postgres service
- [x] Redis 四场景已决策（ADR-012：两级缓存 / 语义缓存 / 分布式限流 / JWT 黑名单，M2/M3 落地）
- [x] 生产级收敛 P1（数据治理 DATA_POLICY / 测试体系 TESTING_SPEC / Design Spec 拆分 DESIGN_SPEC+3D_SPEC，2026-10 完成）

## 编码规范.md §六 自检清单（26 项）：新落点为按需技能，此处仅记落点

- 新落点：`.harness/skills/main-dev/coding-skill/SKILL.md` §自检清单 26 项（原文零改动，逐行核对见 `scripts/audit-context-migration.cjs` 输出）
