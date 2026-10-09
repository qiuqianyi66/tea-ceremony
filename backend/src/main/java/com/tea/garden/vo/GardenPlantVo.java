package com.tea.garden.vo;

import com.tea.garden.entity.GardenPlant;
import java.time.LocalDateTime;

/**
 * 茶园植物 VO（snake_case，与前端 GardenPlantResponseDto 对齐）。
 */
public record GardenPlantVo(
        Integer id,
        String client_id,
        String plant_type,
        String status,
        Integer energy,
        LocalDateTime created_at,
        LocalDateTime updated_at) {

    public static GardenPlantVo from(GardenPlant plant) {
        return new GardenPlantVo(
                plant.getId(),
                plant.getClientId(),
                plant.getPlantType(),
                plant.getStatus(),
                plant.getEnergy(),
                plant.getCreatedAt(),
                plant.getUpdatedAt());
    }
}
