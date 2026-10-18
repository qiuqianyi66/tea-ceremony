-- ============================================================
-- telemetry-stability 数据库回滚（downgrade）
-- 与 db-migrations.sql 成对；顺序与 upgrade 相反（先子表后主表）
-- 三表之间无外键，CASCADE 只用于兜底依赖对象（索引随表自动删除）
-- ============================================================

DROP TABLE IF EXISTS slo_snapshots CASCADE;
DROP TABLE IF EXISTS error_fingerprints CASCADE;
DROP TABLE IF EXISTS telemetry_events CASCADE;
