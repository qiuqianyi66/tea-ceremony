package com.tea.telemetry.dto;

import com.tea.telemetry.entity.ErrorFingerprint;
import java.time.LocalDateTime;

/**
 * 错误指纹视图（GET /api/v1/telemetry/fingerprints）。
 * Entity 不出参（红线 R3），由本 VO 转换；status 用枚举名输出，前端不必维护字符串常量表。
 */
public record ErrorFingerprintView(
        Long id,
        String fingerprint,
        String sampleMessage,
        String sampleStack,
        String route,
        LocalDateTime firstSeenAt,
        LocalDateTime lastSeenAt,
        long occurrences,
        long affectedSessions,
        String reviewStatus,
        String reviewedBy,
        LocalDateTime reviewedAt,
        String reviewNote) {

    public static ErrorFingerprintView from(ErrorFingerprint fingerprint) {
        return new ErrorFingerprintView(
                fingerprint.getId(),
                fingerprint.getFingerprint(),
                fingerprint.getSampleMessage(),
                fingerprint.getSampleStack(),
                fingerprint.getRoute(),
                fingerprint.getFirstSeenAt(),
                fingerprint.getLastSeenAt(),
                fingerprint.getOccurrences(),
                fingerprint.getAffectedSessions(),
                fingerprint.getReviewStatus(),
                fingerprint.getReviewedBy(),
                fingerprint.getReviewedAt(),
                fingerprint.getReviewNote());
    }
}
