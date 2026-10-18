-- ============================================================
-- ab-experiments 数据库回滚（downgrade）
-- 与 db-migrations.sql 成对；单表 + 两个索引，CASCADE 只用于兜底依赖对象
-- ============================================================

DROP TABLE IF EXISTS ab_experiments CASCADE;
