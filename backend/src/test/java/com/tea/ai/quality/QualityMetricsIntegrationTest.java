package com.tea.ai.quality;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.quality.dto.QualityReport;
import com.tea.ai.quality.dto.QualityReport.AgentQuality;
import com.tea.ai.repository.AiEvalTraceRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * 质量评分端到端（真 Postgres + Flyway V10 + 原生 SQL）。
 * 单测覆盖不到的部分：jsonb 写入/取值语法真的跑得通、percentile_cont 的 FILTER 形态合法、
 * 部分索引迁移能应用、UPDATE ... WHERE quality_layer IS NULL 的幂等守卫真的返回 0 行、
 * 规则评分能从真实 teas 种子表读到茶名（TeaFactsProvider → TeaRepository）。
 *
 * 本机无 Docker 时整类跳过（disabledWithoutDocker）：跳过会显式记为 skipped，不会被读成通过。
 * LLM 未配 key（application.yml 默认 disabled）→ 走规则降级路径，正好验证降级链在真环境成立。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tea.ratelimit.ai-max=1000000", "tea.ratelimit.login-max=1000000",
                "tea.ratelimit.telemetry-anon-max=1000000"})
@Testcontainers(disabledWithoutDocker = true)
class QualityMetricsIntegrationTest {

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
    private AiEvalTraceRepository traceRepository;

    @Autowired
    private QualityTraceRepository qualityTraceRepository;

    @Autowired
    private QualityJudgeService qualityJudgeService;

    @Autowired
    private QualityMetricsService qualityMetricsService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /** 成功 trace 的 NOT NULL 列（input/context/output + request_id）必须整体赋值。 */
    private AiEvalTrace trace(String agentType, String question, String answer) {
        AiEvalTrace trace = new AiEvalTrace();
        trace.setRequestId(UUID.randomUUID());
        trace.setAgentType(agentType);
        trace.setInputLayer("{\"question\":\"" + question + "\"}");
        trace.setContextLayer("{}");
        trace.setPlanLayer("{\"agent_type\":\"" + agentType + "\"}");
        trace.setExecLayer("{\"sources_count\":2}");
        trace.setOutput(answer);
        return trace;
    }

    @Test
    void judgeWritesJsonbAndReportAggregatesIt() {
        List<AiEvalTrace> traces = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            traces.add(trace("brewer", "西湖龙井怎么泡",
                    "西湖龙井用80℃水温冲泡，投茶3克，静待60秒。"));
        }
        for (int i = 0; i < 3; i++) {
            traces.add(trace("advisor", "推荐一款适合下午的茶",
                    "亲，很高兴为您服务！如有疑问请随时联系我们。"));
        }
        traceRepository.saveAll(traces);

        int judged = qualityJudgeService.judgeBatch();

        assertThat(judged).isEqualTo(7);
        // 真库写入的是 JSONB，不是字符串：->> 能取到 judge_version 说明 jsonb 列与 cast 都成立
        List<String> versions = jdbcTemplate.queryForList(
                "select quality_layer->>'judge_version' from ai_eval_traces "
                        + "where quality_layer is not null", String.class);
        assertThat(versions).hasSize(7).containsOnly("rule-v1");

        // 幂等：再跑一批没有可评样本
        assertThat(qualityJudgeService.judgeBatch()).isZero();

        // 直接调仓储的更新守卫：已评分的行必须影响 0 行
        Long judgedId = jdbcTemplate.queryForObject(
                "select id from ai_eval_traces where quality_layer is not null order by id limit 1", Long.class);
        assertThat(qualityTraceRepository.saveQuality(judgedId, "{\"relevance\":1}")).isZero();

        QualityReport report = qualityMetricsService.quality(60);

        assertThat(report.judgedTraces()).isGreaterThanOrEqualTo(7);
        assertThat(report.totalTraces()).isGreaterThanOrEqualTo(report.judgedTraces());
        assertThat(report.coverage()).isNotNull().isGreaterThan(0.0);
        assertThat(report.relevanceAvg()).isNotNull();
        assertThat(report.groundednessAvg()).isNotNull();
        assertThat(report.actionabilityAvg()).isNotNull();
        assertThat(report.toneAvg()).isNotNull();
        assertThat(report.overallAvg()).isNotNull();
        // 7 条已评分 < 20：中位数置 null，均值照给
        assertThat(report.insufficientData()).isTrue();
        assertThat(report.overallP50()).isNull();

        AgentQuality brewer = agentOf(report, "brewer");
        assertThat(brewer.judgedTraces()).isEqualTo(4);
        // 客服腔回答的 tone 必然低于茶室语气回答：验证分 agent 聚合真的按 output 内容分开
        AgentQuality advisor = agentOf(report, "advisor");
        assertThat(advisor.toneAvg()).isLessThan(brewer.toneAvg());
        assertThat(advisor.insufficientData()).isTrue();
    }

    private AgentQuality agentOf(QualityReport report, String agentType) {
        return report.byAgent().stream()
                .filter(quality -> agentType.equals(quality.agentType()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("缺少 agent 分组：" + agentType));
    }
}
