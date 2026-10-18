package com.tea.ai.quality;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.entity.AiEvalTrace;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 回答质量评分编排：抽样 → 优先 LLM 判 → 不可用降级规则判 → 幂等落库。
 *
 * 为什么是离线抽样而不是在请求链路上同步评分：
 * 1. 评分要调一次 LLM，同步做会把用户延迟翻倍；
 * 2. 质量分是「看趋势」的指标，分钟级滞后没有损失；
 * 3. 请求链路遇错必须降级返回内容（承重墙），而评分失败的正确处理是「这轮不评」，两者语义不同，不能混在同一条路径上。
 *
 * 数据源与口径：ai_eval_traces 中 error_code IS NULL（成功）且 quality_layer IS NULL（未评分）的行。
 * 落库写在 quality_layer（JSONB），不新建表：质量分是 trace 的派生属性，1:1 且随 trace 生命周期产生，
 * 独立建表只会引入一次额外关联和「trace 归档后评分孤儿行」这类一致性维护。
 *
 * 幂等三层：
 * 1. 抽样 SQL 只取 quality_layer IS NULL（http 层）；
 * 2. 循环内再判一次实体字段（本进程内重入/上游改动）；
 * 3. UPDATE ... WHERE quality_layer IS NULL（库层，多实例并发时后到者影响 0 行）。
 * judge_version 记录评分器版本（rule-v1 / llm-v1），换版后可按版本筛出需重算的行。
 *
 * 失败语义：任何单条异常都吞掉并记 warn——评分是旁路，不能让定时任务或主流程受影响。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class QualityJudgeService {

    private final QualityTraceRepository repository;
    private final AnswerJudge llmJudge;
    private final RuleBasedJudge ruleJudge;
    private final TeaFactsProvider teaFactsProvider;
    private final QualityProperties properties;
    private final ObjectMapper objectMapper;

    /** 定时入口：默认关闭（tea.ai.quality.enabled），LLM 评分有成本，开不开由部署方决定。 */
    @Scheduled(fixedDelay = 600_000, initialDelay = 120_000)
    public void scheduledJudge() {
        if (!properties.enabled()) {
            return;
        }
        int judged = judgeBatch();
        if (judged > 0) {
            log.info("质量评分批次完成：judged={} batchSize={}", judged, properties.batchSize());
        }
    }

    /**
     * 跑一批：最多 properties.batchSize() 条。返回成功落库条数。
     *
     * 不检查 enabled：开关只控制定时任务（运维开关），手动/测试调用应当能直接跑。
     * 不抛异常：调用方是定时线程，抛出去只会污染调度日志。
     */
    public int judgeBatch() {
        List<AiEvalTrace> candidates;
        try {
            candidates = repository.findUnjudged(properties.batchSize());
        } catch (RuntimeException e) {
            log.warn("读取待评分 trace 失败，本轮跳过: {}", e.getMessage());
            return 0;
        }
        if (candidates.isEmpty()) {
            return 0;
        }
        // 一旦 LLM 判不了（没 key / 熔断 / 上游 502），本批剩余样本改用规则版：
        // 否则一次上游故障要从每条 trace 上各等一次超时，一批 20 条能把定时任务拖过下个周期。
        boolean llmUsable = properties.llmEnabled();
        int judged = 0;
        for (AiEvalTrace trace : candidates) {
            try {
                if (trace.getQualityLayer() != null && !trace.getQualityLayer().isBlank()) {
                    continue; // 幂等：取样本后被别的实例评过
                }
                JudgeInput input = inputOf(trace);
                QualityScore score = null;
                if (llmUsable) {
                    Optional<QualityScore> llmScore = llmJudge.judge(input);
                    if (llmScore.isPresent()) {
                        score = llmScore.get();
                    } else {
                        llmUsable = false;
                        log.warn("LLM 评分不可用，本批剩余 trace 改用规则评分（judge={}）", RuleBasedJudge.VERSION);
                    }
                }
                if (score == null) {
                    score = ruleJudge.judge(input, teaFactsProvider.current());
                }
                if (repository.saveQuality(trace.getId(), toLayerJson(score)) > 0) {
                    judged++;
                }
            } catch (RuntimeException e) {
                // 单条失败不影响批次：把坏样本留在未评分状态，下一轮重试
                log.warn("trace 质量评分失败 id={} type={}: {}",
                        trace.getId(), e.getClass().getSimpleName(), e.getMessage());
            }
        }
        return judged;
    }

    /** trace 的四层 JSONB → 评分输入。解析失败按空串处理（评分器对空值有明确口径）。 */
    JudgeInput inputOf(AiEvalTrace trace) {
        String question = textField(trace.getInputLayer(), "question");
        boolean retrieved = numberField(trace.getExecLayer(), "sources_count") > 0;
        return new JudgeInput(question, trace.getOutput(), retrieved, trace.getAgentType());
    }

    /** 评分 → JSONB 文本。键名是聚合 SQL 的取值依据（QualityTraceRepository），改名要同步改 SQL。 */
    String toLayerJson(QualityScore score) {
        Map<String, Object> layer = new LinkedHashMap<>();
        layer.put("relevance", score.relevance());
        layer.put("groundedness", score.groundedness());
        layer.put("actionability", score.actionability());
        layer.put("tone", score.tone());
        layer.put("overall", score.overall());
        layer.put("judge_version", score.judgeVersion());
        layer.put("judged_at", Instant.now().toString());
        try {
            return objectMapper.writeValueAsString(layer);
        } catch (Exception e) {
            throw new IllegalStateException("评分序列化失败", e);
        }
    }

    private String textField(String json, String field) {
        JsonNode root = parse(json);
        return root == null ? "" : root.path(field).asText("");
    }

    private double numberField(String json, String field) {
        JsonNode root = parse(json);
        return root == null ? 0 : root.path(field).asDouble(0);
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            // 历史 trace 的 JSONB 形状不保证（手工修数/旧版本），坏数据不该让整批评分停摆
            return null;
        }
    }
}
