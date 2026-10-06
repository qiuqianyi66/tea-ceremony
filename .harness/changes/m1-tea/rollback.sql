-- m1-tea V2 回滚（down）：删除种子数据 + 重置 identity 序列
-- 逆序删除（FK 依赖：teas→regions/processes；tasting_records→teas/teawares，当前无数据）
DELETE FROM teawares;
DELETE FROM tea_etiquettes;
DELETE FROM tea_poems;
DELETE FROM tea_people;
DELETE FROM teas;
DELETE FROM tea_processes;
DELETE FROM tea_regions;
ALTER TABLE tea_regions ALTER COLUMN id RESTART WITH 1;
ALTER TABLE tea_processes ALTER COLUMN id RESTART WITH 1;
ALTER TABLE teas ALTER COLUMN id RESTART WITH 1;
ALTER TABLE tea_people ALTER COLUMN id RESTART WITH 1;
ALTER TABLE tea_poems ALTER COLUMN id RESTART WITH 1;
ALTER TABLE teawares ALTER COLUMN id RESTART WITH 1;
ALTER TABLE tea_etiquettes ALTER COLUMN id RESTART WITH 1;
