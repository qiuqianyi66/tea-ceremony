package com.tea.ai.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.agent.AgentType;
import com.tea.ai.agent.ComplexityLevel;
import com.tea.ai.dto.AiChatRequest;
import com.tea.ai.dto.ChatMessageDto;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.repository.AiEvalTraceRepository;
import com.tea.ai.vo.AiChatVo;
import com.tea.common.exception.BadGatewayException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Trace 集成测试（T07，ADR-016）：真实 Postgres（Testcontainers）+ Flyway V5 + JPA validate。
 * 覆盖：begin→complete 四层 JSONB 落库与字段透传；fail 降级留痕；旁路（保存失败不影响调用方）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class TraceRecorderIntegrationTest {

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
    private TraceRecorder traceRecorder;

    @Autowired
    private AiEvalTraceRepository repository;

    @Autowired
    private ObjectMapper objectMapper;

    private AiChatRequest request() {
        return new AiChatRequest(
                List.of(new ChatMessageDto("user", "铁观音和武夷岩茶有什么区别？")),
                null,
                null);
    }

    @Test
    void beginCompletePersistsFourLayersWithTokens() throws Exception {
        AiEvalTrace trace = traceRecorder.begin(null, AgentType.LIBRARIAN, request(), request(), ComplexityLevel.MEDIUM);
        AiChatVo vo = new AiChatVo("铁观音属乌龙茶……", List.of("铁观音"), null, 120, 340, 890);
        traceRecorder.complete(trace, vo);

        AiEvalTrace saved = repository.findAll().stream()
                .filter(t -> t.getAgentType().equals("librarian"))
                .findFirst().orElseThrow();

        assertThat(saved.getAgentType()).isEqualTo("librarian");
        assertThat(saved.getSessionId()).isNull();
        assertThat(saved.getOutput()).isEqualTo("铁观音属乌龙茶……");
        assertThat(saved.getTokensIn()).isEqualTo(120);
        assertThat(saved.getTokensOut()).isEqualTo(340);
        assertThat(saved.getLatencyMs()).isEqualTo(890);
        assertThat(saved.getErrorCode()).isNull();

        // 四层 JSONB 均可解析且关键字段存在
        JsonNode input = objectMapper.readTree(saved.getInputLayer());
        assertThat(input.path("question").asText()).isEqualTo("铁观音和武夷岩茶有什么区别？");
        assertThat(input.path("agent_hint").asText()).isEmpty();
        assertThat(objectMapper.readTree(saved.getContextLayer()).path("anchor_count").asInt()).isEqualTo(0);
        assertThat(objectMapper.readTree(saved.getPlanLayer()).path("route").asText()).isEqualTo("expert");
        assertThat(objectMapper.readTree(saved.getPlanLayer()).path("complexity").asText()).isEqualTo("MEDIUM");
        JsonNode exec = objectMapper.readTree(saved.getExecLayer());
        assertThat(exec.path("sources_count").asInt()).isEqualTo(1);
    }

    @Test
    void failRecordsErrorCodeForBadGateway() throws Exception {
        AiEvalTrace trace = traceRecorder.begin(null, null, request(), request(), ComplexityLevel.SIMPLE);
        traceRecorder.fail(trace, new BadGatewayException("AI 服务调用失败"));

        AiEvalTrace saved = repository.findAll().stream()
                .filter(t -> t.getErrorCode() != null)
                .findFirst().orElseThrow();

        assertThat(saved.getAgentType()).isEqualTo("chat"); // 透明代理归 chat
        assertThat(saved.getErrorCode()).isEqualTo("BAD_GATEWAY");
        assertThat(saved.getOutput()).isEmpty();
        assertThat(objectMapper.readTree(saved.getExecLayer()).path("error").asText())
                .isEqualTo("BadGatewayException");
    }
}
