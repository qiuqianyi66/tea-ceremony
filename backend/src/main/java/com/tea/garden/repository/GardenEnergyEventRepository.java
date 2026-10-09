package com.tea.garden.repository;

import com.tea.garden.entity.GardenEnergyEvent;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 茶园能量事件仓储：幂等查重（user_id + client_id）、未收/已收列表（聚合金额在 Service）。
 */
public interface GardenEnergyEventRepository extends JpaRepository<GardenEnergyEvent, Integer> {

    Optional<GardenEnergyEvent> findByUserIdAndClientId(Integer userId, String clientId);

    List<GardenEnergyEvent> findByUserIdAndCollectedAtIsNull(Integer userId);

    List<GardenEnergyEvent> findByUserIdAndCollectedAtIsNotNull(Integer userId);
}
