-- ============================================================
-- {feat-name} 回滚脚本（down）
-- 规则：与 db-migrations.sql 严格成对；必须可逆
-- ============================================================

-- 示例（与 up 脚本一一对应，顺序相反）：
-- DROP INDEX IF EXISTS ix_{table}_{col};
-- ALTER TABLE {table_name} DROP COLUMN IF EXISTS {col};
-- DROP TABLE IF EXISTS {table_name};
