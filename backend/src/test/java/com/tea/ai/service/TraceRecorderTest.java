package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.ComplexityLevel;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.repository.AiEvalTraceRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * TraceRecorder 旁路落库观测单测（PR #43 教训机械化）：
 * 落库失败不得抛断主流程，且必须计入 MeterRegistry（防静默丢数据）。
 *
 * <p>另覆盖 plan_layer 的实验归属写入形状：多实验（experiments 对象）与历史单实验（variant/experiment）。
 */
class TraceRecorderTest {

    private static final String FALLBACK_KEY = "ai.fallback.rollout";
    private static final String TOOL_KEY = "ai.librarian.tool-calling";

    private final AiEvalTraceRepository repository = mock(AiEvalTraceRepository.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final TraceRecorder recorder =
            new TraceRecorder(repository, objectMapper, meterRegistry);

    @Test
    void saveFailureIsSwallowedAndCounted() {
        when(repository.save(any(AiEvalTrace.class))).thenThrow(new RuntimeException("db down"));

        assertThatCode(() -> recorder.record(new AiEvalTrace()))
                .doesNotThrowAnyException();

        assertThat(meterRegistry.counter("tea.ai.trace.save.failed").count()).isEqualTo(1.0);
    }

    @Test
    void saveSuccessIsNotCountedAsFailure() {
        when(repository.save(any(AiEvalTrace.class))).thenAnswer(inv -> inv.getArgument(0));

        recorder.record(new AiEvalTrace());

        assertThat(meterRegistry.find("tea.ai.trace.save.failed").counter()).isNull();
    }

    @Test
    void experimentsMapIsWrittenAsNestedObject() throws Exception {
        AiEvalTrace trace = recorder.begin(null, AgentType.LIBRARIAN, request(), request(), ComplexityLevel.MEDIUM,
                null, null, Map.of(TOOL_KEY, "treatment"));

        JsonNode plan = planOf(trace);
        assertThat(plan.path("experiments").path(TOOL_KEY).asText()).isEqualTo("treatment");
        // 没传 variant：顶层历史字段不出现，未参与实验的 trace 形状与改造前一致
        assertThat(plan.has("variant")).isFalse();
        assertThat(plan.has("experiment")).isFalse();
    }

    @Test
    void emptyExperimentsAreNotWritten() throws Exception {
        // 空 map 与 null 都表示「没有可归属的实验」：不写空对象，避免下游把 {} 当成「参与过实验」
        assertThat(planOf(recorder.begin(null, AgentType.LIBRARIAN, request(), request(),
                ComplexityLevel.MEDIUM, null, null, Map.of())).has("experiments")).isFalse();
        assertThat(planOf(recorder.begin(null, AgentType.LIBRARIAN, request(), request(),
                ComplexityLevel.MEDIUM, null, null, null)).has("experiments")).isFalse();
    }

    @Test
    void legacyVariantAndExperimentStillWrittenAlongsideExperiments() throws Exception {
        AiEvalTrace trace = recorder.begin(null, AgentType.LIBRARIAN, request(), request(), ComplexityLevel.MEDIUM,
                "control", FALLBACK_KEY,
                Map.of(FALLBACK_KEY, "control", TOOL_KEY, "treatment"));

        JsonNode plan = planOf(trace);
        // 历史行与既有 SQL 兜底读这两个字段，必须继续写
        assertThat(plan.path("variant").asText()).isEqualTo("control");
        assertThat(plan.path("experiment").asText()).isEqualTo(FALLBACK_KEY);
        assertThat(plan.path("experiments").path(FALLBACK_KEY).asText()).isEqualTo("control");
        assertThat(plan.path("experiments").path(TOOL_KEY).asText()).isEqualTo("treatment");
    }

    private static AiChatRequest request() {
        return new AiChatRequest(List.of(new ChatMessageDto("user", "讲讲龙井")), null, null);
    }

    private JsonNode planOf(AiEvalTrace trace) throws Exception {
        return objectMapper.readTree(trace.getPlanLayer());
    }
}
