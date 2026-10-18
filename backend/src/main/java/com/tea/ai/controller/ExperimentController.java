package com.tea.ai.controller;

import com.tea.ai.experiment.dto.ExperimentOverview;
import com.tea.ai.experiment.dto.ExperimentReport;
import com.tea.ai.experiment.dto.ExperimentView;
import com.tea.ai.experiment.dto.StopExperimentRequest;
import com.tea.ai.experiment.service.ExperimentService;
import com.tea.common.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * A/B 实验端点（契约 §2「A/B 实验」）。
 *
 * 鉴权：需 JWT。SecurityConfig 只放行 /api/v1/ai/chat，其余 /api/v1/ai/** 走 anyRequest().authenticated()，
 * 因此这里不加任何安全注解、也不改 SecurityConfig。本切片只做「已登录」这一层；
 * 启停属管理操作，按角色或管理令牌收紧由主控在 Security 侧接线（当前任何已登录用户都能启停，见交付说明的安全缺口）。
 *
 * Controller 只做参数与响应：分桶、生命周期流转、指标对比全在 ExperimentService；
 * 校验失败/状态冲突/实验不存在分别由全局异常处理器转 400 / 409 / 404。
 */
@RestController
@RequestMapping("/api/v1/admin/experiments")
@RequiredArgsConstructor
public class ExperimentController {

    private final ExperimentService experimentService;

    /** GET /api/v1/ai/experiments：列表 + 每实验 control/treatment 对比（近 60 分钟窗口）。 */
    @GetMapping
    public ApiResponse<ExperimentOverview> list() {
        return ApiResponse.success(experimentService.overview());
    }

    /** GET /api/v1/ai/experiments/{key}：单实验详情（配置 + 同一窗口的对比）。 */
    @GetMapping("/{key}")
    public ApiResponse<ExperimentReport> detail(@PathVariable("key") String key) {
        return ApiResponse.success(experimentService.report(key));
    }

    /** POST /api/v1/ai/experiments/{key}/start：draft/paused → running（running 幂等）。 */
    @PostMapping("/{key}/start")
    public ApiResponse<ExperimentView> start(@PathVariable("key") String key) {
        return ApiResponse.success(experimentService.start(key));
    }

    /** POST /api/v1/ai/experiments/{key}/stop：任意状态 → stopped；body 可省略（reason 可空）。 */
    @PostMapping("/{key}/stop")
    public ApiResponse<ExperimentView> stop(@PathVariable("key") String key,
                                            @RequestBody(required = false) @Valid StopExperimentRequest request) {
        return ApiResponse.success(experimentService.stop(key, request == null ? null : request.reason()));
    }
}
