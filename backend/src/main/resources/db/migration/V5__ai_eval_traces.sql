-- V5: AI 评测 Trace 四层归因（up）
-- 依据：ADR-016（ai_eval_traces 评测底座）+ REQ-ai-project F-A1（四层归因 Trace）
-- 说明：session_id 可空（游客会话不落 ai_chat_sessions，null=游客）；四层 JSONB 存归因快照

CREATE TABLE ai_eval_traces (
    id            BIGSERIAL PRIMARY KEY,
    session_id    INTEGER REFERENCES ai_chat_sessions (id),
    request_id    UUID NOT NULL DEFAULT gen_random_uuid(),
    agent_type    VARCHAR(32) NOT NULL,
    input_layer   JSONB NOT NULL,          -- 输入：原始问句 + 解析后意图
    context_layer JSONB NOT NULL DEFAULT '{}',  -- 上下文：历史锚定条数 + 检索命中（快照）
    plan_layer    JSONB,                   -- 规划：路由决策 + 复杂度档位
    exec_layer    JSONB,                   -- 执行：工具/检索调用 + 降级标记
    output        TEXT NOT NULL,
    tokens_in     INTEGER NOT NULL DEFAULT 0,
    tokens_out    INTEGER NOT NULL DEFAULT 0,
    latency_ms    INTEGER NOT NULL DEFAULT 0,
    error_code    VARCHAR(32),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ai_eval_traces IS 'AI 评测四层归因 Trace（append-only；输入/上下文/规划/执行 + 结果与效率）';
CREATE INDEX idx_eval_traces_agent ON ai_eval_traces (agent_type, created_at DESC);
