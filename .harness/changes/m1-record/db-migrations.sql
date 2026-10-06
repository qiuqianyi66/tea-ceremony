-- m1-record 数据库变更（up）：无
-- T8 品鉴记录域为纯代码迁移：tasting_records 表 / 幂等唯一索引 / FK 在 V1__init.sql 已建（2026-10-06 批 A），
-- 本切片零 schema 变更。后续如需变更，追加 V3+ 迁移脚本（成对 + 往返验证）。
SELECT 1;
