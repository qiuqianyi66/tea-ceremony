-- AI 评测 Trace 迁移（up，与 V5__ai_eval_traces.sql 一致；依据 ADR-016）
CREATE TABLE ai_eval_traces (
    id            BIGSERIAL PRIMARY KEY,
    session_id    INTEGER REFERENCES ai_chat_sessions (id),
    request_id    UUID NOT NULL DEFAULT gen_random_uuid(),
    agent_type    VARCHAR(32) NOT NULL,
    input_layer   JSONB NOT NULL,
    context_layer JSONB NOT NULL DEFAULT '{}',
    plan_layer    JSONB,
    exec_layer    JSONB,
    output        TEXT NOT NULL,
    tokens_in     INTEGER NOT NULL DEFAULT 0,
    tokens_out    INTEGER NOT NULL DEFAULT 0,
    latency_ms    INTEGER NOT NULL DEFAULT 0,
    error_code    VARCHAR(32),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_eval_traces_agent ON ai_eval_traces (agent_type, created_at DESC);
