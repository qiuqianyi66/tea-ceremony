package com.tea.ai.experiment.dto;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 实验概览：窗口 + 每个实验的双轨对比。
 * windowStart/windowEnd 只出现一次：所有实验用同一窗口，比较才成立。
 */
public record ExperimentOverview(
        LocalDateTime windowStart,
        LocalDateTime windowEnd,
        List<ExperimentReport> experiments) {
}
