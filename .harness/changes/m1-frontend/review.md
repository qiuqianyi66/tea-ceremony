# m1-frontend 评审记录（expert-reviewer，6 维）

> 评审对象：`feature/m1-frontend` 全部变更（git diff：src/services/api/{auth,teas,records}.ts、vite.config.ts、api-contract.md、AGENTS.md、docs/prd/m1-frontend-requirements.md、docs/canvas-ui.md、src/services/api/__tests__/api.spec.ts）。
> 日期：2026-10-06。结论：**🔴 0 / 🟡 0 / 🟢 2 / 🔵 1**，通过。

## 1. 正确性
- ✅ 三域解包/映射与后端契约一致（AuthController/TokenVo/UserVo/RegisterRequest/application.yml 源码核实：无 snake_case 策略 → user.displayName camelCase）
- ✅ 联调冒烟全链路实测：teas 分页 200、register/login TokenVo、records 创建+幂等重提同 id、list 分页——均为真实 HTTP + 真实 Postgres（compose）
- ✅ 契约回归测试 7 例覆盖：解包、camelCase→snake_case、分页、client_id 必填兜底、请求体/路径断言
- ✅ http.ts 401 豁免（`/auth/` 前缀）兼容 `v1/auth`；display_name 消费点（HomeDrawer/TeaRoom）核对零遗漏

## 2. 性能
- ✅ teas/records size=100（新契约上限内）保"一次全量"原语义，无新增请求、无 N+1、无循环依赖

## 3. 安全
- ✅ URLSearchParams 构造查询（中文百分号编码，无拼接注入面）；token 注入机制（http.ts/authStorage）零改动；无新增越权面（前端仅消费后端契约）

## 4. 一致性
- ✅ api-contract.md 补登 /api/v1/auth 段（含命名注意：camelCase displayName 与 snake_case TeaVo 并存）；需求文档差异矩阵已按源码定案更新（display_name→displayName）
- 🟢 需求文档 F10-2 契约示例 size=20 与实际实现 size=100（保持全量语义）有出入——文档以"size 上限内保全量语义"注释说明，行为优先

## 5. 可维护性
- ✅ toStoreShape/toLocalTea/fromRecordDto 单一职责；契约接口（TeaVo/RecordVo/TokenVo）注释标注来源；mock 数据保留 DEV 兜底
- 🟢 records create/delete 不传 mockData 的行为（DEV 失败返回 undefined vs 生产抛错）依赖 requestOrMock 语义——已注释说明，防后续误加 mock 破坏离线同步

## 6. 架构
- ✅ 分层未破：api 层适配、store/http/authStorage 零改动；承重墙（AI 降级链、离线同步、评分透传）零触碰；vite proxy 单一改动点
- 🔵 AI/culture 降级为批 C 预期功能降级（F10-4b），恢复依赖 AI 切片（后续），非本次缺陷

## 自检
- [x] 6 维全覆盖
- [x] 🔴 零残留、🟡 清零
- [x] 评审记录已落盘（.harness/changes/m1-frontend/review.md）
