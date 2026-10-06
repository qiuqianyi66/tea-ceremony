package com.tea.record.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;

/**
 * 品鉴记录提交请求体（snake_case，与前端 src/services/api/records.ts RecordCreateDto 对齐）。
 * client_id 必填（幂等承重墙，V1 表 NOT NULL）；dimensions 可空 → 存 '{}'（表默认语义，兼容前端残缺记录）。
 */
public record RecordCreateRequest(
        @NotBlank(message = "client_id 必填")
        @Size(max = 64)
        String client_id,

        Integer tea_id,

        @NotBlank(message = "tea_name 必填")
        @Size(max = 100)
        String tea_name,

        Integer brew_temp,

        Integer brew_time,

        Integer infusions,

        @Size(max = 20)
        String water_type,

        Integer ware_id,

        Map<String, Object> dimensions,

        Double overall_score,

        Double process_factor,

        @Size(max = 50)
        String aroma_type,

        String notes,

        @Size(max = 50)
        String weather,

        @Size(max = 50)
        String mood) {
}
