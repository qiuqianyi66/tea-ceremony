package com.tea.telemetry;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.telemetry.config.TelemetryProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/**
 * 配置绑定验证（契约 §6 常量必须来自配置，不能写死在 Service）。
 * 这里用 ApplicationContextRunner 而不是纯 new：嵌套对象（lcp/inp/cls…）的绑定是反射行为，
 * 字段名与 yml 键名对不上时不会报错、只会静默用默认值——那种漂移必须在测试里显式钉住。
 */
class TelemetryPropertiesTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(BindingConfig.class);

    @Configuration
    @EnableConfigurationProperties(TelemetryProperties.class)
    static class BindingConfig {
    }

    @Test
    void defaultsMatchContractConstants() {
        runner.run(context -> {
            TelemetryProperties props = context.getBean(TelemetryProperties.class);
            assertThat(props.getRetentionDays()).isEqualTo(7);
            assertThat(props.getMaxEventsPerRequest()).isEqualTo(50);
            assertThat(props.metricSpecs()).hasSize(5);
            assertThat(props.metric("LCP").getTarget()).isEqualTo(2500);
            assertThat(props.metric("INP").getTarget()).isEqualTo(200);
            assertThat(props.metric("CLS").getTarget()).isEqualTo(0.1);
            assertThat(props.metric("FCP").getTarget()).isEqualTo(1800);
            assertThat(props.metric("TTFB").getTarget()).isEqualTo(800);
            assertThat(props.metricSpecs()).extracting(TelemetryProperties.Metric::getWeight)
                    .containsExactly(25, 25, 20, 15, 15);
            assertThat(props.metric("FID")).isNull();
        });
    }

    @Test
    void ymlKeysOverrideDefaults() {
        runner.withPropertyValues(
                        "telemetry.retention-days=3",
                        "telemetry.max-events-per-request=20",
                        "telemetry.slo-window-hours=6",
                        "telemetry.lcp.target=3000",
                        "telemetry.lcp.weight=30")
                .run(context -> {
                    TelemetryProperties props = context.getBean(TelemetryProperties.class);
                    assertThat(props.getRetentionDays()).isEqualTo(3);
                    assertThat(props.getMaxEventsPerRequest()).isEqualTo(20);
                    assertThat(props.getSloWindowHours()).isEqualTo(6);
                    assertThat(props.metric("LCP").getTarget()).isEqualTo(3000);
                    assertThat(props.metric("LCP").getWeight()).isEqualTo(30);
                    // 未覆盖的指标保持契约默认值
                    assertThat(props.metric("INP").getTarget()).isEqualTo(200);
                });
    }
}
