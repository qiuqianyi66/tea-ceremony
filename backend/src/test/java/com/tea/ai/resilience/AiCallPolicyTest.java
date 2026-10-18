package com.tea.ai.resilience;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/**
 * AiCallPolicy 配置绑定测试。
 * 重点不是「record 里写了默认值」的重复实现，而是验证 Spring 真的把默认值绑进来了：
 * @DefaultValue 若失效，绑定结果会是 0/false 而不是默认值——这类静默失效只能靠上下文启动测出来。
 */
class AiCallPolicyTest {

    @Configuration
    @EnableConfigurationProperties(AiCallPolicy.class)
    static class PolicyConfig {
    }

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(PolicyConfig.class);

    @Test
    void missingPropertiesBindDocumentedDefaults() {
        runner.run(context -> {
            AiCallPolicy policy = context.getBean(AiCallPolicy.class);
            assertThat(policy.timeoutMs()).isEqualTo(20_000);
            assertThat(policy.maxAttempts()).isEqualTo(3);
            assertThat(policy.backoffBaseMs()).isEqualTo(800);
            assertThat(policy.backoffMultiplier()).isEqualTo(2.0);
            assertThat(policy.backoffJitterRatio()).isEqualTo(0.2);
            assertThat(policy.maxCallDepth()).isEqualTo(3);
            assertThat(policy.retryOnStatusCodes()).containsExactly(408, 429, 500, 502, 503, 504);
        });
    }

    @Test
    void configuredValuesOverrideDefaults() {
        runner.withPropertyValues(
                        "tea.ai.resilience.timeout-ms=1500",
                        "tea.ai.resilience.max-attempts=5",
                        "tea.ai.resilience.backoff-base-ms=0",
                        "tea.ai.resilience.backoff-multiplier=1.5",
                        "tea.ai.resilience.backoff-jitter-ratio=0",
                        "tea.ai.resilience.max-call-depth=2",
                        "tea.ai.resilience.retry-on-status-codes=500,503")
                .run(context -> {
                    AiCallPolicy policy = context.getBean(AiCallPolicy.class);
                    assertThat(policy.timeoutMs()).isEqualTo(1500);
                    assertThat(policy.maxAttempts()).isEqualTo(5);
                    // 0 是「不退避」的合法值，不能被归一成默认 800
                    assertThat(policy.backoffBaseMs()).isZero();
                    assertThat(policy.backoffMultiplier()).isEqualTo(1.5);
                    assertThat(policy.backoffJitterRatio()).isZero();
                    assertThat(policy.maxCallDepth()).isEqualTo(2);
                    assertThat(policy.retryOnStatusCodes()).containsExactly(500, 503);
                });
    }

    @Test
    void invalidValuesFallBackToDefaultsInsteadOfBreakingStartup() {
        AiCallPolicy policy = new AiCallPolicy(0, 0, -1, 0, -1, 0, List.of());

        assertThat(policy.timeoutMs()).isEqualTo(20_000);
        assertThat(policy.maxAttempts()).isEqualTo(3);
        assertThat(policy.backoffBaseMs()).isEqualTo(800);
        assertThat(policy.backoffMultiplier()).isEqualTo(2.0);
        assertThat(policy.backoffJitterRatio()).isEqualTo(0.2);
        assertThat(policy.maxCallDepth()).isEqualTo(3);
        assertThat(policy.retryOnStatusCodes()).containsExactly(408, 429, 500, 502, 503, 504);
    }

    @Test
    void jitterRatioIsClampedToOne() {
        AiCallPolicy policy = new AiCallPolicy(1000, 1, 0, 2.0, 5.0, 1, List.of(500));

        assertThat(policy.backoffJitterRatio()).isEqualTo(1.0);
    }

    @Test
    void defaultsFactoryMatchesBindingDefaults() {
        runner.run(context -> assertThat(AiCallPolicy.defaults())
                .isEqualTo(context.getBean(AiCallPolicy.class)));
    }
}
