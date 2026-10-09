# garden-s1 Review

> 评审对象：garden-s1 能量事件账本（V4 迁移 + 后端 garden 域 + 前端 GardenView 收集 + 契约同步）
> 依据：ADR-015 + `docs/prd/garden-product-prd.md`（F-G1/2/3/6）+ `docs/plans/PLAN-garden-s1-design-2026-10-08.md`（D1-D5 已确认 2026-10-09）
> 评审方式：逐项核对（需求→方案→迁移→验证→契约→风险）
> 结论：**通过**，🔴 0 🟡 0（详见尾部 verdict）

## 一、逐项评审

### 1. 需求对齐

- [x] D1-D5 确认：单事件模型 / 规则入 yml / 契约 v1 / 阈值 0-100-300-600 / 能量只升不降——PLAN 状态 active（2026-10-09 用户授权按推荐执行）
- [x] 能量账本 append-only + collected_at 标记（ADR-015）——V4__garden_energy.sql
- [x] 品鉴落库同事务记账，client_id 复用品鉴记录防重——TastingRecordService.create 挂接
- [x] 一键收集：未收事件置已收 + 累加 plants.energy + 阶段推进（只升不降）——GardenEnergyService.collect
- [x] 3D 阶段映射：后端 status 映射视觉档位，不改 3D 视觉本身（3D_SPEC）——GardenView.toPlantedTea

### 2. 迁移方案核对（Flyway 文件级）

- [x] 版本号 V4（V1-V3 已占用，实读 backend/src/main/resources/db/migration/ 确认）
- [x] 迁移成对：V4__garden_energy.sql（up）+ .harness/changes/garden-s1/rollback.sql（down）
- [x] 红线冲突清零：ddl-auto: validate 不变；命名 uk_/fk_ 规范
- [x] status 默认值语义化：存量 'pending' 归并 'planted' + SET DEFAULT 'planted'（down 对称恢复）

### 3. 验证证据

- [x] up 验证：Docker 临时 PG（5433）V1-V4 全 up，pending→planted 归并 + energy 列 + 账本表核验
- [x] down 验证：往返测试 up→down→up 通过（表/列消失、status 回滚 pending、可重上）
- [x] 后端测试：GardenEnergyServiceTest 8 绿 + GardenPlantServiceTest 4 绿 + TastingRecordServiceTest 回归绿 + LayerDependencyTest 绿；mvn 全量（含 Testcontainers）MVN_EXIT=0
- [x] 前端验证：npm run type-check TC_EXIT=0 + npm run build BUILD_EXIT=0

### 4. 契约与影响

- [x] api-contract.md garden 段：移除"未实现"标注，路径对齐 /api/v1/，补 garden-energy 总览/收集两端点
- [x] 承重墙确认：teaAI 降级链、品鉴幂等、3D 视觉均不改逻辑，仅新增调用
- [x] 影响面：新表 + 扩展列（纯新增无破坏）；游客纯观赏降级保留

### 5. 遗留与后续

- 无植物时的自动承载行（client_id=auto-plant）为 S1 防御场景，S2 若引入多植物种植需重新评估
- 能量收集 UI 未做端到端截图验证（需登录 + 品鉴数据 + 后端联调），前端逻辑经 type-check/build 验证

## verdict

🔴 0 🟡 0 —— 通过。garden-s1 满足验收：V4 迁移成对 + 往返验证 + 后端全量绿 + 前端构建绿 + 契约同步 + ADR-015 登记；3D 视觉与品鉴承重墙未改动。
