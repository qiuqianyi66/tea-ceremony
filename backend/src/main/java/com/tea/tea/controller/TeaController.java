package com.tea.tea.controller;

import com.tea.common.response.ApiResponse;
import com.tea.common.response.PageResult;
import com.tea.tea.service.TeaService;
import com.tea.tea.vo.TeaVo;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 茶叶目录接口（/api/v1/teas，PRD F2/F3 所有用户可浏览，SecurityConfig 已放行 GET）。
 * Controller 只做参数与响应，不写业务。
 */
@RestController
@RequestMapping("/api/v1/teas")
@RequiredArgsConstructor
public class TeaController {

    private final TeaService teaService;

    @GetMapping
    public ApiResponse<PageResult<TeaVo>> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String origin,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer size) {
        return ApiResponse.success(teaService.list(category, origin, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<TeaVo> detail(@PathVariable Integer id) {
        return ApiResponse.success(teaService.getById(id));
    }
}
