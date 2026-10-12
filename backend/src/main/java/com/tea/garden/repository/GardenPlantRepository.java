package com.tea.garden.repository;

import com.tea.garden.entity.GardenPlant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 茶园植物仓储：幂等查重（user_id + client_id）、按用户升序列表（收集承载行取最早）；
 * 总能量走 DB 侧 SUM（summary 不拉植物行到 JVM 再求和）。
 */
public interface GardenPlantRepository extends JpaRepository<GardenPlant, Integer> {

    Optional<GardenPlant> findByUserIdAndClientId(Integer userId, String clientId);

    List<GardenPlant> findByUserIdOrderByIdAsc(Integer userId);

    /** 用户全部植物能量合计（DB 侧聚合；无植物返回 0）。 */
    @Query("select coalesce(sum(p.energy), 0) from GardenPlant p where p.userId = :userId")
    int sumEnergy(@Param("userId") Integer userId);
}
