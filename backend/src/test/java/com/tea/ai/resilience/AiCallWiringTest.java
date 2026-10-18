package com.tea.ai.resilience;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.ai.service.AiCircuitBreaker;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;

/**
 * 容错层装配冒烟测试。
 * 为什么需要：全量 @SpringBootTest 依赖 Testcontainers（本机 Docker 不可用时整套装跳过），
 * 新 Bean 的构造器/注解写错会到部署时才炸。这里只扫 resilience 包，验证
 * 「策略绑定 + Sleeper Bean + 执行器/门禁组件」能真正组装出来。
 */
class AiCallWiringTest {

    @Test
    void resilienceBeansAssemble() {
        try (AnnotationConfigApplicationContext context = new AnnotationConfigApplicationContext()) {
            context.registerBean(MeterRegistry.class, SimpleMeterRegistry::new);
            // 熔断器在 service 包（本次未纳入扫描），显式登记以模拟生产装配
            context.registerBean(AiCircuitBreaker.class, () -> new AiCircuitBreaker(5, 30_000));
            context.register(AiResilienceConfig.class);
            context.scan("com.tea.ai.resilience");
            context.refresh();

            assertThat(context.getBean(AiCallPolicy.class).timeoutMs()).isEqualTo(20_000);
            assertThat(context.getBean(Sleeper.class)).isNotNull();
            assertThat(context.getBean(AiCallDepthGuard.class)).isNotNull();
            assertThat(context.getBean(AiCallExecutor.class)).isNotNull();
        }
    }
}
