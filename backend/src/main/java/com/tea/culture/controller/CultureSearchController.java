package com.tea.culture.controller;

import com.tea.common.response.ApiResponse;
import com.tea.culture.service.CultureSearchService;
import com.tea.culture.vo.CultureSearchResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 文化搜索接口（/api/v1/culture/search，公开；AI 茶博士 RAG 上下文依赖）。
 * 文化域其余端点（regions/people/poems 详情）留后续 culture 切片。
 */
@RestController
@RequestMapping("/api/v1/culture")
@RequiredArgsConstructor
public class CultureSearchController {

    private final CultureSearchService cultureSearchService;

    @GetMapping("/search")
    public ApiResponse<CultureSearchResult> search(@RequestParam(name = "q", defaultValue = "") String q) {
        return ApiResponse.success(cultureSearchService.search(q));
    }
}
