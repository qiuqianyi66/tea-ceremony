-- V10: AI 回答质量评分（quality layer）
-- 依据：AI 黄金指标只覆盖成功率/错误率/延迟，缺「答得好不好」的度量（需求见 QualityJudgeService javadoc）。
-- 为什么是 ai_eval_traces 上的一个 JSONB 列而不是新表：质量分是 trace 的派生属性（1:1，随 trace 生命周期产生），
-- 建表会引入一次额外关联与一致性维护（trace 删除/归档时孤儿行）；JSONB 让维度增减不需要再迁移。
-- 为什么可空：NULL = 未评分（抽样是异步的，绝大多数行在评分前就是 NULL），不能默认 0 分——0 会被读成「答得很差」。

ALTER TABLE ai_eval_traces ADD COLUMN quality_layer JSONB;

COMMENT ON COLUMN ai_eval_traces.quality_layer IS
    '离线质量评分（relevance/groundedness/actionability/tone 各 1-5 + overall + judge_version + judged_at）；NULL = 未评分';

-- 抽样查询固定形态：error_code IS NULL AND quality_layer IS NULL ORDER BY created_at。
-- 部分索引只覆盖「待评分」子集，不随已评分历史增长（全量 B-tree 会一直变大）。
CREATE INDEX idx_eval_traces_unjudged
    ON ai_eval_traces (created_at)
    WHERE quality_layer IS NULL AND error_code IS NULL;
