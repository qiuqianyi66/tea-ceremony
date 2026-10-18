package com.tea.ai.quality;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * 质量评分装配。
 * 为什么单独一个配置类：QualityProperties 是 record（构造绑定），不能被组件扫描注册，
 * 必须经 @EnableConfigurationProperties 显式启用（与 AiResilienceConfig 同做法）。
 */
@Configuration
@EnableConfigurationProperties(QualityProperties.class)
public class QualityConfig {
}
