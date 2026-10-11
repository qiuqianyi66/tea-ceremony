package com.tea.culture.controller;

import com.tea.common.response.ApiResponse;
import com.tea.culture.service.ChunkBackfillService;
import com.tea.culture.service.ChunkBackfillService.BackfillResult;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 文化知识回填管理端点（PLAN-ai-capability T04/T05）。
 * 安全：/api/v1/admin/** 未在 SecurityConfig permitAll 白名单 → 需 JWT 登录（SecurityConfig anyRequest().authenticated()）。
 * 显式触发（不自动跑）：回填嵌入会产生 DashScope embedding 费用（计入 D-5 预算），
 * 由运维方在确认 key 可用后手动调用一次；embed=false 可零费用验证管线。
 */
@RestController
@RequestMapping("/api/v1/admin/culture")
@RequiredArgsConstructor
public class AdminCultureController {

    private final ChunkBackfillService chunkBackfillService;

    /**
     * 回填 culture_chunks。
     * @param embed true=尝试嵌入（需 AI key）；false=仅落 chunk_text（status=pending，零费用）
     */
    @PostMapping("/chunks/backfill")
    public ApiResponse<BackfillResult> backfill(@RequestParam(name = "embed", defaultValue = "true") boolean embed) {
        return ApiResponse.success(chunkBackfillService.backfill(embed));
    }
}
