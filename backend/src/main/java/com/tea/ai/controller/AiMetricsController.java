package com.tea.ai.controller;

import com.tea.ai.dto.GoldenMetricsReport;
import com.tea.ai.metrics.GoldenMetricsService;
import com.tea.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 指标端点（GET /api/v1/ai/metrics/golden）。
 * 需 JWT：SecurityConfig 只放行 /api/v1/ai/chat，其余 /api/v1/ai/** 走 anyRequest().authenticated()（未改 Security）。
 * Controller 只做参数与响应；窗口归一与指标计算在 GoldenMetricsService。
 */
@RestController
@RequestMapping("/api/v1/ai/metrics")
@RequiredArgsConstructor
public class AiMetricsController {

    private final GoldenMetricsService goldenMetricsService;

    @GetMapping("/golden")
    public ApiResponse<GoldenMetricsReport> golden(
            @RequestParam(name = "windowMinutes", defaultValue = "60") int windowMinutes) {
        return ApiResponse.success(goldenMetricsService.golden(windowMinutes));
    }
}
