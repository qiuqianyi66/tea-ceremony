package com.tea.ai.resilience;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 容错层装配。
 * 为什么单独一个配置类：AiCallPolicy 是 record（构造绑定），不能被组件扫描注册，
 * 必须经 @EnableConfigurationProperties 显式启用；Sleeper 的生产实现也只有这里注册。
 * 生产 Sleeper 直接映射 Thread::sleep：退避必须真的阻塞当前请求线程，
 * 换虚拟线程/定时器只会让「重试节奏」与「请求生命周期」解耦，失去背压意义。
 */
@Configuration
@EnableConfigurationProperties(AiCallPolicy.class)
public class AiResilienceConfig {

    @Bean
    public Sleeper sleeper() {
        return Thread::sleep;
    }
}
