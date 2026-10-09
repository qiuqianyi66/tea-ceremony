# biz-dev-skill 总览（业务专项，19 个）

> 路由表：tea 版裁剪映射（PRD 9.3 + ADR-011）。编码模式细节在此族，main-dev 只定义流程。
> ⚠️ **过渡注记**：后端 M1 未开工，专项技能为流程骨架；M1 骨架落地后**回填真实类锚点**（如 `TeaRepository.findByTypeOrderBy`），代码模板锚定仓库真实实现。

| 技能 | 触发场景 | tea 状态 |
|---|---|---|
| 01-crud-scaffold | 标准 CRUD（茶叶/茶器/文化） | ✅ |
| 02-pagination-query | 列表/历史/目录分页 | ✅ |
| 03-caffeine-cache | 两级缓存：Caffeine L1 + Redis L2（ADR-012 四场景） | ✅ L1 已用 / L2 待 M2-M3 |
| 04-spring-event-async | 异步解耦（**裁 RocketMQ**） | ✅ 替代 |
| 05-transaction-consistency | 多写操作一致性（品鉴提交） | ✅ |
| 06-exception-handling | 统一异常体系 | ✅ |
| 07-business-validation | 入参/业务范围校验 | ✅ |
| 08-excel-import-export | 文化数据批量导入/导出 | 🔶 按需 |
| 09-db-migration | 任何 Schema 变更（**必用**） | ✅ 必用 |
| 10-scheduled-task | 定时任务（AI 成本日统计） | 🔶 按需 |
| 11-file-upload | 头像/茶照片上传 | 🔶 按需 |
| 12-growth-notification | 成长提醒 | ⭕ M6 占位 |
| 13-stats-report | 品鉴趋势聚合 | ✅ |
| 14-ai-agent | AI 多智能体（5 专家编排） | ✅ tea 专属 |
| 15-rag-pipeline | 文化知识 RAG 管线 | ✅ tea 专属 |
| 16-ai-fallback | AI 降级链（承重墙） | ✅ tea 专属 |
| 17-offline-sync | 离线同步（承重墙） | ✅ tea 专属 |
| 18-3d-scene | TresJS 茶席场景 | ✅ tea 专属 |
| 19-design-taste | 前端设计质量（taste Vue 化） | ✅ tea 专属 |

## 调用规则

- **主/专配合**：coding-skill 触发后，按功能命中本族专项技能加载（≤4 上下文内）。
- **红线一致**：每个专项技能引用 .harness/rules/编码规范.md 红线编号，不重复定义。
- **裁剪声明**：03/04 为 tea 替代实现；12 占位不实现；trouble-shooting 族另有 AI 异常/RAG 质量（tea 特有）。
