-- V9: A/B 实验与异常指标自动回滚（up）
-- 依据：控制爆炸半径要求（双轨流量调度 + 异常指标触发器 + 毫秒级无损回滚）
-- 说明：只有一张表，且**不建 assignment 表**——分桶用确定性哈希（SHA-256(expKey:subjectId) → floorMod 100），
--       无状态：同 (exp_key, subject_id) 永远落同一桶，不需要写放大，也不需要为「谁被分到哪组」落库；
--       variants / guardrail 用 JSONB：实验参数随策略演进，加参数不该再加一次迁移。
-- 命名：唯一约束 uk_ / 索引 ix_ / 检查约束 ck_（编码规范 §29）

CREATE TABLE ab_experiments (
    id                BIGSERIAL    PRIMARY KEY,
    exp_key           VARCHAR(64)  NOT NULL,   -- 实验标识，如 ai.fallback.enabled
    name              VARCHAR(128) NOT NULL,
    description       TEXT,
    status            VARCHAR(16)  NOT NULL DEFAULT 'draft',   -- draft|running|paused|stopped
    traffic_percent   SMALLINT     NOT NULL DEFAULT 10,        -- 实验组占比 0-100
    variants          JSONB        NOT NULL DEFAULT '{}',      -- {"control":{...},"treatment":{...}}
    guardrail         JSONB        NOT NULL DEFAULT '{}',      -- 见 ExperimentGuardService 默认值
    sample_size       INTEGER      NOT NULL DEFAULT 0,         -- 最近一次评估的样本数
    last_evaluated_at TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    stopped_at        TIMESTAMPTZ,
    stop_reason       VARCHAR(256),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- CHECK：状态与占比在库层兜底，非法值不靠应用层单点防空
    CONSTRAINT ck_ab_experiments_status CHECK (status IN ('draft', 'running', 'paused', 'stopped')),
    CONSTRAINT ck_ab_experiments_traffic CHECK (traffic_percent >= 0 AND traffic_percent <= 100)
);
COMMENT ON TABLE ab_experiments IS 'A/B 实验（流量分桶无状态、不落 assignment；guardrail 决定自动回滚判据）';
COMMENT ON COLUMN ab_experiments.id IS '自增主键';
COMMENT ON COLUMN ab_experiments.exp_key IS '实验标识（唯一，如 ai.fallback.enabled）；同时作为分桶哈希前缀';
COMMENT ON COLUMN ab_experiments.name IS '实验名称（人读）';
COMMENT ON COLUMN ab_experiments.description IS '实验目的与预期（改策略前写清为什么灰度）';
COMMENT ON COLUMN ab_experiments.status IS '状态：draft 草稿 / running 运行中 / paused 暂停 / stopped 已停止';
COMMENT ON COLUMN ab_experiments.traffic_percent IS '实验组（treatment）流量占比 0-100；0 表示全量走 control，100 表示全量走 treatment';
COMMENT ON COLUMN ab_experiments.variants IS '变体配置 JSONB：{"control":{...},"treatment":{...}}；策略参数由消费方解释';
COMMENT ON COLUMN ab_experiments.guardrail IS '回滚阈值 JSONB：{maxErrorRateDelta,maxP99Ratio,minSampleSize}；缺省键按服务端默认值';
COMMENT ON COLUMN ab_experiments.sample_size IS '最近一次评估的样本数（control+treatment 窗口内 trace 行数）';
COMMENT ON COLUMN ab_experiments.last_evaluated_at IS '最近一次评估时间（样本不足也更新，用于区分「没跑」与「跑了样本不够」）';
COMMENT ON COLUMN ab_experiments.started_at IS '本轮启动时间（每次 start 覆盖，含 paused 恢复）';
COMMENT ON COLUMN ab_experiments.stopped_at IS '停止时间（人工停止或自动回滚）';
COMMENT ON COLUMN ab_experiments.stop_reason IS '停止原因；自动回滚写 auto_rollback: <具体触发指标>';
COMMENT ON COLUMN ab_experiments.created_at IS '创建时间';
COMMENT ON COLUMN ab_experiments.updated_at IS '更新时间（应用层写入，未用触发器：与既有表保持一致）';

CREATE UNIQUE INDEX uk_ab_experiments_key ON ab_experiments (exp_key);
CREATE INDEX ix_ab_experiments_status ON ab_experiments (status, updated_at DESC);
