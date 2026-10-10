package com.tea.ai.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.ComplexityLevel;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.repository.AiEvalTraceRepository;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
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

    /** 入口埋点：input（原始问句 + 意图提示）+ context（历史锚定条数）+ plan（路由决策 + 复杂度档位）。不落库，等 complete/fail 统一保存。 */
    public AiEvalTrace begin(Integer sessionId, AgentType type, AiChatRequest req, AiChatRequest anchored, ComplexityLevel level) {
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
        trace.setPlanLayer(json(Map.of(
                "agent_type", agent,
                "route", type == null ? "transparent" : "expert",
                "complexity", level == null ? "" : level.name())));
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

    /** 旁路保存：失败仅 warn。 */
    public void record(AiEvalTrace trace) {
        try {
            repository.save(trace);
        } catch (Exception e) {
            log.warn("save eval trace failed: {}", e.getMessage());
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
