package com.tea.record.repository;

import com.tea.record.entity.TastingRecord;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 品鉴记录仓储：幂等查重（user_id + client_id）、归属过滤（id + user_id）、倒序列表。
 */
public interface TastingRecordRepository extends JpaRepository<TastingRecord, Integer> {

    Optional<TastingRecord> findByUserIdAndClientId(Integer userId, String clientId);

    Page<TastingRecord> findByUserIdOrderByCreatedAtDesc(Integer userId, Pageable pageable);

    Optional<TastingRecord> findByIdAndUserId(Integer id, Integer userId);
}
