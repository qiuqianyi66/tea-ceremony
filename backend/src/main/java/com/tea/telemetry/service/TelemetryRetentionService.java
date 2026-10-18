package com.tea.telemetry.service;

import com.tea.telemetry.config.TelemetryProperties;
import com.tea.telemetry.repository.TelemetryEventRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 遥测保留与快照任务（契约 §10：raw 7 天，快照每 15 分钟一个窗口）。
 * 两个任务都幂等：删过期数据重复跑只影响行数；快照按窗口去重 upsert，补跑不会产生重复行。
 * 单实例部署（ADR-021 无 Redis），不引 ShedLock：多实例时需要先解决分布式锁再扩副本。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryRetentionService {

    private final TelemetryEventRepository eventRepository;
    private final SloEvaluationService sloEvaluationService;
    private final TelemetryProperties props;

    /** 每日 03:00 清理过期 raw 事件（低峰期删，避免与上报写入抢锁）。 */
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional(rollbackFor = Exception.class)
    public void purgeExpiredEvents() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(props.getRetentionDays());
        int deleted = eventRepository.deleteOlderThan(cutoff);
        log.info("telemetry retention: deleted {} raw events occurred before {}", deleted, cutoff);
    }

    /** 每 15 分钟结算上一个完整窗口的 SLO 快照。 */
    @Scheduled(cron = "0 */15 * * * *")
    public void snapshotSlo() {
        sloEvaluationService.snapshotPreviousWindow();
    }
}
