-- ============================================================
-- user-memory 数据库回滚（downgrade）
-- 与 db-migrations.sql 成对；语句顺序与 upgrade 相反（唯一索引/FK 随 DROP TABLE CASCADE 一并清除）。
-- 规则：upgrade/downgrade 往返测试通过才可提交（UserMemoryMigrationRoundTripTest，Testcontainers）。
-- ============================================================

DROP TABLE IF EXISTS user_memory CASCADE;
