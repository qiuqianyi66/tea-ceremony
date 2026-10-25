package com.tea.ai.metrics;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.ai.dto.GoldenMetricsReport;
import com.tea.ai.dto.GoldenMetricsReport.AgentMetrics;
import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.repository.AiEvalTraceRepository;
import com.tea.support.PostgresIntegrationTestBase;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * 黄金指标集成测试：真实 Postgres + Flyway V5 表结构 + 原生聚合 SQL。
 * 单测覆盖不到的部分：percentile_cont 在本库版本上真的跑得通、窗口过滤真的按 created_at 生效、
 * error_code 判定与分组计数在 SQL 层与 Java 口径一致。
 *
 * 本机无 Docker 时整类跳过（disabledWithoutDocker）：跳过会显式报 skipped，不会被读成通过。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"tea.ratelimit.ai-anon-max=1000000", "tea.ratelimit.ai-anon-daily-max=10000000",
                "tea.ratelimit.ai-auth-max=1000000", "tea.ratelimit.login-max=1000000",
                "tea.ratelimit.telemetry-anon-max=1000000"})
@Testcontainers(disabledWithoutDocker = true)
class GoldenMetricsIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private AiEvalTraceRepository traceRepository;

    @Autowired
    private GoldenMetricsService goldenMetricsService;

    /** ai_eval_traces 的 NOT NULL 列（input/output/context + request_id）必须整体赋值，否则 insert 直接失败。 */
    private AiEvalTrace trace(String agentType, int latencyMs, String errorCode) {
        AiEvalTrace trace = new AiEvalTrace();
        trace.setRequestId(UUID.randomUUID());
        trace.setAgentType(agentType);
        trace.setInputLayer("{\"question\":\"测试问句\"}");
        trace.setContextLayer("{}");
        trace.setOutput(errorCode == null ? "答复" : "");
        trace.setLatencyMs(latencyMs);
        trace.setErrorCode(errorCode);
        return trace;
    }

    @Test
    void goldenMetricsComputeFromRealPostgres() {
        List<AiEvalTrace> traces = new ArrayList<>();
        // brewer：25 条（20 成功 / 5 个 502 降级），延迟 100..340ms
        for (int i = 0; i < 25; i++) {
            traces.add(trace("brewer", 100 + i * 10, i % 5 == 0 ? "BAD_GATEWAY" : null));
        }
        // taster：5 条全成功（样本不足 P99 门槛）
        for (int i = 0; i < 5; i++) {
            traces.add(trace("taster", 200 + i * 20, null));
        }
        traceRepository.saveAll(traces);

        GoldenMetricsReport report = goldenMetricsService.golden(60);

        assertThat(report.totalCalls()).isGreaterThanOrEqualTo(30);
        assertThat(report.windowEnd()).isAfter(report.windowStart());

        AgentMetrics brewer = agentOf(report, "brewer");
        assertThat(brewer.calls()).isEqualTo(25);
        assertThat(brewer.successRate()).isEqualTo(0.8);
        assertThat(brewer.errorRate()).isEqualTo(0.2);
        assertThat(brewer.insufficientData()).isFalse();
        // 真库 percentile_cont 至少能跑通并给出单调的分位序列
        assertThat(brewer.p50()).isNotNull();
        assertThat(brewer.p95()).isNotNull();
        assertThat(brewer.p99()).isNotNull();
        assertThat(brewer.p99()).isGreaterThanOrEqualTo(brewer.p95());
        assertThat(brewer.p95()).isGreaterThanOrEqualTo(brewer.p50());

        AgentMetrics taster = agentOf(report, "taster");
        assertThat(taster.calls()).isEqualTo(5);
        assertThat(taster.successRate()).isEqualTo(1.0);
        assertThat(taster.insufficientData()).isTrue();
        assertThat(taster.p99()).isNull();
        assertThat(taster.p50()).isNotNull();
    }

    private AgentMetrics agentOf(GoldenMetricsReport report, String agentType) {
        return report.byAgent().stream()
                .filter(metrics -> agentType.equals(metrics.agentType()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("缺少 agent 分组：" + agentType));
    }
}
