package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * 运行时技能集成测试（T08，ADR-017）：真实 Postgres（Testcontainers）+ Flyway V6 种子。
 * 覆盖：四领域种子可加载；未知领域/agent 空回退；ddl-auto validate 与 V6 对齐。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class AgentSkillRouterIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("pgvector/pgvector:pg16")
            .withDatabaseName("tea")
            .withUsername("tea")
            .withPassword("tea");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private AgentSkillRouter router;

    @Test
    void seedSkillsLoadForAllDomains() {
        assertThat(router.load("librarian", "teaware")).contains("茶器");
        assertThat(router.load("librarian", "poem")).contains("茶诗");
        assertThat(router.load("librarian", "region")).contains("六大茶类");
        assertThat(router.load("librarian", "person")).contains("待核实");
    }

    @Test
    void unknownDomainOrAgentFallsBackToEmpty() {
        assertThat(router.load("librarian", "unknown")).isEmpty();
        assertThat(router.load("mentor", "teaware")).isEmpty();
    }

    @Test
    void detectThenLoadRoundTrip() {
        String domain = router.detect("紫砂壶的历史");
        assertThat(domain).isEqualTo("teaware");
        assertThat(router.load("librarian", domain)).isNotBlank();
    }
}
