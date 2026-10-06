package com.tea.common.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 全局基础设施 Bean。 */
@Configuration
public class AppConfig {

    /** 统一时钟源（测试可替换为固定时钟；编码规范：时钟属可 mock 的跨进程边界）。 */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
