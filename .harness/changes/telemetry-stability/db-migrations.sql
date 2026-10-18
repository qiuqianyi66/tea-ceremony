-- ============================================================
-- telemetry-stability 数据库迁移（upgrade）
-- 与 backend/src/main/resources/db/migration/V8__telemetry.sql 逐字一致（Flyway V8）
-- 依据：ADR-022 + docs/reference/telemetry-contract.md §9/§10
-- ============================================================
-- V8: 遥测接收与 SLO 评估（up）
-- 依据：ADR-022（匿名遥测上报）+ docs/reference/telemetry-contract.md §9/§10（契约唯一真源）
-- 说明：三张表属同一切片，一次建齐避免半套 schema；telemetry_events 存 raw 事件（7 天保留），
--       error_fingerprints 存错误归并（永久），slo_snapshots 存 15 分钟窗口快照（永久）。
-- 命名：唯一约束 uk_ / 索引 ix_ / 外键 fk_（编码规范 §29）

-- 1) telemetry_events：遥测原始事件（error | vital）
-- client_event_id 唯一约束是上报幂等根基（契约 §9：ON CONFLICT DO NOTHING）
CREATE TABLE telemetry_events (
    id             BIGSERIAL        PRIMARY KEY,
    client_event_id UUID            NOT NULL,
    client_id      UUID             NOT NULL,
    session_id     UUID             NOT NULL,
    app_version    VARCHAR(32),
    event_type     VARCHAR(16)      NOT NULL,
    route          VARCHAR(128),
    fingerprint    VARCHAR(32),
    message        TEXT,
    stack          TEXT,
    source_file    VARCHAR(256),
    line_no        INTEGER,
    col_no         INTEGER,
    metric_name    VARCHAR(16),
    metric_value   DOUBLE PRECISION,
    metric_rating  VARCHAR(24),
    occurred_at    TIMESTAMPTZ      NOT NULL,
    received_at    TIMESTAMPTZ      NOT NULL DEFAULT now()
);
COMMENT ON TABLE telemetry_events IS '遥测原始事件（error/vital，脱敏后入库；client_event_id 唯一键承载上报幂等）';
COMMENT ON COLUMN telemetry_events.id IS '自增主键';
COMMENT ON COLUMN telemetry_events.client_event_id IS '客户端事件 UUID，幂等键（重复上报只计 duplicated）';
COMMENT ON COLUMN telemetry_events.client_id IS '设备级匿名 UUID，不关联用户账号';
COMMENT ON COLUMN telemetry_events.session_id IS '会话级 UUID';
COMMENT ON COLUMN telemetry_events.app_version IS '前端应用版本，用于按版本对比指标';
COMMENT ON COLUMN telemetry_events.event_type IS '事件类型：error 脚本错误 / vital Web Vitals';
COMMENT ON COLUMN telemetry_events.route IS '发生路由 path（不含 query）';
COMMENT ON COLUMN telemetry_events.fingerprint IS '错误指纹 16 位 hex（error 事件必填，契约 §5 算法）';
COMMENT ON COLUMN telemetry_events.message IS '脱敏后错误消息（上限 500 字符）';
COMMENT ON COLUMN telemetry_events.stack IS '脱敏后错误堆栈（上限 4000 字符）';
COMMENT ON COLUMN telemetry_events.source_file IS '错误来源文件 pathname（上限 256 字符）';
COMMENT ON COLUMN telemetry_events.line_no IS '错误行号（可空，参与指纹分桶）';
COMMENT ON COLUMN telemetry_events.col_no IS '错误列号（可空，仅定位用，不参与指纹）';
COMMENT ON COLUMN telemetry_events.metric_name IS 'vital 指标名：LCP/INP/CLS/FCP/TTFB（error 事件为空）';
COMMENT ON COLUMN telemetry_events.metric_value IS 'vital 指标值（ms 或 CLS 无量纲）';
COMMENT ON COLUMN telemetry_events.metric_rating IS 'vital 评级原值：good/needs-improvement/poor';
COMMENT ON COLUMN telemetry_events.occurred_at IS '事件发生时间（客户端时钟）';
COMMENT ON COLUMN telemetry_events.received_at IS '服务端接收时间（保留策略与写入速率观测依据）';
CREATE UNIQUE INDEX uk_telemetry_events_client_event ON telemetry_events (client_event_id);
CREATE INDEX ix_telemetry_events_type_time ON telemetry_events (event_type, occurred_at DESC);
CREATE INDEX ix_telemetry_events_metric_time ON telemetry_events (metric_name, occurred_at DESC);
CREATE INDEX ix_telemetry_events_expiry ON telemetry_events (occurred_at);

-- 2) error_fingerprints：同一 bug 的不同实例归并成一条（Human-in-the-Loop 审批对象）
CREATE TABLE error_fingerprints (
    id                BIGSERIAL   PRIMARY KEY,
    fingerprint       VARCHAR(32) NOT NULL,
    sample_message    TEXT        NOT NULL,
    sample_stack      TEXT,
    route             VARCHAR(128),
    first_seen_at     TIMESTAMPTZ NOT NULL,
    last_seen_at      TIMESTAMPTZ NOT NULL,
    occurrences       BIGINT      NOT NULL DEFAULT 1,
    affected_sessions BIGINT      NOT NULL DEFAULT 1,
    review_status     VARCHAR(16) NOT NULL DEFAULT 'pending',
    reviewed_by       VARCHAR(64),
    reviewed_at       TIMESTAMPTZ,
    review_note       TEXT
);
COMMENT ON TABLE error_fingerprints IS '错误指纹归并表（永久保留；首次出现 pending，人工审批流转 resolved）';
COMMENT ON COLUMN error_fingerprints.id IS '自增主键';
COMMENT ON COLUMN error_fingerprints.fingerprint IS '指纹 16 位小写 hex（唯一，契约 §5）';
COMMENT ON COLUMN error_fingerprints.sample_message IS '最近一次脱敏消息样本';
COMMENT ON COLUMN error_fingerprints.sample_stack IS '最近一次脱敏堆栈样本';
COMMENT ON COLUMN error_fingerprints.route IS '最近一次发生路由';
COMMENT ON COLUMN error_fingerprints.first_seen_at IS '首次出现时间';
COMMENT ON COLUMN error_fingerprints.last_seen_at IS '最近出现时间';
COMMENT ON COLUMN error_fingerprints.occurrences IS '累计出现次数（每次入库 +1）';
COMMENT ON COLUMN error_fingerprints.affected_sessions IS '受影响会话数（当前按首次插入记 1）';
COMMENT ON COLUMN error_fingerprints.review_status IS '审批状态：pending 待处理 / acknowledged 已确认 / ignored 已忽略 / resolved 已解决';
COMMENT ON COLUMN error_fingerprints.reviewed_by IS '审批人（登录用户名）';
COMMENT ON COLUMN error_fingerprints.reviewed_at IS '审批时间';
COMMENT ON COLUMN error_fingerprints.review_note IS '审批备注';
CREATE UNIQUE INDEX uk_error_fingerprints_fp ON error_fingerprints (fingerprint);
CREATE INDEX ix_error_fingerprints_review ON error_fingerprints (review_status, last_seen_at DESC);

-- 3) slo_snapshots：15 分钟窗口聚合快照（永久保留，趋势与错误预算基线）
CREATE TABLE slo_snapshots (
    id           BIGSERIAL        PRIMARY KEY,
    window_start TIMESTAMPTZ      NOT NULL,
    window_end   TIMESTAMPTZ      NOT NULL,
    metric       VARCHAR(16)      NOT NULL,
    p75          DOUBLE PRECISION,
    sample_count INTEGER          NOT NULL,
    slo_target   DOUBLE PRECISION NOT NULL,
    slo_met      BOOLEAN          NOT NULL,
    created_at   TIMESTAMPTZ      NOT NULL DEFAULT now()
);
COMMENT ON TABLE slo_snapshots IS 'SLO 15 分钟窗口快照（窗口+指标唯一，永久保留）';
COMMENT ON COLUMN slo_snapshots.id IS '自增主键';
COMMENT ON COLUMN slo_snapshots.window_start IS '窗口起点（含）';
COMMENT ON COLUMN slo_snapshots.window_end IS '窗口终点（不含）';
COMMENT ON COLUMN slo_snapshots.metric IS '指标名：LCP/INP/CLS/FCP/TTFB';
COMMENT ON COLUMN slo_snapshots.p75 IS '窗口内 P75 分位（无样本为空）';
COMMENT ON COLUMN slo_snapshots.sample_count IS '窗口内样本数（0 表示无样本）';
COMMENT ON COLUMN slo_snapshots.slo_target IS '快照时点的 SLO 目标值（目标调整后历史仍可解释）';
COMMENT ON COLUMN slo_snapshots.slo_met IS '是否达标（P75 小于等于目标）';
COMMENT ON COLUMN slo_snapshots.created_at IS '快照生成时间';
CREATE UNIQUE INDEX uk_slo_snapshots_window_metric ON slo_snapshots (window_start, metric);
CREATE INDEX ix_slo_snapshots_window ON slo_snapshots (window_start DESC);
