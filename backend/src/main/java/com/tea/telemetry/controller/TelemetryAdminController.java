package com.tea.telemetry.controller;

import com.tea.auth.security.AuthenticatedUser;
import com.tea.common.response.ApiResponse;
import com.tea.common.response.PageResult;
import com.tea.telemetry.dto.ErrorFingerprintView;
import com.tea.telemetry.dto.ReviewRequest;
import com.tea.telemetry.dto.SloReport;
import com.tea.telemetry.service.ErrorFingerprintService;
import com.tea.telemetry.service.SloEvaluationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 遥测管理端点（契约 §1，全部需 JWT）：
 * GET /slo、GET /fingerprints（reviewStatus 过滤 + 分页）、PATCH /fingerprints/{id}/review。
 * 审批人从登录主体取，不由请求体传入（防调用方冒充他人审批）。
 */
@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
public class TelemetryAdminController {

    private final SloEvaluationService sloEvaluationService;
    private final ErrorFingerprintService errorFingerprintService;

    @GetMapping("/slo")
    public ApiResponse<SloReport> slo() {
        return ApiResponse.success(sloEvaluationService.current());
    }

    @GetMapping("/fingerprints")
    public ApiResponse<PageResult<ErrorFingerprintView>> fingerprints(
            @RequestParam(name = "reviewStatus", required = false) String reviewStatus,
            @RequestParam(name = "page", defaultValue = "1") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ApiResponse.success(errorFingerprintService.list(reviewStatus, page, size));
    }

    @PatchMapping("/fingerprints/{id}/review")
    public ApiResponse<ErrorFingerprintView> reviewFingerprint(@AuthenticationPrincipal AuthenticatedUser user,
                                                               @PathVariable("id") Long id,
                                                               @Valid @RequestBody ReviewRequest request) {
        return ApiResponse.success(errorFingerprintService.review(id, request, user.username()));
    }
}
