-- ============================================================
-- {feat-name} 数据库回滚（downgrade）
-- 与 db-migrations.sql 成对；语句顺序与 upgrade 相反。
-- 规则：upgrade/downgrade 往返测试通过才可提交。
-- ============================================================

-- 示例（与 db-migrations.sql 一一对应，顺序相反）：
-- DROP INDEX idx_{table}_{column};
-- ALTER TABLE {table} DROP COLUMN {column};
