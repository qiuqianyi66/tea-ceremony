package com.tea.garden.repository;

import com.tea.garden.entity.GardenEnergyEvent;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 茶园能量事件仓储：幂等查重（user_id + client_id）、收集时按实体更新 collected_at；
 * 汇总金额走 DB 侧 SUM（summary 端点不拉全表行到 JVM 再求和）。
 */
public interface GardenEnergyEventRepository extends JpaRepository<GardenEnergyEvent, Integer> {

    Optional<GardenEnergyEvent> findByUserIdAndClientId(Integer userId, String clientId);

    List<GardenEnergyEvent> findByUserIdAndCollectedAtIsNull(Integer userId);

    List<GardenEnergyEvent> findByUserIdAndCollectedAtIsNotNull(Integer userId);

    /** 未收事件金额合计（DB 侧聚合；无事件返回 0）。 */
    @Query("select coalesce(sum(e.amount), 0) from GardenEnergyEvent e "
            + "where e.userId = :userId and e.collectedAt is null")
    int sumPendingAmount(@Param("userId") Integer userId);

    /** 已收事件金额合计（DB 侧聚合；无事件返回 0）。 */
    @Query("select coalesce(sum(e.amount), 0) from GardenEnergyEvent e "
            + "where e.userId = :userId and e.collectedAt is not null")
    int sumCollectedAmount(@Param("userId") Integer userId);
}
