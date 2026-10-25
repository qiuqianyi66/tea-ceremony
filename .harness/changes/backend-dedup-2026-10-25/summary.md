# backend-dedup-2026-10-25 变更记录

> 目录：`.harness/changes/backend-dedup-2026-10-25/`。**无数据库迁移**（纯测试基建与 main 代码等价重构），不建 db-migrations.sql / rollback.sql。

## 一、变更概览

| 项 | 内容 |
|---|---|
| 功能名 | backend-dedup-2026-10-25（后端重复代码提取：测试容器基类 + 分页校验） |
| 分支 | `refactor/backend-dedup`（基于 main fb38024） |
| 需求来源 | 用户 2026-10-25 指令：「继续去做，遇到重复的代码就提取一下。前后端都是」 |
| 类型 | refactor / test |
| 涉及范围 | 后端测试基建（13 文件）+ common（新工具类）+ record/tea Service（等价替换） |

## 二、变更明细

### 1. PostgresIntegrationTestBase（13 个集成测试的容器配置提取）

- 现状（实测）：`@Container PostgreSQLContainer("pgvector/pgvector:pg16")` + `@DynamicPropertySource` datasource 装配，11 行块在 13 个测试类逐字粘贴（Python 指纹比对：12 个完全同构 + 1 个变体多一条 tea.admin.token）。
- 改动：新增 `backend/src/test/java/com/tea/support/PostgresIntegrationTestBase.java`；13 个测试类改为 `extends` 基类，删除各自粘贴块与无用 import。
- 变体处理：`AdminCultureBackfillIntegrationTest` 保留自己的 `@DynamicPropertySource`（只注册 tea.admin.token，datasource 三项由基类供给）——Spring 支持层级多方法叠加。
- **审查抓出的关键缺陷及修复**：子代理审查发现提取后所有子类的 @DynamicPropertySource 方法集相同 → Spring 上下文缓存键塌缩 → 同配置测试类（A/B/E 三组共 9 类）复用第一个类的缓存上下文，而共享容器对象每类结束后 stop/重启到新随机端口，复用方连接池指向已死容器（表现为偶发 flaky）。修复：基类加 `@DirtiesContext(classMode = AFTER_CLASS)`（@Inherited，13 子类生效），复原"每类一个上下文一个容器"的提取前语义；"禁并行测试"约束写入基类 javadoc。

### 2. Pagination 分页校验提取（main 代码）

- 现状（实测）：`page < 1` / `size < 1 || size > MAX_SIZE` 两个 if + 逐字相同的错误消息，在 `TastingRecordService` 与 `TeaService` 各一份。
- 改动：新增 `com.tea.common.request.Pagination.requireValid(page, size)`（消息逐字保持）；两处调用替换为单行；各自 MAX_SIZE 常量删除（grep 无残留引用）。
- 刻意不并入：`ErrorFingerprintService` 的分页是**钳制语义**（Math.max/min 容错不抛错），与抛 BadRequest 的策略刻意不同，强行统一会抹掉行为差异。
- 新增 `PaginationTest` 4 用例（边界四象限）。

## 三、前端结论（本轮无改动，理由备查）

用户要求"前后端都是"，前端实测排查后无 ≥3 处逻辑级重复可提取：http.ts/api 层已统一（requestOrMock）；storage 桶化干净；`date · 第 N 泡` 格式化仅 2 处逐字 + 1 处 canvas 刻意双空格排版（TastingCard 分享卡片，与"一盏茶 · TASTING NOTE"同款美术风格）+ TeaProfile 仅日期形态——强提取需加参数分支，无净收益。UI 模板层的真重复已在 PR #148（PageHeader/PillButton/SectionHeader/useImgFailed）收敛。

## 四、验收标准（Given-When-Then）

- **Given** 任一集成测试子类，**When** 运行，**Then** 容器启动/datasource 装配行为与提取前等价（每类独立容器独立上下文），mvn 全量 0 Failure。
- **Given** page=0 或 size=0/101 的列表请求，**When** 打到 records/teas 列表，**Then** 仍返回与提取前逐字相同的 BadRequest 消息（既有单测 TastingRecordServiceTest/TeaServiceTest 锁定，未改动）。

## 五、验证记录

- mvn 全量：见 PR 描述（本轮本机曾遇 Docker 引擎中途死亡的环境故障——surefire 9 类 Errors 均为 "Could not find a valid Docker environment"，引擎重启后复跑）。
- 子代理审查：A/C/E 节 PASS；D 节发现缓存键塌缩 → 已修复（@DirtiesContext）+ 修复复核 PASS；B 节机制核验通过（含"同一 static 实例按类重启"的并行约束）。
