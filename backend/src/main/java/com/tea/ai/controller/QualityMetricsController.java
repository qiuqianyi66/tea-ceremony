package com.tea.ai.controller;

import com.tea.ai.quality.QualityMetricsService;
import com.tea.ai.quality.dto.QualityReport;
import com.tea.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 回答质量指标端点（GET /api/v1/ai/metrics/quality）。
 *
 * 为什么单独一个 Controller 而不是往 AiMetricsController 里加：那个类是本轮其他改动的落点，
 * 并行修改同一个文件会冲突；端点路径仍挂在同一个前缀下，对外契约不变。
 *
 * 需 JWT：SecurityConfig 只放行 /api/v1/ai/chat，其余 /api/v1/ai/** 走 anyRequest().authenticated()
 * （本次未改 SecurityConfig）。Controller 只做参数与响应，窗口归一与聚合在 QualityMetricsService。
 */
@RestController
@RequestMapping("/api/v1/ai/metrics")
@RequiredArgsConstructor
public class QualityMetricsController {

    private final QualityMetricsService qualityMetricsService;

    @GetMapping("/quality")
    public ApiResponse<QualityReport> quality(
            @RequestParam(name = "windowMinutes", defaultValue = "1440") int windowMinutes) {
        return ApiResponse.success(qualityMetricsService.quality(windowMinutes));
    }
}
