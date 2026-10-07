-- m5-s2 V3 迁移（down / 回滚，与 db-migrations.sql 成对）
-- 顺序与 up 相反（先子后父，先表后扩展）
DROP TABLE IF EXISTS ai_messages;
DROP TABLE IF EXISTS ai_chat_sessions;
DROP TABLE IF EXISTS culture_chunks;
DROP EXTENSION IF EXISTS pg_trgm;
DROP EXTENSION IF EXISTS vector;
