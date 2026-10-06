-- m1-backend-skeleton V1 初始迁移（down）
-- 逆序删除（先删有外键的表，再删被引用表）
DROP TABLE IF EXISTS ai_usage_logs;
DROP TABLE IF EXISTS agent_prompts;
DROP TABLE IF EXISTS garden_plants;
DROP TABLE IF EXISTS tasting_records;
DROP TABLE IF EXISTS tea_relations;
DROP TABLE IF EXISTS tea_etiquettes;
DROP TABLE IF EXISTS teawares;
DROP TABLE IF EXISTS tea_poems;
DROP TABLE IF EXISTS tea_people;
DROP TABLE IF EXISTS teas;
DROP TABLE IF EXISTS tea_processes;
DROP TABLE IF EXISTS tea_regions;
DROP TABLE IF EXISTS users;
