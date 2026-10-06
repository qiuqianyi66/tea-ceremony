# m1-ai 专家评审记录（expert-reviewer）

> 评审日期：2026-10-06
> 范围：feature/m1-ai 全部变更（git diff + 新增 ai/culture 域）
> 6 维：正确性 / 性能 / 安全 / 一致性 / 可维护性 / 架构

## 发现与处置

| 级别 | 问题 | 处置 |
|---|---|---|
| 🟡 | 计量落库在 LLM 成功之后执行；若 DB 保存失败，用户已获 LLM 内容却收到 500 | **已修复**：saveUsageLog 包 try-catch，计量失败仅 warn 日志，不影响返回 |
| 🔵 | Usage 可能为 null（不同上游） | 已容忍：null 时 token 字段留空 |
| 🔵 | model 名取自 response metadata，可能为 null | 已容忍（列可空） |

## 6 维结论

| 维度 | 结论 |
|---|---|
| 正确性 | 消息 role 转换正确；content null 检测；仅成功调用计量；无 key/上游异常 → 502；测试 82 全绿 |
| 性能 | 4 条 ILIKE 各 LIMIT 5（JdbcTemplate 直查，无 N+1、无多余实体）；8s 超时在前端 |
| 安全 | ILIKE 参数化绑定（防注入）；DTO 校验（role pattern/content 4000/messages 20）；502 不泄露内部错误；公开端点 user_id 可空 |
| 一致性 | api-contract 已登记 v1 ai/culture（含 502 语义）；entity 字段对齐 V1（ddl-auto validate 集成测试通过） |
| 可维护性 | 分层清晰；ai/culture 各自 controller/service/vo；错误码集中 |
| 架构 | Controller→Service→Repository 单向；浏览器不直连 AI（承重墙）；降级规则引擎保留并回归 |

## 结论

**🔴 0、🟡 0（1 项已修复闭合），评审通过。**
