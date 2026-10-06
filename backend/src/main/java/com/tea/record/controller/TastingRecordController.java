package com.tea.record.controller;

import com.tea.auth.security.AuthenticatedUser;
import com.tea.common.response.ApiResponse;
import com.tea.common.response.PageResult;
import com.tea.record.dto.RecordCreateRequest;
import com.tea.record.service.TastingRecordService;
import com.tea.record.vo.RecordVo;
import jakarta.validation.Valid;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 品鉴记录接口（/api/v1/records/*，全部需登录）。
 * Controller 只做参数与响应；幂等/归属校验在 Service。
 */
@RestController
@RequestMapping("/api/v1/records")
@RequiredArgsConstructor
public class TastingRecordController {

    private final TastingRecordService recordService;

    @PostMapping
    public ApiResponse<RecordVo> create(@AuthenticationPrincipal AuthenticatedUser user,
                                        @Valid @RequestBody RecordCreateRequest req) {
        return ApiResponse.success(recordService.create(user.id(), req));
    }

    @GetMapping
    public ApiResponse<PageResult<RecordVo>> list(@AuthenticationPrincipal AuthenticatedUser user,
                                                  @RequestParam(defaultValue = "1") int page,
                                                  @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(recordService.list(user.id(), page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<RecordVo> detail(@AuthenticationPrincipal AuthenticatedUser user,
                                        @PathVariable Integer id) {
        return ApiResponse.success(recordService.getById(user.id(), id));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, String>> delete(@AuthenticationPrincipal AuthenticatedUser user,
                                                   @PathVariable Integer id) {
        recordService.delete(user.id(), id);
        return ApiResponse.success(Map.of("message", "已删除"));
    }
}
