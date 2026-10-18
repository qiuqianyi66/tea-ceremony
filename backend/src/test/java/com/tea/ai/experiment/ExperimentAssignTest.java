package com.tea.ai.experiment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.experiment.entity.AbExperiment;
import com.tea.ai.experiment.repository.AbExperimentRepository;
import com.tea.ai.experiment.service.ExperimentService;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 分桶规则：安全默认值、确定性、分布合理性。
 * 分桶是纯算术，不启动数据库；Repository 用 mock 提供实验配置（真库链路见 ExperimentGuard 的端到端用例）。
 *
 * 口径（已写进 ExperimentService javadoc）：无法判断 → control；桶号 = SHA-256 前 8 字节 floorMod 100。
 */
@ExtendWith(MockitoExtension.class)
class ExperimentAssignTest {

    private static final String KEY = "ai.fallback.enabled";

    @Mock
    private AbExperimentRepository repository;

    private ExperimentService service;

    @BeforeEach
    void setUp() {
        service = new ExperimentService(repository, new ObjectMapper());
    }

    private AbExperiment experiment(String status, int trafficPercent) {
        AbExperiment experiment = new AbExperiment();
        experiment.setExpKey(KEY);
        experiment.setName("多级兜底开关");
        experiment.setStatus(status);
        experiment.setTrafficPercent((short) trafficPercent);
        return experiment;
    }

    @Test
    void unknownExperimentFallsBackToControl() {
        when(repository.findByExpKey(KEY)).thenReturn(Optional.empty());

        assertThat(service.assign(KEY, "user-1")).isEqualTo(ExperimentService.CONTROL);
    }

    @Test
    void draftStatusFallsBackToControl() {
        when(repository.findByExpKey(KEY))
                .thenReturn(Optional.of(experiment(AbExperiment.STATUS_DRAFT, 100)));

        // 配置了 100% 但没启动：说明灰度还没批准，必须走旧路径
        assertThat(service.assign(KEY, "user-1")).isEqualTo(ExperimentService.CONTROL);
    }

    @Test
    void pausedStatusFallsBackToControl() {
        when(repository.findByExpKey(KEY))
                .thenReturn(Optional.of(experiment(AbExperiment.STATUS_PAUSED, 100)));

        assertThat(service.assign(KEY, "user-1")).isEqualTo(ExperimentService.CONTROL);
    }

    @Test
    void stoppedStatusFallsBackToControl() {
        when(repository.findByExpKey(KEY))
                .thenReturn(Optional.of(experiment(AbExperiment.STATUS_STOPPED, 100)));

        assertThat(service.assign(KEY, "user-1")).isEqualTo(ExperimentService.CONTROL);
    }

    @Test
    void zeroTrafficFallsBackToControl() {
        when(repository.findByExpKey(KEY))
                .thenReturn(Optional.of(experiment(AbExperiment.STATUS_RUNNING, 0)));

        assertThat(service.assign(KEY, "user-1")).isEqualTo(ExperimentService.CONTROL);
    }

    @Test
    void fullTrafficSendsEverySubjectToTreatment() {
        when(repository.findByExpKey(KEY))
                .thenReturn(Optional.of(experiment(AbExperiment.STATUS_RUNNING, 100)));

        for (int i = 0; i < 200; i++) {
            assertThat(service.assign(KEY, "user-" + i)).isEqualTo(ExperimentService.TREATMENT);
        }
    }

    @Test
    void assignmentIsDeterministicAcrossCacheEvictions() {
        when(repository.findByExpKey(KEY))
                .thenReturn(Optional.of(experiment(AbExperiment.STATUS_RUNNING, 50)));

        String first = service.assign(KEY, "user-42");
        // 每次清缓存 = 每次都重新走哈希（而不是命中缓存里的旧结果）
        for (int i = 0; i < 100; i++) {
            service.evictCache(KEY);
            assertThat(service.assign(KEY, "user-42")).isEqualTo(first);
        }
    }

    @Test
    void tenPercentTrafficHitsEightToTwelvePercentOfTenThousandSubjects() {
        when(repository.findByExpKey(KEY))
                .thenReturn(Optional.of(experiment(AbExperiment.STATUS_RUNNING, 10)));

        int treatment = 0;
        Set<String> distinct = new HashSet<>();
        for (int i = 0; i < 10_000; i++) {
            String subject = "user-" + i;
            distinct.add(subject);
            if (ExperimentService.TREATMENT.equals(service.assign(KEY, subject))) {
                treatment++;
            }
        }

        assertThat(distinct).hasSize(10_000);
        double ratio = treatment / 10_000.0;
        // 10% 目标 → 允许 8%~12%（±2 个百分点）；偏离说明哈希分布不均，灰度比例就不可信了
        assertThat(ratio).isBetween(0.08, 0.12);
    }

    @Test
    void blankSubjectFallsBackToControl() {
        // 参数缺失时不查库：连实验配置都不需要，直接走旧路径
        assertThat(service.assign(KEY, null)).isEqualTo(ExperimentService.CONTROL);
        assertThat(service.assign(KEY, "")).isEqualTo(ExperimentService.CONTROL);
        assertThat(service.assign(KEY, "   ")).isEqualTo(ExperimentService.CONTROL);
        assertThat(service.assign(null, "user-1")).isEqualTo(ExperimentService.CONTROL);
        verifyNoInteractions(repository);
    }
}
