package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.repository.AiEvalTraceRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

/**
 * TraceRecorder 旁路落库观测单测（PR #43 教训机械化）：
 * 落库失败不得抛断主流程，且必须计入 MeterRegistry（防静默丢数据）。
 */
class TraceRecorderTest {

    private final AiEvalTraceRepository repository = mock(AiEvalTraceRepository.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
    private final TraceRecorder recorder =
            new TraceRecorder(repository, new ObjectMapper(), meterRegistry);

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
}
