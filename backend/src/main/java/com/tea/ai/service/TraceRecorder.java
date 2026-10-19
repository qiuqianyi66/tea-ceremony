package com.tea.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.ComplexityLevel;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.repository.AiEvalTraceRepository;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * AI 评测 Trace 记录器（ADR-016 四层归因：输入/上下文/规划/执行 + 结果与效率）。
 * 旁路观测：记录失败不影响 AI 主流程（同 AiUsageLogger 语义）。
 * 生命周期：begin（入口，input/context/plan 层）→ complete（成功，output/exec/tokens/latency）→ fail（降级，error_code）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TraceRecorder {

    private final AiEvalTraceRepository repository;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;

    /** 入口埋点：input（原始问句 + 意图提示）+ context（历史锚定条数）+ plan（路由决策 + 复杂度档位）。不落库，等 complete/fail 统一保存。 */
    public AiEvalTrace begin(Integer sessionId, AgentType type, AiChatRequest req, AiChatRequest anchored, ComplexityLevel level) {
        return begin(sessionId, type, req, anchored, level, null, null, Map.of());
    }

    /**
     * 带 A/B 变体的入口埋点（ADR-024）。
     *
     * <p>为什么变体放 {@code plan_layer} 而不新建列/新表：实验结论只需要「按 variant 分组的
     * 调用/错误/延迟」，而这些字段本来就在 trace 里；加一列要迁移，加一张表要与 trace 对齐写。
     * 复用 JSONB 是最小改动面。</p>
     *
     * @param variant control / treatment；null 或空表示未参与实验，不写入（保持既有 trace 形状不变）
     */
    public AiEvalTrace begin(Integer sessionId, AgentType type, AiChatRequest req, AiChatRequest anchored,
                             ComplexityLevel level, String variant) {
        return begin(sessionId, type, req, anchored, level, variant, null, Map.of());
    }

    /**
     * 带实验归属的入口埋点（单实验）。
     *
     * <p>为什么要额外写 {@code experiment}：{@code ExperimentGuardService} 按
     * {@code (experiment, variant)} 分组对比。若 trace 只有 variant 没有 experiment，
     * 同时跑两个实验时同一 variant 的值会被混在一起统计，或者被整批忽略——两种都会让自动回滚失效。</p>
     */
    public AiEvalTrace begin(Integer sessionId, AgentType type, AiChatRequest req, AiChatRequest anchored,
                             ComplexityLevel level, String variant, String experimentKey) {
        return begin(sessionId, type, req, anchored, level, variant, experimentKey, Map.of());
    }

    /**
     * 带多实验归属的入口埋点：一次请求可能同时属于多个实验（兜底灰度 + librarian 工具调用）。
     *
     * <p>为什么用嵌套对象而不是并列的多个字段：实验是逐个上线的，字段名不能写死；
     * {@code experiments: {"<expKey>": "control|treatment"}} 让新增实验只改写入方，读侧按 key 取值。
     * 统计 SQL 以它为第一优先（见 {@code AbExperimentRepository#variantWindowStats}）。</p>
     *
     * <p>为什么仍写顶层 {@code variant}/{@code experiment}：历史行与既有查询都读这两个字段，
     * 保留它们等于保留兜底口径——统计 SQL 在 {@code experiments} 缺失时回落到这里。
     * 只在 variant 非空时写，未参与实验的 trace 形状与改造前一致。</p>
     *
     * @param experiments 实验键 → 变体；null 或空表示没有可归属的实验，不写入该字段
     */
    public AiEvalTrace begin(Integer sessionId, AgentType type, AiChatRequest req, AiChatRequest anchored,
                             ComplexityLevel level, String variant, String experimentKey,
                             Map<String, String> experiments) {
        AiEvalTrace trace = new AiEvalTrace();
        trace.setSessionId(sessionId);
        trace.setRequestId(UUID.randomUUID());
        String agent = agentOf(type, req);
        trace.setAgentType(agent);
        trace.setInputLayer(json(Map.of(
                "question", lastUserMessage(req),
                "agent_hint", req.agent() == null ? "" : req.agent())));
        trace.setContextLayer(json(Map.of(
                "anchor_count", anchored.messages().size() - req.messages().size())));
        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("agent_type", agent);
        plan.put("route", type == null ? "transparent" : "expert");
        plan.put("complexity", level == null ? "" : level.name());
        if (variant != null && !variant.isBlank()) {
            plan.put("variant", variant);
        }
        if (experimentKey != null && !experimentKey.isBlank()) {
            plan.put("experiment", experimentKey);
        }
        if (experiments != null && !experiments.isEmpty()) {
            plan.put("experiments", experiments);
        }
        trace.setPlanLayer(json(plan));
        return trace;
    }

    /** 成功收尾：output + exec（派发与来源）+ tokens/latency。 */
    public void complete(AiEvalTrace trace, AiChatVo vo) {
        trace.setOutput(vo.content());
        trace.setExecLayer(json(Map.of(
                "sources_count", vo.sources() == null ? 0 : vo.sources().size())));
        // tokens_in/out、latency_ms 是 NOT NULL：专家走两参构造 AiChatVo(content, sources) 时
        // 这三个字段为 null，直塞会 insert 失败且只落一条 warn（record 内 catch）→ Trace 静默丢失。null 归零。
        trace.setTokensIn(vo.tokensIn() == null ? 0 : vo.tokensIn());
        trace.setTokensOut(vo.tokensOut() == null ? 0 : vo.tokensOut());
        trace.setLatencyMs(vo.latencyMs() == null ? 0 : vo.latencyMs());
        record(trace);
    }

    /** 降级收尾：error_code 标记（502 承重墙），output 空串（NOT NULL）。 */
    public void fail(AiEvalTrace trace, RuntimeException e) {
        trace.setErrorCode(e instanceof BadGatewayException ? "BAD_GATEWAY" : "ERROR");
        trace.setOutput("");
        trace.setExecLayer(json(Map.of("error", e.getClass().getSimpleName())));
        record(trace);
    }

    /** 旁路保存：失败仅 warn + 计数（PR #43 教训：旁路埋点必须对落库成功率有观测，防静默丢数据）。 */
    public void record(AiEvalTrace trace) {
        try {
            repository.save(trace);
        } catch (Exception e) {
            log.warn("save eval trace failed: {}", e.getMessage());
            meterRegistry.counter("tea.ai.trace.save.failed").increment();
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "{}";
        }
    }

    private String agentOf(AgentType type, AiChatRequest req) {
        if (req.agent() != null && !req.agent().isBlank()) {
            return req.agent();
        }
        return type == null ? "chat" : type.name().toLowerCase();
    }

    private String lastUserMessage(AiChatRequest req) {
        for (int i = req.messages().size() - 1; i >= 0; i--) {
            var m = req.messages().get(i);
            if ("user".equals(m.role())) {
                String c = m.content();
                return c.length() > 500 ? c.substring(0, 500) : c;
            }
        }
        return "";
    }
}
