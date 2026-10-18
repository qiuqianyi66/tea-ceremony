package com.tea.ai.quality;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.entity.AiEvalTrace;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 评分编排的口径测试：幂等、LLM 降级、批量上限、judge_version 落库、异常不外抛、开关。
 * 仓储与 LLM 判官全部 mock：编排逻辑（先判后写、降级、跳过）不该为了断言去启动数据库；
 * 真库验证见 QualityMetricsIntegrationTest。
 */
@ExtendWith(MockitoExtension.class)
class QualityJudgeServiceTest {

    @Mock
    private QualityTraceRepository repository;

    @Mock
    private AnswerJudge llmJudge;

    @Mock
    private TeaFactsProvider teaFactsProvider;

    private final RuleBasedJudge ruleJudge = new RuleBasedJudge();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final QualityProperties enabledProps = new QualityProperties(true, 20, true);

    private final TeaFacts facts = new TeaFacts(
            Set.of("西湖龙井"),
            Set.of("绿茶"),
            Map.of("西湖龙井", "绿茶"),
            Map.of("西湖龙井", 80));

    private QualityJudgeService service;

    @BeforeEach
    void setUp() {
        service = new QualityJudgeService(repository, llmJudge, ruleJudge, teaFactsProvider,
                enabledProps, objectMapper);
    }

    private AiEvalTrace trace(long id, String output) {
        AiEvalTrace trace = new AiEvalTrace();
        trace.setId(id);
        trace.setAgentType("brewer");
        trace.setInputLayer("{\"question\":\"西湖龙井怎么泡\"}");
        trace.setOutput(output);
        trace.setExecLayer("{\"sources_count\":2}");
        return trace;
    }

    @Test
    void alreadyJudgedTraceIsSkipped() {
        // 抽样 SQL 已经过滤 NULL，这里模拟「取样本后被另一个实例评过」的竞态
        AiEvalTrace judged = trace(1L, "西湖龙井用80℃水温冲泡。");
        judged.setQualityLayer("{\"relevance\":5,\"judge_version\":\"rule-v1\"}");
        when(repository.findUnjudged(20)).thenReturn(List.of(judged));

        int count = service.judgeBatch();

        assertThat(count).isZero();
        verifyNoInteractions(llmJudge);
        verify(repository, never()).saveQuality(anyLong(), anyString());
    }

    @Test
    void llmFailureFallsBackToRuleAndWritesRuleVersion() {
        when(repository.findUnjudged(20)).thenReturn(List.of(trace(7L, "西湖龙井用80℃水温冲泡，投茶3克。")));
        when(llmJudge.judge(any())).thenReturn(Optional.empty());
        when(teaFactsProvider.current()).thenReturn(facts);
        when(repository.saveQuality(eq(7L), anyString())).thenReturn(1);

        int count = service.judgeBatch();

        assertThat(count).isEqualTo(1);
        ArgumentCaptor<String> layer = ArgumentCaptor.forClass(String.class);
        verify(repository).saveQuality(eq(7L), layer.capture());
        assertThat(layer.getValue())
                .contains("\"judge_version\":\"rule-v1\"")
                .contains("\"relevance\"")
                .contains("\"overall\"")
                .contains("\"judged_at\"");
    }

    @Test
    void llmSuccessWritesLlmVersionAndItsScores() {
        when(repository.findUnjudged(20)).thenReturn(List.of(trace(8L, "西湖龙井用80℃水温冲泡。")));
        when(llmJudge.judge(any())).thenReturn(Optional.of(new QualityScore(5, 4, 3, 2, LlmAnswerJudge.VERSION)));
        when(repository.saveQuality(eq(8L), anyString())).thenReturn(1);

        service.judgeBatch();

        ArgumentCaptor<String> layer = ArgumentCaptor.forClass(String.class);
        verify(repository).saveQuality(eq(8L), layer.capture());
        assertThat(layer.getValue())
                .contains("\"judge_version\":\"llm-v1\"")
                .contains("\"relevance\":5")
                .contains("\"groundedness\":4")
                .contains("\"overall\":3.5");
        // LLM 判成功时不该再去读茶表
        verifyNoInteractions(teaFactsProvider);
    }

    @Test
    void batchSizeFromConfigCapsTheQuery() {
        QualityJudgeService limited = new QualityJudgeService(repository, llmJudge, ruleJudge,
                teaFactsProvider, new QualityProperties(true, 5, false), objectMapper);
        when(repository.findUnjudged(5)).thenReturn(List.of());

        assertThat(limited.judgeBatch()).isZero();
        verify(repository).findUnjudged(5);
    }

    @Test
    void llmIsTriedOnceThenRulesTakeOverForTheRestOfTheBatch() {
        when(repository.findUnjudged(20)).thenReturn(List.of(
                trace(1L, "西湖龙井用80℃水温冲泡。"),
                trace(2L, "西湖龙井投茶3克。")));
        when(llmJudge.judge(any())).thenReturn(Optional.empty());
        when(teaFactsProvider.current()).thenReturn(facts);
        when(repository.saveQuality(anyLong(), anyString())).thenReturn(1);

        int count = service.judgeBatch();

        assertThat(count).isEqualTo(2);
        // 上游不可用时不再逐条等超时：整批只问一次 LLM
        verify(llmJudge, times(1)).judge(any());
        verify(repository, times(2)).saveQuality(anyLong(), anyString());
    }

    @Test
    void persistenceFailureDoesNotPropagate() {
        when(repository.findUnjudged(20)).thenReturn(List.of(trace(3L, "西湖龙井用80℃水温冲泡。")));
        when(llmJudge.judge(any())).thenReturn(Optional.empty());
        when(teaFactsProvider.current()).thenReturn(facts);
        when(repository.saveQuality(anyLong(), anyString())).thenThrow(new RuntimeException("db down"));

        assertThatCode(() -> service.judgeBatch()).doesNotThrowAnyException();
        assertThat(service.judgeBatch()).isZero();
    }

    @Test
    void judgeFailurePerTraceIsSwallowed() {
        when(repository.findUnjudged(20)).thenReturn(List.of(trace(4L, "西湖龙井用80℃水温冲泡。")));
        when(llmJudge.judge(any())).thenThrow(new IllegalStateException("judge exploded"));

        assertThatCode(() -> service.judgeBatch()).doesNotThrowAnyException();
        verify(repository, never()).saveQuality(anyLong(), anyString());
    }

    @Test
    void emptyCandidateListDoesNothing() {
        when(repository.findUnjudged(20)).thenReturn(List.of());

        assertThat(service.judgeBatch()).isZero();
        verifyNoInteractions(llmJudge, teaFactsProvider);
    }

    @Test
    void scheduledJudgeIsNoOpWhenDisabled() {
        QualityJudgeService disabled = new QualityJudgeService(repository, llmJudge, ruleJudge,
                teaFactsProvider, new QualityProperties(false, 20, true), objectMapper);

        disabled.scheduledJudge();

        verifyNoInteractions(repository, llmJudge, teaFactsProvider);
    }

    @Test
    void inputIsParsedFromTraceLayers() {
        when(repository.findUnjudged(20)).thenReturn(List.of(trace(5L, "西湖龙井用80℃水温冲泡。")));
        when(llmJudge.judge(any())).thenReturn(Optional.of(new QualityScore(4, 4, 4, 4, "llm-v1")));
        when(repository.saveQuality(eq(5L), anyString())).thenReturn(1);

        service.judgeBatch();

        ArgumentCaptor<JudgeInput> input = ArgumentCaptor.forClass(JudgeInput.class);
        verify(llmJudge).judge(input.capture());
        assertThat(input.getValue().question()).isEqualTo("西湖龙井怎么泡");
        assertThat(input.getValue().hasRetrieval()).isTrue();
        assertThat(input.getValue().agentType()).isEqualTo("brewer");
    }

    @Test
    void malformedJsonLayersDegradeToEmptyInputInsteadOfThrowing() {
        AiEvalTrace broken = trace(6L, "西湖龙井用80℃水温冲泡。");
        broken.setInputLayer("not-json");
        broken.setExecLayer(null);
        when(repository.findUnjudged(20)).thenReturn(List.of(broken));
        when(llmJudge.judge(any())).thenReturn(Optional.of(new QualityScore(3, 3, 3, 3, "llm-v1")));
        when(repository.saveQuality(eq(6L), anyString())).thenReturn(1);

        assertThatCode(() -> service.judgeBatch()).doesNotThrowAnyException();
        ArgumentCaptor<JudgeInput> input = ArgumentCaptor.forClass(JudgeInput.class);
        verify(llmJudge).judge(input.capture());
        assertThat(input.getValue().question()).isEmpty();
        assertThat(input.getValue().hasRetrieval()).isFalse();
    }
}
