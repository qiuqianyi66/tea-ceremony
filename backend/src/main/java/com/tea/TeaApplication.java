package com.tea;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 一盏茶后端启动类（M1 Spring Boot 骨架）。
 * @EnableScheduling：AI 计量每日统计（P1-6）等定时任务。
 */
@SpringBootApplication
@EnableScheduling
public class TeaApplication {

    public static void main(String[] args) {
        SpringApplication.run(TeaApplication.class, args);
    }
}
