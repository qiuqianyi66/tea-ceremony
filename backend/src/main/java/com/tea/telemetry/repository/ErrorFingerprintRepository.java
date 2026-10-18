package com.tea.telemetry.repository;

import com.tea.telemetry.entity.ErrorFingerprint;
import java.time.LocalDateTime;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * 错误指纹仓储（error_fingerprints）。
 * upsert 用原生 ON CONFLICT DO UPDATE：occurrences 自增在 DB 侧原子完成，
 * 避免「查到旧值 → +1 → 写回」的读改写竞态丢计数（匿名端点并发上报是常态）。
 */
public interface ErrorFingerprintRepository extends JpaRepository<ErrorFingerprint, Long> {

    /** 首次插入 review_status='pending'（契约 §9 Human-in-the-Loop 待审批）。 */
    @Modifying
    @Query(value = "insert into error_fingerprints (fingerprint, sample_message, sample_stack, route, "
            + "first_seen_at, last_seen_at, occurrences, affected_sessions, review_status) values ("
            + "cast(:fingerprint as varchar), cast(:sampleMessage as text), cast(:sampleStack as text), "
            + "cast(:route as varchar), cast(:firstSeenAt as timestamptz), cast(:lastSeenAt as timestamptz), "
            + "1, 1, 'pending') "
            + "on conflict (fingerprint) do update set "
            + "occurrences = error_fingerprints.occurrences + 1, "
            + "last_seen_at = greatest(error_fingerprints.last_seen_at, excluded.last_seen_at), "
            + "sample_message = excluded.sample_message, "
            + "sample_stack = excluded.sample_stack, "
            + "route = excluded.route", nativeQuery = true)
    int upsertOnError(
            @Param("fingerprint") String fingerprint,
            @Param("sampleMessage") String sampleMessage,
            @Param("sampleStack") String sampleStack,
            @Param("route") String route,
            @Param("firstSeenAt") LocalDateTime firstSeenAt,
            @Param("lastSeenAt") LocalDateTime lastSeenAt);

    Page<ErrorFingerprint> findByReviewStatus(String reviewStatus, Pageable pageable);
}
