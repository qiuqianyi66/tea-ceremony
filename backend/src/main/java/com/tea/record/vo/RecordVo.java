package com.tea.record.vo;

import com.tea.record.entity.TastingRecord;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 品鉴记录 VO（snake_case，与前端 RecordResponseDto 对齐）。
 */
public record RecordVo(
        Integer id,
        String client_id,
        Integer tea_id,
        String tea_name,
        Integer brew_temp,
        Integer brew_time,
        Integer infusions,
        String water_type,
        Integer ware_id,
        Map<String, Object> dimensions,
        Double overall_score,
        Double process_factor,
        String aroma_type,
        String notes,
        String weather,
        String mood,
        LocalDateTime created_at) {

    public static RecordVo from(TastingRecord record) {
        return new RecordVo(
                record.getId(),
                record.getClientId(),
                record.getTeaId(),
                record.getTeaName(),
                record.getBrewTemp(),
                record.getBrewTime(),
                record.getInfusions(),
                record.getWaterType(),
                record.getWareId(),
                record.getDimensions(),
                record.getOverallScore(),
                record.getProcessFactor(),
                record.getAromaType(),
                record.getNotes(),
                record.getWeather(),
                record.getMood(),
                record.getCreatedAt());
    }
}
