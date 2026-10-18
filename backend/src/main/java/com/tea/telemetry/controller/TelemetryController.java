package com.tea.telemetry.controller;

import com.tea.common.response.ApiResponse;
import com.tea.telemetry.dto.TelemetryBatchRequest;
import com.tea.telemetry.dto.TelemetryBatchResult;
import com.tea.telemetry.service.TelemetryIngestService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 遥测上报端点（契约 §1）：POST /api/v1/telemetry/batch，匿名可写 + 限流。
 * Controller 只做转发：信封校验、逐条 rejected、幂等与指纹 upsert 全在 Service。
 * 不加 @Valid：契约 §4 要求单条非法不中断整批，Bean Validation 会把坏条目升级成整批 400。
 */
@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
public class TelemetryController {

    private final TelemetryIngestService ingestService;

    @PostMapping("/batch")
    public ApiResponse<TelemetryBatchResult> batch(@RequestBody TelemetryBatchRequest request) {
        return ApiResponse.success(ingestService.ingest(request));
    }
}
