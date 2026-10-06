---
name: slow-sql
description: 慢 SQL 排查——定位慢查询（日志/EXPLAIN/索引），修 N+1/缺索引/全表扫描，验证执行计划。故障排查 01。
---

# Slow SQL

## 触发
- 接口变慢/数据库告警；慢查询日志（≥100ms）出现。

## 工作流
1. 定位：慢查询日志 → 找 SQL → 参数化复现。
2. 诊断：EXPLAIN ANALYZE（seq scan？缺索引？N+1？）。
3. 修复：补索引（ix_{table}_{col}）/ 改查询（fetch join/@EntityGraph）/ 分页 / 批量化。
4. 验证：执行计划对比（cost 下降）+ 往返测试（若有迁移）。
5. 回归：相关接口压测确认 P99 达标。

## 自检
- [ ] EXPLAIN 显示索引命中
- [ ] 无 N+1 / 全表扫描
- [ ] P99 达标
- [ ] 迁移成对（如有）
