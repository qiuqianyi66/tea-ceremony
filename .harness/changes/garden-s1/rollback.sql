-- garden-s1 数据库变更（down）：与 V4 up 对称
-- 依据：ADR-015

-- 1) 反向数据迁移：planted 归并回 pending（仅回滚 V4 产生的值变化）
UPDATE garden_plants SET status = 'pending' WHERE status = 'planted';

-- 2) 删除扩展列 energy
ALTER TABLE garden_plants DROP COLUMN energy;

-- 3) 删除账本表（先外键再索引再表）
ALTER TABLE garden_energy_events DROP CONSTRAINT fk_garden_energy_events_user_id;
DROP INDEX uk_garden_energy_events_user_client;
DROP TABLE garden_energy_events;
