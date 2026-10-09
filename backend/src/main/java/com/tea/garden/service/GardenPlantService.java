package com.tea.garden.service;

import com.tea.common.exception.ConflictException;
import com.tea.garden.dto.GardenPlantCreateRequest;
import com.tea.garden.entity.GardenPlant;
import com.tea.garden.repository.GardenPlantRepository;
import com.tea.garden.vo.GardenPlantVo;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 茶园植物域：幂等 upsert（user_id + client_id，查重 + 唯一索引并发兜底，对照 record 域承重墙）。
 */
@Service
@RequiredArgsConstructor
public class GardenPlantService {

    private final GardenPlantRepository plantRepository;

    @Transactional
    public GardenPlantVo upsert(Integer userId, GardenPlantCreateRequest req) {
        GardenPlant existing = plantRepository.findByUserIdAndClientId(userId, req.client_id()).orElse(null);
        if (existing != null) {
            return GardenPlantVo.from(existing);
        }
        GardenPlant plant = new GardenPlant();
        plant.setUserId(userId);
        plant.setClientId(req.client_id());
        plant.setPlantType(req.plant_type() != null ? req.plant_type() : "tea");
        plant.setStatus("planted");
        plant.setEnergy(0);
        try {
            return GardenPlantVo.from(plantRepository.save(plant));
        } catch (DataIntegrityViolationException ex) {
            // 并发同 client_id 种植：唯一索引兜底 → 转幂等返回已有
            return GardenPlantVo.from(plantRepository.findByUserIdAndClientId(userId, req.client_id())
                    .orElseThrow(() -> new ConflictException("种植创建冲突，请重试")));
        }
    }

    @Transactional(readOnly = true)
    public List<GardenPlantVo> list(Integer userId) {
        return plantRepository.findByUserIdOrderByIdAsc(userId).stream().map(GardenPlantVo::from).toList();
    }
}
