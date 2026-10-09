package com.tea.garden.repository;

import com.tea.garden.entity.GardenPlant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 茶园植物仓储：幂等查重（user_id + client_id）、按用户升序列表（收集承载行取最早）。
 */
public interface GardenPlantRepository extends JpaRepository<GardenPlant, Integer> {

    Optional<GardenPlant> findByUserIdAndClientId(Integer userId, String clientId);

    List<GardenPlant> findByUserIdOrderByIdAsc(Integer userId);
}
