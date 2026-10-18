package com.tea.ai.experiment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tea.ai.experiment.dto.ExperimentView;
import com.tea.ai.experiment.entity.AbExperiment;
import com.tea.ai.experiment.repository.AbExperimentRepository;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.common.exception.ConflictException;
import com.tea.common.exception.NotFoundException;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 生命周期：start / pause / stop 的状态流转、幂等、非法流转。
 *
 * 幂等是运维要求：自动回滚与人工 stop 可能撞在同一秒，重复 stop 不能报错；
 * 「stopped 不能回到 running」是审计要求——复活一个已定性的实验会让 stop_reason 失去意义。
 */
@ExtendWith(MockitoExtension.class)
class ExperimentLifecycleTest {

    private static final String KEY = "ai.fallback.enabled";

    @Mock
    private AbExperimentRepository repository;

    private ExperimentService service;

    @BeforeEach
    void setUp() {
        service = new ExperimentService(repository, new ObjectMapper());
    }

    private AbExperiment experiment(String status) {
        AbExperiment experiment = new AbExperiment();
        experiment.setExpKey(KEY);
        experiment.setName("多级兜底开关");
        experiment.setStatus(status);
        experiment.setTrafficPercent((short) 10);
        return experiment;
    }

    @Test
    void startMovesDraftToRunning() {
        AbExperiment experiment = experiment(AbExperiment.STATUS_DRAFT);
        when(repository.findByExpKey(KEY)).thenReturn(Optional.of(experiment));

        ExperimentView view = service.start(KEY);

        assertThat(view.status()).isEqualTo(AbExperiment.STATUS_RUNNING);
        assertThat(view.startedAt()).isNotNull();
        assertThat(view.stopReason()).isNull();
        verify(repository).save(experiment);
    }

    @Test
    void startResumesPausedAndClearsStopFields() {
        AbExperiment experiment = experiment(AbExperiment.STATUS_PAUSED);
        // 上一轮停止残留的字段在重新启动时必须清掉，否则详情页会同时显示「运行中」和旧的停止原因
        experiment.setStoppedAt(LocalDateTime.of(2026, 10, 1, 0, 0));
        experiment.setStopReason("auto_rollback: p99 ratio 2.00 > 1.50");
        when(repository.findByExpKey(KEY)).thenReturn(Optional.of(experiment));

        ExperimentView view = service.start(KEY);

        assertThat(view.status()).isEqualTo(AbExperiment.STATUS_RUNNING);
        assertThat(view.stoppedAt()).isNull();
        assertThat(view.stopReason()).isNull();
    }

    @Test
    void startIsIdempotentWhenAlreadyRunning() {
        AbExperiment experiment = experiment(AbExperiment.STATUS_RUNNING);
        when(repository.findByExpKey(KEY)).thenReturn(Optional.of(experiment));

        ExperimentView view = service.start(KEY);

        assertThat(view.status()).isEqualTo(AbExperiment.STATUS_RUNNING);
        verify(repository, never()).save(any());
    }

    @Test
    void pauseMovesRunningToPaused() {
        AbExperiment experiment = experiment(AbExperiment.STATUS_RUNNING);
        when(repository.findByExpKey(KEY)).thenReturn(Optional.of(experiment));

        ExperimentView view = service.pause(KEY);

        assertThat(view.status()).isEqualTo(AbExperiment.STATUS_PAUSED);
        verify(repository).save(experiment);
    }

    @Test
    void pauseDraftIsConflict() {
        when(repository.findByExpKey(KEY)).thenReturn(Optional.of(experiment(AbExperiment.STATUS_DRAFT)));

        assertThatThrownBy(() -> service.pause(KEY))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("running");
    }

    @Test
    void stopRecordsReasonAndTimestamp() {
        AbExperiment experiment = experiment(AbExperiment.STATUS_RUNNING);
        when(repository.findByExpKey(KEY)).thenReturn(Optional.of(experiment));

        ExperimentView view = service.stop(KEY, "  错误率飙升  ");

        assertThat(view.status()).isEqualTo(AbExperiment.STATUS_STOPPED);
        assertThat(view.stoppedAt()).isNotNull();
        assertThat(view.stopReason()).isEqualTo("错误率飙升");
    }

    @Test
    void stopWithoutReasonUsesManualStop() {
        AbExperiment experiment = experiment(AbExperiment.STATUS_RUNNING);
        when(repository.findByExpKey(KEY)).thenReturn(Optional.of(experiment));

        assertThat(service.stop(KEY, null).stopReason()).isEqualTo(ExperimentService.MANUAL_STOP_REASON);
    }

    @Test
    void stopIsIdempotentAndKeepsFirstReason() {
        AbExperiment experiment = experiment(AbExperiment.STATUS_STOPPED);
        experiment.setStopReason("auto_rollback: error_rate delta 0.090 > 0.050");
        when(repository.findByExpKey(KEY)).thenReturn(Optional.of(experiment));

        ExperimentView view = service.stop(KEY, "人工补刀");

        // 首个停止原因保留：自动回滚的判据不该被人事后覆盖
        assertThat(view.stopReason()).isEqualTo("auto_rollback: error_rate delta 0.090 > 0.050");
        verify(repository, never()).save(any());
    }

    @Test
    void startStoppedExperimentIsConflict() {
        when(repository.findByExpKey(KEY)).thenReturn(Optional.of(experiment(AbExperiment.STATUS_STOPPED)));

        assertThatThrownBy(() -> service.start(KEY))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("已停止");
    }

    @Test
    void missingExperimentIsNotFound() {
        when(repository.findByExpKey("nope")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.start("nope")).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.report("nope")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void blankKeyIsBadRequest() {
        assertThatThrownBy(() -> service.stop("  ", "x"))
                .isInstanceOf(com.tea.common.exception.BadRequestException.class);
    }
}
