package com.tea.ai.agent;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.support.PropertySourcesPlaceholderConfigurer;
import org.springframework.core.env.MapPropertySource;

/**
 * AI_KEY_EXPR 门禁表达式回归（2026-10-18 生产缺陷）。
 * 缺陷：5 个专家各自写死 ${spring.ai.dashscope.api-key}，生产走 gateway profile（chat=openai）时
 * DashScope key 为空 → 专家全部 502，而透明路径正常。本测试锁定「门禁 key 跟随激活的 ChatModel」。
 */
class AiKeyExprTest {

    /** @Value 落点，只用于观察表达式求值结果。 */
    static class Holder {
        @Value(BaseExpertAgent.AI_KEY_EXPR)
        String key;
    }

    private static String resolve(String chatModel, String dashscopeKey, String openaiKey) {
        try (AnnotationConfigApplicationContext ctx = new AnnotationConfigApplicationContext()) {
            ctx.getEnvironment().getPropertySources().addFirst(new MapPropertySource("test", Map.of(
                    "spring.ai.model.chat", chatModel,
                    "spring.ai.dashscope.api-key", dashscopeKey,
                    "spring.ai.openai.api-key", openaiKey)));
            ctx.registerBean(PropertySourcesPlaceholderConfigurer.class);
            ctx.register(Holder.class);
            ctx.refresh();
            return ctx.getBean(Holder.class).key;
        }
    }

    @Test
    void gatewayProfileTakesGatewayKey() {
        assertThat(resolve("openai", "disabled", "gw-key")).isEqualTo("gw-key");
    }

    @Test
    void dashscopeProfileTakesDashScopeKey() {
        assertThat(resolve("dashscope", "ds-key", "")).isEqualTo("ds-key");
    }
}
