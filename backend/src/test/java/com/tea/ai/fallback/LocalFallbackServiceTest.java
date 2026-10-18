package com.tea.ai.fallback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.tea.tea.entity.Tea;
import com.tea.tea.repository.TeaRepository;
import com.tea.ware.repository.TeaWareRepository;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 兜底服务的两条硬约束：命中要可观测（tea.ai.fallback.hit{rule}）、失败只能降级为 empty。
 * 数据库不可用恰恰是兜底最可能被触发的时刻，所以「取数抛异常」必须有用例守着。
 */
class LocalFallbackServiceTest {

    private final TeaRepository teaRepository = mock(TeaRepository.class);
    private final TeaWareRepository teaWareRepository = mock(TeaWareRepository.class);
    private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();

    private LocalFallbackService service() {
        return new LocalFallbackService(teaRepository, teaWareRepository, meterRegistry);
    }

    private Tea greenTea() {
        Tea tea = new Tea();
        tea.setName("西湖龙井");
        tea.setCategory("绿茶");
        tea.setBestTemp(80);
        tea.setBestTime(60);
        tea.setInfusions(3);
        tea.setOrigin("浙江杭州");
        tea.setDescription("扁平光滑，色泽翠绿。");
        return tea;
    }

    @Test
    void hitIsCountedWithRuleTag() {
        when(teaRepository.findAll()).thenReturn(List.of(greenTea()));
        when(teaWareRepository.findAll()).thenReturn(List.of());

        assertThat(service().answerFor("西湖龙井水温多少")).hasValueSatisfying(
                answer -> assertThat(answer).contains("80℃"));

        assertThat(meterRegistry.get(LocalFallbackService.METRIC_HIT)
                .tag("rule", AiLocalRuleEngine.RULE_WATER_TEMP)
                .counter()
                .count()).isEqualTo(1.0);
    }

    @Test
    void missDoesNotCount() {
        when(teaRepository.findAll()).thenReturn(List.of(greenTea()));
        when(teaWareRepository.findAll()).thenReturn(List.of());

        assertThat(service().answerFor("帮我写个 Java 排序")).isEmpty();
        // 未命中不该产生打点（计数器根本不该被创建）
        assertThat(meterRegistry.find(LocalFallbackService.METRIC_HIT)
                .tag("rule", AiLocalRuleEngine.RULE_WATER_TEMP)
                .counter()).isNull();
    }

    @Test
    void databaseFailureDegradesToEmptyInsteadOfThrowing() {
        when(teaRepository.findAll()).thenThrow(new IllegalStateException("数据库不可用"));

        assertThatCode(() -> assertThat(service().answerFor("绿茶水温多少")).isEmpty())
                .doesNotThrowAnyException();
    }

    @Test
    void blankQuestionReturnsEmptyWithoutTouchingDatabase() {
        assertThat(service().answerFor(null)).isEmpty();
        assertThat(service().answerFor("   ")).isEmpty();
        org.mockito.Mockito.verify(teaRepository, org.mockito.Mockito.never()).findAll();
    }
}
