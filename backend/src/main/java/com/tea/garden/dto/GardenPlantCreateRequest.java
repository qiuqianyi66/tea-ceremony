package com.tea.garden.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 茶园种植请求体（snake_case，与前端 src/services/api/garden.ts 对齐）。
 * client_id 必填（幂等承重墙，V1 表 NOT NULL）；plant_type 可空 → 默认 tea。
 */
public record GardenPlantCreateRequest(
        @NotBlank(message = "client_id 必填")
        @Size(max = 64)
        String client_id,

        @Size(max = 50)
        String plant_type) {
}
