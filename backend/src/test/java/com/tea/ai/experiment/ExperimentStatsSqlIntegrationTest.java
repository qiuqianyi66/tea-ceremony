package com.tea.ai.experiment;

import static org.assertj.core.api.Assertions.assertThat;

import com.tea.ai.entity.AiEvalTrace;
import com.tea.ai.experiment.repository.AbExperimentRepository;
import com.tea.ai.repository.AiEvalTraceRepository;
import com.tea.support.PostgresIntegrationTestBase;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * 变体统计 SQL 的归属解析（真实 Postgres + Flyway）。
 *
 * <p>为什么必须是集成测试：归属规则写在原生 SQL 里（JSONB 取值 + COALESCE），
 * mock 仓库等于只测 Java 映射。这里直接落 trace 行再查，钉住三件事：
 * 多实验行按请求的 exp_key 取到自己的变体、历史单实验行仍计入、别人的实验键不串味。</p>
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class ExperimentStatsSqlIntegrationTest extends PostgresIntegrationTestBase {

    private static final String TOOL_KEY = "ai.librarian.tool-calling";
    private static final String FALLBACK_KEY = "ai.fallback.rollout";

    @Autowired
    private AbExperimentRepository experiments;

    @Autowired
    private AiEvalTraceRepository traces;

    private void saveTrace(String planLayer, String errorCode) {
        AiEvalTrace trace = new AiEvalTrace();
        trace.setRequestId(UUID.randomUUID());
        trace.setAgentType("librarian");
        trace.setInputLayer("{}");
        trace.setContextLayer("{}");
        trace.setPlanLayer(planLayer);
        trace.setExecLayer("{}");
        trace.setOutput("");
        trace.setErrorCode(errorCode);
        traces.save(trace);
    }

    /** 行 = [variant, calls, error_calls, p99]；无行返回空列表。 */
    private List<Object[]> stats(String expKey) {
        LocalDateTime end = LocalDateTime.now().plusMinutes(1);
        return experiments.variantWindowStats(expKey, end.minusMinutes(10), end);
    }

    @Test
    void multiExperimentRowIsReadByItsOwnKey() {
        // 一次 librarian 请求同时属于两个实验：新格式只写 experiments 对象
        saveTrace("{\"experiments\":{\"" + TOOL_KEY + "\":\"treatment\",\""
                + FALLBACK_KEY + "\":\"control\"}}", null);

        List<Object[]> tool = stats(TOOL_KEY);
        assertThat(tool).hasSize(1);
        assertThat(tool.get(0)[0]).isEqualTo("treatment");
        assertThat(((Number) tool.get(0)[1]).longValue()).isEqualTo(1L);

        List<Object[]> fallback = stats(FALLBACK_KEY);
        assertThat(fallback).hasSize(1);
        assertThat(fallback.get(0)[0]).isEqualTo("control");
    }

    @Test
    void legacySingleExperimentRowStillCounts() {
        // 历史行：没有 experiments 对象，只有顶层 experiment + variant
        saveTrace("{\"variant\":\"treatment\",\"experiment\":\"" + FALLBACK_KEY + "\"}", null);

        List<Object[]> rows = stats(FALLBACK_KEY);
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0)[0]).isEqualTo("treatment");
    }

    @Test
    void rowsOfOtherExperimentsAreNotCounted() {
        saveTrace("{\"experiments\":{\"ai.other.experiment\":\"treatment\"}}", null);
        // 历史行指向别的实验：按本键查不能命中
        saveTrace("{\"variant\":\"control\",\"experiment\":\"ai.other.experiment\"}", null);

        assertThat(stats(TOOL_KEY)).isEmpty();
        assertThat(stats(FALLBACK_KEY)).isEmpty();
    }

    @Test
    void errorCallsAreCountedPerExperiment() {
        saveTrace("{\"experiments\":{\"" + TOOL_KEY + "\":\"treatment\"}}", "BAD_GATEWAY");
        saveTrace("{\"experiments\":{\"" + TOOL_KEY + "\":\"treatment\"}}", null);

        List<Object[]> rows = stats(TOOL_KEY);
        assertThat(rows).hasSize(1);
        assertThat(((Number) rows.get(0)[1]).longValue()).isEqualTo(2L);
        assertThat(((Number) rows.get(0)[2]).longValue()).isEqualTo(1L);
    }
}
