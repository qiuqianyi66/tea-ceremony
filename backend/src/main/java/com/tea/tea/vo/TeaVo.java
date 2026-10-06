package com.tea.tea.vo;

import com.tea.tea.entity.Tea;
import java.util.List;

/**
 * 茶叶详情/列表 VO（snake_case，与前端 src/services/api/teas.ts TeaResponseDto 对齐）。
 */
public record TeaVo(
        Integer id,
        String name,
        String category,
        String origin,
        Integer region_id,
        Integer process_id,
        String season,
        String grade,
        String altitude,
        Integer best_temp,
        Integer best_time,
        Integer infusions,
        List<String> flavor,
        String story,
        String description,
        String historical_period,
        String water_requirement,
        String soup_color_min,
        String soup_color_max,
        String dry_tea_color) {

    public static TeaVo from(Tea tea) {
        return new TeaVo(
                tea.getId(),
                tea.getName(),
                tea.getCategory(),
                tea.getOrigin(),
                tea.getRegionId(),
                tea.getProcessId(),
                tea.getSeason(),
                tea.getGrade(),
                tea.getAltitude(),
                tea.getBestTemp(),
                tea.getBestTime(),
                tea.getInfusions(),
                tea.getFlavor(),
                tea.getStory(),
                tea.getDescription(),
                tea.getHistoricalPeriod(),
                tea.getWaterRequirement(),
                tea.getSoupColorMin(),
                tea.getSoupColorMax(),
                tea.getDryTeaColor());
    }
}
