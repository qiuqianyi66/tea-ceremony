package com.tea.garden.vo;

import java.util.Map;

/**
 * 茶园能量总览 VO（snake_case）。
 * pending_amount=未收（collected_at IS NULL 事件金额合计）；collected_amount=已收合计；
 * total_energy=plants.energy 累计（已转入植物）；phase=按总能量算出的当前阶段；phase_thresholds=各阶段阈值（前端进度）。
 */
public record GardenEnergySummaryVo(
        Integer pending_amount,
        Integer collected_amount,
        Integer total_energy,
        String phase,
        Map<String, Integer> phase_thresholds) {
}
