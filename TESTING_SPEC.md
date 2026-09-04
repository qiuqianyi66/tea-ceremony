# 自动化测试规格（Testing Spec）

> 状态：✅ 已完成（T1–T6 全部实现并验证，见 §6 验收门禁）
> 分支：`feature/automated-testing`（Git Worktree 隔离开发）
> 对应计划：项目第二阶段「补真正能写进简历的工程能力」

## 1. 目标

把「一盏茶」从「有 CI 但测试深度不足」提升到「自动化测试成体系、可写进简历」：

- 前端：评分纯函数单元测试 + store 层离线闭环测试
- E2E：完整业务流程端到端测试
- 后端：API 接口测试 + 数据库迁移测试
- CI：全部测试自动运行，作为合并门禁

## 2. 范围（做 / 不做）

### 做

| 编号 | 内容 | 测试框架 |
|---|---|---|
| T1 | 评分算法单元测试：`src/services/scoring.ts` 全部函数 + 边界用例 | Vitest |
| T2 | store 层闭环测试：`teaStore.saveRecord`（离线写入 → 后端同步 → 成就/XP） | Vitest + fake-indexeddb |
| T3 | E2E 完整流程：首页 → 入席 → 选茶 → 选茶器 → 冲泡 → 品鉴 → 保存记录 | Playwright |
| T4 | 后端 API 测试：auth（注册/登录）、records（增删查列 + client_id 幂等） | pytest + TestClient |
| T5 | 数据库迁移测试：Alembic `upgrade head` / `downgrade base` 往返 | pytest + alembic |
| T6 | CI 接入：前端单测、E2E、后端 API、迁移测试 jobs | GitHub Actions |

### 不做

- 不修改产品功能代码（除可测性所必需的最小改动）
- 不新增测试专用产品开关（如"快捷冲泡"）
- 不引入对第三方服务（AI/网络）的测试依赖
- 不在本批引入 Playwright 视觉回归、前端组件快照测试

## 3. 技术方案（已批准的决策）

| 决策点 | 选择 | 理由 |
|---|---|---|
| 决策 1 = C | API 测试用 SQLite 内存库 + `dependency_overrides[get_db]` + `Base.metadata.create_all`；迁移测试用真实 PostgreSQL | API 测试零外部依赖、快；迁移脚本含 PostgreSQL 专属 `JSONB` / `postgresql_where`，必须用真实库验证 |
| 决策 2 = B | E2E 冲泡流程**真实等待**（不伪造时钟） | 不改产品代码，最接近真实用户体验 |
| 决策 3 = B | 前端单测 = `scoring.ts` 纯函数 + `fake-indexeddb` 补测 `teaStore.saveRecord` 闭环 | 覆盖「可解释评分」核心逻辑与「离线优先同步」两条技术亮点 |

## 4. 测试矩阵与验收标准

### T1 评分单元测试（scoring.spec.ts）

| 用例 | 断言 |
|---|---|
| `calculateProcessFactor`：温度/时间精确匹配 | = 1.0（或茶器加成 ≤1） |
| 温度偏差越大扣分越多 | 偏差 30° → 温度项为 0 |
| 时间偏差 ±50% 内线性 | 偏差 50% → 时间项为 0 |
| 茶器加成补偿逻辑 | 好茶器使系数不低于无茶器 |
| `calculateOverallScore`：满分维度 + 工艺系数 1.0 | = 10.0 |
| 评分范围收敛 | 任何输入 ∈ [1, 10]，一位小数 |
| `getScoreLevel` 各阈值 | 9/7.5/6/4 边界 |
| `generateRecordId` 唯一性 | 多次调用不重复、前缀 record_ |

### T2 store 闭环测试（tea.spec.ts）

| 用例 | 断言 |
|---|---|
| `saveRecord` 保存成功 | 写入 IndexedDB、`syncStatus` 最终为 synced、XP 增加 |
| 后端同步失败 | 记录落本地、`syncStatus=failed`、可重试（`syncPending` 成功） |
| 同茶同日防重复 | 重复保存不新增记录 |
| 评分与工艺系数写入记录 | 与 `calculateScore()` 一致 |

### T3 E2E 完整流程（e2e/full-journey.spec.ts）

流程：`/` 首页 → 入席（/tearoom）→ 选茶（/select）→ 选茶器（/tools）→ 冲泡（/brew）→ 品鉴（/taste）→ 保存。

| 阶段 | 关键断言 |
|---|---|
| 首页 | 页面加载、存在进入入口 |
| 入席 | 关闭问候、进入茶席、可跳选茶 |
| 选茶 | 茶叶列表渲染、选中后按钮可用 |
| 选茶器 | 默认茶器可选、确认进入冲泡 |
| 冲泡 | 完整走完「煮水→温杯→醒茶→浸泡→出汤」到最后一泡「开始品鉴」 |
| 品鉴 | 评分可交互、提交保存成功 |
| 保存 | 出现品鉴卡 / 历史可查 |

> 冲泡为真实计时（加热 80ms/℃、醒茶 5s、出汤 1.8s，每茶 3 泡），单用例耗时约 30–40s，为 CI 预留充足 timeout。

### T4 后端 API 测试

| 用例 | 断言 |
|---|---|
| 注册成功 | 201/200 + token + user |
| 注册重复用户名 | 400 + 明确 detail |
| 登录成功 / 密码错误 | 200 / 401 |
| 未登录访问 records | 401 |
| 创建记录 / 列表 / 详情 / 删除 | 全链路可用 |
| client_id 幂等 | 同 client_id 重复提交返回同一条 |

### T5 迁移测试

| 用例 | 断言 |
|---|---|
| `upgrade head` 成功 | 迁移 001→002 无异常 |
| 关键表存在 | teas / users_v2 / tasting_records_v2 等 |
| `downgrade base` 成功 | 表全部删除，可再次 upgrade（往返） |
| 本地无 Postgres | `pytest.skip`（CI 强制跑） |

## 5. 技术约束

- 前端：Vitest 环境 `jsdom`；`@` 别名映射 `src/`；fake-indexeddb 初始化在 setup 文件
- E2E：`@playwright/test`，chromium；webServer 用 `vite preview`（先 build）
- 后端：Python 3.12 + pytest；`requirements-dev.txt` 单独列出测试依赖（pytest / httpx）
- 迁移测试：通过 `alembic.Config` 编程调用，指向 `backend/alembic.ini`
- CI：frontend 增加 `npm run test` + `npm run test:e2e`；backend 增加 pytest；迁移测试用 Postgres service 容器
- 所有新代码遵循 AGENTS.md（简体中文注释、类型安全、最小修改）

## 6. 验收门禁

- [x] `npm run test`（Vitest）全部通过 —— 20/20
- [x] `npm run test:e2e`（Playwright）完整流程通过 —— 本地与 CI（GITHUB_ACTIONS=true，base=/tea-ceremony/）双环境 1/1
- [x] `cd backend && pytest` API 测试全部通过 —— 12 passed（迁移测试本地 Docker 引擎未就绪时 skip，CI 强制跑）
- [x] 迁移测试：本地 Docker 引擎不可用故 skip；CI 已接 Postgres service 强制运行
- [x] `npm run build` 与 `npm run type-check` 不回归 —— 均通过
- [x] CI 新增 frontend-unit / e2e / backend-test / migration-test 四个 job，compose 校验通过
- [x] 产物说明写入 README「常用命令」测试章节

**额外产出**：测试驱动修复 6 个真实生产缺陷（路由白屏、粒子卡死、Dexie 索引崩溃、IndexedDB Proxy 写入崩溃、选茶跳转断裂、bcrypt/passlib 不兼容），均以独立 `fix:` commit 记录。
