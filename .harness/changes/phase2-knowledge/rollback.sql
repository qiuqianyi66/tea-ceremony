-- m1-tea V7 回滚（down）：清空 V7 回填的关系（V7 前 tea_relations 为空表）
DELETE FROM tea_relations;
ALTER TABLE tea_relations ALTER COLUMN id RESTART WITH 1;
